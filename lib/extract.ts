import { z } from "zod";
import { getLLM, getModel } from "./llm";

// Mirrors evidence_map.yaml's `fields:` list exactly. The LLM only fills these;
// it never decides gates, scores or dispositions — that's all in qualify.ts.
export const ExtractedFactsSchema = z.object({
  is_saas: z.boolean().nullable(),
  buyer_named: z.string().nullable(),
  funding_stage: z
    .enum(["pre-seed", "seed", "A", "B", "C", "D+", "public", "acquired", "bootstrapped"])
    .nullable(),
  funding_evidence: z.string().nullable(),
  headcount_low: z.number().nullable(),
  headcount_high: z.number().nullable(),
  open_roles_count: z.number().nullable(),
  compliance_roles_open: z.array(z.string()),
  certs_held: z.array(z.string()),
  certs_in_progress: z.array(z.string()),
  enterprise_tier: z.boolean().nullable(),
  enterprise_logos: z.array(z.string()),
  security_questionnaire_language: z.boolean().nullable(),
  selling_regions: z.array(z.enum(["US", "EU", "IN", "other"])),
  industry: z.enum(["fintech", "healthtech", "hrtech", "devtools", "other"]).nullable(),
  cloud_provider: z.enum(["AWS", "GCP", "Azure"]).nullable(),
});

export type ExtractedFacts = z.infer<typeof ExtractedFactsSchema>;

export const EMPTY_FACTS: ExtractedFacts = {
  is_saas: null,
  buyer_named: null,
  funding_stage: null,
  funding_evidence: null,
  headcount_low: null,
  headcount_high: null,
  open_roles_count: null,
  compliance_roles_open: [],
  certs_held: [],
  certs_in_progress: [],
  enterprise_tier: null,
  enterprise_logos: [],
  security_questionnaire_language: null,
  selling_regions: [],
  industry: null,
  cloud_provider: null,
};

const SYSTEM_PROMPT = `You extract facts about a B2B company from scraped website text for a sales
qualification pipeline. Only report what the text actually states. Never guess or infer beyond
the text. Return exactly these fields, with these exact types — do not change a field's type:
- is_saas: boolean or null
- buyer_named: a SINGLE short string describing who buys the product (e.g. "engineering teams",
  "sales and support orgs"), or null. NEVER a list of customer/people names.
- funding_stage: one of pre-seed|seed|A|B|C|D+|public|acquired|bootstrapped, or null
- funding_evidence: a single string quote/headline, or null
- headcount_low: integer or null
- headcount_high: integer or null
- open_roles_count: integer or null
- compliance_roles_open: array of strings (job titles), [] if none
- certs_held: array of strings — certifications ACHIEVED ONLY (badge, "certified", report available), [] if none
- certs_in_progress: array of strings — certs described as "in progress", "working toward", "coming soon", [] if none
- enterprise_tier: boolean or null
- enterprise_logos: array of named enterprise CUSTOMER company names shown as social proof, [] if none
- security_questionnaire_language: boolean or null
- selling_regions: array of US|EU|IN|other, [] if none
- industry: one of fintech|healthtech|hrtech|devtools|other, or null
- cloud_provider: one of AWS|GCP|Azure, or null
Distinguish certifications already ACHIEVED (certs_held) from ones described as "in progress" or
"coming soon" (certs_in_progress) — never mix them. Respond with JSON only, one flat object with
exactly these field names.`;

/** Merges newly extracted facts into existing ones: a new non-null value wins, arrays are unioned. */
export function mergeFacts(base: ExtractedFacts, next: ExtractedFacts): ExtractedFacts {
  const merged: any = { ...base };
  for (const key of Object.keys(next) as (keyof ExtractedFacts)[]) {
    const value = next[key];
    if (Array.isArray(value)) {
      const baseArr = (base[key] as unknown as string[]) || [];
      merged[key] = Array.from(new Set([...baseArr, ...value]));
    } else if (value !== null && value !== undefined) {
      merged[key] = value;
    }
  }
  return merged as ExtractedFacts;
}

const STRING_FIELDS = new Set(["buyer_named", "funding_evidence"]);
const ARRAY_FIELDS = new Set([
  "compliance_roles_open",
  "certs_held",
  "certs_in_progress",
  "enterprise_logos",
  "selling_regions",
]);

/**
 * The model occasionally sends the wrong shape for one field (e.g. a list of names for
 * buyer_named, a string for a list field). Zod's strict parse would then drop the WHOLE
 * extraction to avoid silently trusting a malformed fact. We coerce per-field instead, so one
 * wrong type doesn't erase every other correctly-extracted field.
 */
function coerce(raw: any): any {
  if (typeof raw !== "object" || raw === null) return {};
  const out: any = { ...raw };
  for (const key of STRING_FIELDS) {
    if (Array.isArray(out[key])) out[key] = out[key].length > 0 ? String(out[key][0]) : null;
    else if (out[key] !== null && out[key] !== undefined && typeof out[key] !== "string") out[key] = String(out[key]);
  }
  for (const key of ARRAY_FIELDS) {
    if (out[key] === null || out[key] === undefined) out[key] = [];
    else if (!Array.isArray(out[key])) out[key] = [String(out[key])];
    else out[key] = out[key].map((v: unknown) => String(v));
  }
  return out;
}

export async function extractFacts(text: string, sourceLabel: string): Promise<ExtractedFacts> {
  if (!text.trim()) return EMPTY_FACTS;
  const llm = getLLM();
  const res = await llm.chat.completions.create({
    model: getModel(),
    temperature: 0,
    response_format: { type: "json_object" },
    messages: [
      { role: "system", content: SYSTEM_PROMPT },
      {
        role: "user",
        content: `Source: ${sourceLabel}\n\nFields to fill: ${Object.keys(EMPTY_FACTS).join(", ")}\n\nScraped text:\n${text}`,
      },
    ],
  });

  const raw = res.choices[0]?.message?.content ?? "{}";
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return EMPTY_FACTS;
  }

  const safe = ExtractedFactsSchema.partial().safeParse(coerce(parsed));
  if (!safe.success) return EMPTY_FACTS;

  return { ...EMPTY_FACTS, ...safe.data } as ExtractedFacts;
}
