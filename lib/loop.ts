import { loadEvidenceMap } from "./config";
import { ExtractedFacts, extractFacts, mergeFacts, EMPTY_FACTS } from "./extract";
import { evaluateGates, missingFieldsForGate, defaultSourcePathForGate, nextCandidatePathForGate, GateResult } from "./qualify";
import { fetchPage, homepageUrl, PageResult } from "./scrape";
import { searchNews, NewsItem } from "./news";
import { getLLM, getModel } from "./llm";

export interface LoopStep {
  iteration: number;
  missingGate: string;
  missingFields: string[];
  toolCalled: "fetch_page" | "search_news" | "default_fallback" | "none";
  toolArg: string;
  result: string;
}

export interface LoopOutcome {
  facts: ExtractedFacts;
  gates: GateResult[];
  steps: LoopStep[];
  capHit: boolean;
  thinSignal: boolean;
}

const TOOLS = [
  {
    type: "function" as const,
    function: {
      name: "fetch_page",
      description:
        "Fetches one page on the company's OWN domain and returns cleaned main text (nav/footer/cookies removed, capped). " +
        "Use when a specific gate field is missing and a known page is likely to hold it (e.g. /careers for open roles and compliance jobs, " +
        "/pricing for enterprise tier, /customers for logos, /security or /trust for certifications). " +
        "Do not use for any other domain, for pages already fetched this run, or when no plausible page would hold the missing field. " +
        "Returns {status, words, text} where status is one of ok, blocked, not_found, thin, error.",
      parameters: {
        type: "object",
        properties: { path: { type: "string", description: "Path on the same domain, e.g. /careers" } },
        required: ["path"],
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "search_news",
      description:
        "Searches Google News (RSS) for recent headlines about the company. Use ONLY to confirm a funding round or a " +
        "certification announcement that the company's own site did not state. Do not use for contact details, general " +
        "research, or more than twice per company. Returns up to 5 {title, source, date} items, or an empty list.",
      parameters: {
        type: "object",
        properties: { query: { type: "string", description: "Search query, e.g. \"Acme Inc Series B\"" } },
        required: ["query"],
      },
    },
  },
];

function firstUnresolved(gates: GateResult[]): GateResult | null {
  return gates.find((g) => g.verdict === "unresolved") ?? null;
}

export async function runAgentLoop(domain: string, companyName: string, homepageText: PageResult): Promise<LoopOutcome> {
  const map = loadEvidenceMap();
  const steps: LoopStep[] = [];
  const fetchedPaths = new Set<string>(["/"]);
  let pageFetchCount = 0;
  let newsSearchCount = 0;
  let iteration = 0;

  let facts = await extractFacts(homepageText.text, "homepage");
  let gates = evaluateGates(facts);
  const thinSignal = homepageText.status === "thin";

  while (iteration < map.budgets.loop_iterations_max) {
    const unresolved = firstUnresolved(gates);
    if (!unresolved) break;

    const missing = missingFieldsForGate(unresolved.gate, facts);
    if (missing.length === 0) break; // nothing more we can ask for on this gate

    const budgetForPages = pageFetchCount < map.budgets.fetch_page_max;
    const budgetForNews = newsSearchCount < map.budgets.search_news_max;
    if (!budgetForPages && !budgetForNews) break;

    const llm = getLLM();
    const availableTools = TOOLS.filter((t) => (t.function.name === "fetch_page" ? budgetForPages : budgetForNews));

    const res = await llm.chat.completions.create({
      model: getModel(),
      temperature: 0,
      tools: availableTools,
      tool_choice: "required",
      messages: [
        {
          role: "system",
          content:
            "You are choosing ONE tool call to resolve a missing fact for a sales-qualification gate. " +
            "Pick the single most likely source. Never invent a path not plausible for a company site.",
        },
        {
          role: "user",
          content: `Domain: ${domain}\nUnresolved gate: ${unresolved.gate} (${unresolved.name})\nMissing fields: ${missing.join(", ")}\nAlready fetched paths: ${[...fetchedPaths].join(", ")}`,
        },
      ],
    });

    const rawCall = res.choices[0]?.message?.tool_calls?.[0];
    iteration++;

    // The SDK's tool-call type is a union of function/custom calls; we only ever offer
    // function tools (fetch_page, search_news), so narrow to that before reading .function.
    if (!rawCall || rawCall.type !== "function") {
      steps.push({ iteration, missingGate: unresolved.gate, missingFields: missing, toolCalled: "none", toolArg: "", result: "Model made no tool call" });
      break;
    }
    const call = rawCall;

    let args: any = {};
    try {
      args = JSON.parse(call.function.arguments || "{}");
    } catch {
      args = {};
    }

    if (call.function.name === "fetch_page" && budgetForPages) {
      let requestedPath: string = args.path || defaultSourcePathForGate(unresolved.gate);
      if (fetchedPaths.has(requestedPath)) {
        requestedPath = nextCandidatePathForGate(unresolved.gate, fetchedPaths) ?? requestedPath;
      }

      if (fetchedPaths.has(requestedPath)) {
        // Every candidate page for this gate has already been tried — nothing new to fetch.
        steps.push({
          iteration,
          missingGate: unresolved.gate,
          missingFields: missing,
          toolCalled: "none",
          toolArg: "",
          result: "All candidate pages for this gate already fetched",
        });
        break;
      }

      const url = new URL(requestedPath, homepageUrl(domain)).toString();
      const page = await fetchPage(url, domain);
      pageFetchCount++;
      fetchedPaths.add(requestedPath);

      if (page.status === "ok" || page.status === "thin") {
        const newFacts = await extractFacts(page.text, requestedPath);
        facts = mergeFacts(facts, newFacts);
      }

      steps.push({
        iteration,
        missingGate: unresolved.gate,
        missingFields: missing,
        toolCalled: "fetch_page",
        toolArg: requestedPath,
        result: `status=${page.status}, words=${page.words}`,
      });
    } else if (call.function.name === "search_news" && budgetForNews) {
      const query: string = args.query || `${companyName} funding OR certification`;
      const items: NewsItem[] = await searchNews(query);
      newsSearchCount++;

      if (items.length > 0) {
        const summary = items.map((i) => `${i.title} (${i.source}, ${i.date})`).join("\n");
        const newFacts = await extractFacts(summary, "news_search");
        facts = mergeFacts(facts, newFacts);
      }

      steps.push({
        iteration,
        missingGate: unresolved.gate,
        missingFields: missing,
        toolCalled: "search_news",
        toolArg: query,
        result: `${items.length} headlines found`,
      });
    } else {
      // Tool outside budget/rules — reject and fall back to the gate's next untried source.
      const fallbackPath = nextCandidatePathForGate(unresolved.gate, fetchedPaths);
      if (fallbackPath && budgetForPages) {
        const url = new URL(fallbackPath, homepageUrl(domain)).toString();
        const page = await fetchPage(url, domain);
        pageFetchCount++;
        fetchedPaths.add(fallbackPath);
        if (page.status === "ok" || page.status === "thin") {
          const newFacts = await extractFacts(page.text, fallbackPath);
          facts = mergeFacts(facts, newFacts);
        }
        steps.push({
          iteration,
          missingGate: unresolved.gate,
          missingFields: missing,
          toolCalled: "default_fallback",
          toolArg: fallbackPath,
          result: `Model's tool call rejected (budget/rules) — used default source instead`,
        });
      } else {
        steps.push({
          iteration,
          missingGate: unresolved.gate,
          missingFields: missing,
          toolCalled: "none",
          toolArg: "",
          result: "Model's tool call rejected and no budget left for a fallback",
        });
        break;
      }
    }

    gates = evaluateGates(facts);
  }

  const capHit = iteration >= map.budgets.loop_iterations_max && gates.some((g) => g.verdict === "unresolved");

  return { facts, gates, steps, capHit, thinSignal };
}
