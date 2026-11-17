import { getLLM, getModel } from "./llm";
import { Candidate } from "./contact";
import { Pain } from "./pains";
import { loadEvidenceMap } from "./config";

export interface EmailDraft {
  subject: string;
  body: string;
  hook_source: string;
}

export interface EmailCheckResult {
  name: string;
  passed: boolean;
  detail: string;
}

export interface EmailOutcome {
  draft: EmailDraft | null;
  checks: EmailCheckResult[];
  allPassed: boolean;
  regenerated: boolean;
  flagged: boolean;
}

function wordCount(s: string): number {
  return s.trim().split(/\s+/).filter(Boolean).length;
}

export function runEmailChecks(
  draft: EmailDraft,
  scrapedText: string,
  firstName: string | null,
  g4Unresolved: boolean,
  g2Unresolved: boolean,
  banned: string[]
): EmailCheckResult[] {
  const checks: EmailCheckResult[] = [];

  const addressedByName = Boolean(firstName) && draft.body.includes(firstName as string);
  checks.push({ name: "addressed_by_first_name", passed: addressedByName, detail: firstName ? `looks for "${firstName}"` : "no first name available" });

  const hasPlaceholder = /\[.*?\]|\{\{.*?\}\}/.test(draft.body) || /\[.*?\]/.test(draft.subject);
  checks.push({ name: "no_placeholders", passed: !hasPlaceholder, detail: hasPlaceholder ? "found bracketed placeholder text" : "clean" });

  const words = wordCount(draft.body);
  checks.push({ name: "max_120_words", passed: words <= 120, detail: `${words} words` });

  const subjectWords = wordCount(draft.subject);
  checks.push({ name: "subject_max_8_words", passed: subjectWords <= 8, detail: `${subjectWords} words` });

  const askCount = (draft.body.match(/\?|call|chat|meet|connect/gi) || []).length;
  checks.push({ name: "one_ask", passed: askCount >= 1, detail: `${askCount} ask-like phrases found` });

  const bannedHit = banned.find((b) => draft.body.toLowerCase().includes(b.toLowerCase()) || draft.subject.toLowerCase().includes(b.toLowerCase()));
  checks.push({ name: "no_banned_words", passed: !bannedHit, detail: bannedHit ? `found "${bannedHit}"` : "clean" });

  const hookGrounded = Boolean(draft.hook_source) && scrapedText.includes(draft.hook_source);
  checks.push({ name: "hook_grounded_verbatim", passed: hookGrounded, detail: hookGrounded ? "hook_source found in scraped text" : "hook_source not found verbatim" });

  if (g4Unresolved) {
    const isQuestion = draft.body.trim().endsWith("?") || draft.body.includes("?");
    checks.push({ name: "g4_unknown_question_hook", passed: isQuestion, detail: isQuestion ? "contains a question" : "G4 unknown but no question hook" });
  }

  if (g2Unresolved) {
    const mentionsFunding = /series [a-d]|funding|raised|round/i.test(draft.body);
    checks.push({ name: "g2_unknown_no_funding_mention", passed: !mentionsFunding, detail: mentionsFunding ? "mentions funding/stage" : "clean" });
  }

  return checks;
}

async function draftOnce(
  companyName: string,
  domain: string,
  contact: Candidate,
  pains: Pain[],
  facts: { g4Unresolved: boolean; g2Unresolved: boolean },
  scrapedText: string
): Promise<EmailDraft> {
  const llm = getLLM();
  const painLines = pains.map((p) => `- ${p.pain} (${p.inferred ? "inferred" : `evidence: "${p.evidence_quote}"`})`).join("\n");

  const res = await llm.chat.completions.create({
    model: getModel(),
    temperature: 0.4,
    response_format: { type: "json_object" },
    messages: [
      {
        role: "system",
        content: `You write a short cold outreach email for Sprinto (a compliance automation company) to a prospect.
Rules: address the person by first name; no placeholder text; 120 words max body; subject 8 words max; exactly one
ask (a short call); the email must reference a "hook_source" — a short phrase copied VERBATIM from the scraped text
(a job post line, product line, named customer, or cloud provider) — and that exact string must appear in your output
hook_source field. ${facts.g4Unresolved ? "The company's audit pressure is UNKNOWN — phrase the hook as a question, not an assertion." : ""}
${facts.g2Unresolved ? "The company's funding stage is UNKNOWN — do not mention funding or stage at all." : ""}
Never use these words: revolutionise, seamless, supercharge, game-changing, leverage, synergy, "hope this finds you well".
No invented statistics or claims beyond what's given. Respond as JSON: {"subject": "...", "body": "...", "hook_source": "..."}.`,
      },
      {
        role: "user",
        content: `Company: ${companyName} (${domain})\nContact: ${contact.firstName ?? "there"}, ${contact.position}\nPains:\n${painLines}\n\nScraped text (for hook_source, copy a short phrase verbatim from here):\n${scrapedText.slice(0, 3000)}`,
      },
    ],
  });

  const raw = res.choices[0]?.message?.content ?? "{}";
  let parsed: any;
  try {
    parsed = JSON.parse(raw);
  } catch {
    parsed = { subject: "", body: "", hook_source: "" };
  }
  return {
    subject: String(parsed.subject ?? ""),
    body: String(parsed.body ?? ""),
    hook_source: String(parsed.hook_source ?? ""),
  };
}

export async function draftAndCheckEmail(
  companyName: string,
  domain: string,
  contact: Candidate,
  pains: Pain[],
  g4Unresolved: boolean,
  g2Unresolved: boolean,
  scrapedText: string
): Promise<EmailOutcome> {
  const map = loadEvidenceMap();
  const banned = map.email.banned as string[];

  let draft = await draftOnce(companyName, domain, contact, pains, { g4Unresolved, g2Unresolved }, scrapedText);
  let checks = runEmailChecks(draft, scrapedText, contact.firstName, g4Unresolved, g2Unresolved, banned);
  let allPassed = checks.every((c) => c.passed);
  let regenerated = false;

  if (!allPassed) {
    regenerated = true;
    draft = await draftOnce(companyName, domain, contact, pains, { g4Unresolved, g2Unresolved }, scrapedText);
    checks = runEmailChecks(draft, scrapedText, contact.firstName, g4Unresolved, g2Unresolved, banned);
    allPassed = checks.every((c) => c.passed);
  }

  return { draft, checks, allPassed, regenerated, flagged: !allPassed };
}
