import { getLLM, getModel } from "./llm";
import { ExtractedFacts } from "./extract";
import { Candidate } from "./contact";
import { loadEvidenceMap } from "./config";

export interface Pain {
  pain: string;
  evidence_quote: string | null;
  why_this_persona: string;
  inferred: boolean;
}

function personaFor(position: string): "security_or_compliance" | "cto_or_engineering" | "ceo_or_founder" {
  const p = position.toLowerCase();
  if (/security|ciso|compliance|grc/.test(p)) return "security_or_compliance";
  if (/cto|engineer/.test(p)) return "cto_or_engineering";
  return "ceo_or_founder";
}

export async function pickPains(facts: ExtractedFacts, scrapedText: string, contact: Candidate): Promise<Pain[]> {
  const map = loadEvidenceMap();
  const persona = personaFor(contact.position);
  const defaults: string[] = map.pains.persona_defaults[persona];

  const llm = getLLM();
  const res = await llm.chat.completions.create({
    model: getModel(),
    temperature: 0.2,
    response_format: { type: "json_object" },
    messages: [
      {
        role: "system",
        content: `You pick exactly two pain points for a cold outreach email, for a ${persona.replace(/_/g, " ")} persona.
Each pain needs: "pain" (short phrase), "evidence_quote" (a short quote copied VERBATIM from the scraped text that supports it,
or null if there is none), "why_this_persona" (one sentence). Prefer pains backed by a verbatim quote from the text.
If you cannot find textual evidence for a pain, you may use one of these persona defaults instead (mark it inferred): ${defaults.join(" | ")}.
Respond as JSON: {"pains": [{"pain": "...", "evidence_quote": "..." or null, "why_this_persona": "..."}, ...]} with exactly 2 items.`,
      },
      {
        role: "user",
        content: `Scraped text:\n${scrapedText.slice(0, 4000)}\n\nKnown facts: ${JSON.stringify(facts)}`,
      },
    ],
  });

  const raw = res.choices[0]?.message?.content ?? "{}";
  let parsed: any;
  try {
    parsed = JSON.parse(raw);
  } catch {
    parsed = { pains: [] };
  }

  const list = Array.isArray(parsed.pains) ? parsed.pains.slice(0, 2) : [];
  const pains: Pain[] = list.map((p: any) => {
    const quote: string | null = p.evidence_quote || null;
    const grounded = quote ? scrapedText.includes(quote) : false;
    return {
      pain: String(p.pain ?? ""),
      evidence_quote: grounded ? quote : null,
      why_this_persona: String(p.why_this_persona ?? ""),
      inferred: !grounded,
    };
  });

  // Top up to exactly 2 using persona defaults if the model returned fewer, or a quote didn't ground.
  let i = 0;
  while (pains.length < 2 && i < defaults.length) {
    const already = pains.some((p) => p.pain === defaults[i]);
    if (!already) {
      pains.push({ pain: defaults[i], evidence_quote: null, why_this_persona: `Common pressure for ${persona.replace(/_/g, " ")} roles at this stage`, inferred: true });
    }
    i++;
  }

  return pains.slice(0, 2);
}
