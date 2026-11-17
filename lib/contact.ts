import { loadEvidenceMap } from "./config";
import fs from "fs";
import path from "path";

export interface HunterEmail {
  value: string;
  first_name: string | null;
  last_name: string | null;
  position: string | null;
  department: string | null;
  confidence: number;
  verification: { status: string | null };
}

export interface Candidate {
  email: string;
  firstName: string | null;
  lastName: string | null;
  position: string;
  tier: number;
  confidence: number;
  verification: string | null;
  score: number;
  why: string;
}

export interface ContactResult {
  winner: Candidate | null;
  topCandidates: Candidate[];
  source: "hunter" | "poc_overrides" | "none";
  noPoc: boolean;
}

const GENERIC_LOCALPARTS = ["info", "support", "sales", "contact", "hello", "help", "admin"];
const EXCLUDE_DEPARTMENTS = ["hr", "sales", "marketing", "support", "finance", "legal"];
const EXCLUDE_TITLE_WORDS = ["intern", "assistant", "associate", "coordinator", "recruiter", "advisor", "former", "board"];

function wholeWordMatch(haystack: string, needle: string): boolean {
  const escaped = needle.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const re = new RegExp(`(^|[^a-z])${escaped}($|[^a-z])`, "i");
  return re.test(` ${haystack.toLowerCase()} `);
}

function tierFor(position: string, tiers: Record<string, string[]>): number | null {
  for (const tierNum of [1, 2, 3]) {
    const titles = tiers[String(tierNum)] || [];
    if (titles.some((t) => wholeWordMatch(position, t))) return tierNum;
  }
  return null;
}

function isExcluded(email: string, department: string | null, position: string | null): boolean {
  const localpart = email.split("@")[0]?.toLowerCase() ?? "";
  if (GENERIC_LOCALPARTS.includes(localpart)) return true;
  if (department && EXCLUDE_DEPARTMENTS.includes(department.toLowerCase())) return true;
  if (position) {
    const lower = position.toLowerCase();
    if (EXCLUDE_TITLE_WORDS.some((w) => wholeWordMatch(lower, w))) return true;
  }
  return false;
}

export async function hunterDomainSearch(domain: string): Promise<HunterEmail[]> {
  const key = process.env.HUNTER_API_KEY || "test-api-key";
  const params = new URLSearchParams({
    domain,
    api_key: key,
    limit: "10",
  });

  // Filtered query first per evidence_map.yaml
  const filteredUrl = `https://api.hunter.io/v2/domain-search?${params.toString()}&seniority=senior,executive&department=executive,it,management`;
  let res = await fetch(filteredUrl);
  let data: any = res.ok ? await res.json() : null;
  let emails: HunterEmail[] = data?.data?.emails ?? [];

  if (emails.length === 0) {
    const plainUrl = `https://api.hunter.io/v2/domain-search?${params.toString()}`;
    res = await fetch(plainUrl);
    data = res.ok ? await res.json() : null;
    emails = data?.data?.emails ?? [];
  }

  return emails;
}

function loadOverrides(): Record<string, { email: string; position: string; firstName?: string }> {
  const file = path.join(process.cwd(), "data", "poc_overrides.json");
  try {
    return JSON.parse(fs.readFileSync(file, "utf8"));
  } catch {
    return {};
  }
}

/** Pure ranking logic (tiers, exclusions, whole-word match, pick rule) — no network calls, so it's unit-testable with mocked Hunter data. */
export function rankCandidates(emails: HunterEmail[], headcountHigh: number | null): Candidate[] {
  const map = loadEvidenceMap();
  const poc = map.poc;
  const minConfidence = poc.min_confidence as number;
  const tiers = poc.tiers as Record<string, string[]>;
  const tier3Allowed = headcountHigh === null || headcountHigh < 80;

  const candidates: Candidate[] = emails
    .map((e) => {
      const position = e.position || "";
      const tier = tierFor(position, tiers);
      return { e, tier, position };
    })
    .filter(({ e, tier, position }) => {
      if (tier === null) return false;
      if (tier === 3 && !tier3Allowed) return false;
      if (isExcluded(e.value, e.department, position)) return false;
      if ((e.verification?.status ?? "") === "invalid") return false;
      if (e.confidence < minConfidence) return false;
      return true;
    })
    .map(({ e, tier, position }) => ({
      email: e.value,
      firstName: e.first_name,
      lastName: e.last_name,
      position,
      tier: tier as number,
      confidence: e.confidence,
      verification: e.verification?.status ?? null,
      score: 0,
      why: "",
    }));

  candidates.sort((a, b) => {
    if (a.tier !== b.tier) return a.tier - b.tier; // tier 1 beats tier 2 beats tier 3
    if (b.confidence !== a.confidence) return b.confidence - a.confidence;
    const aValid = a.verification === "valid" ? 1 : 0;
    const bValid = b.verification === "valid" ? 1 : 0;
    return bValid - aValid;
  });

  return candidates.slice(0, 3).map((c, i) => ({
    ...c,
    why:
      i === 0
        ? `Winner: tier ${c.tier}, confidence ${c.confidence}, verification ${c.verification ?? "unknown"}`
        : `Ranked #${i + 1}: tier ${c.tier}, confidence ${c.confidence}`,
  }));
}

export async function pickContact(domain: string, headcountHigh: number | null): Promise<ContactResult> {
  const map = loadEvidenceMap();
  const tiers = map.poc.tiers as Record<string, string[]>;

  const emails = await hunterDomainSearch(domain);
  const top3 = rankCandidates(emails, headcountHigh);

  if (top3.length > 0) {
    return { winner: top3[0], topCandidates: top3, source: "hunter", noPoc: false };
  }

  const overrides = loadOverrides();
  const override = overrides[domain];
  if (override) {
    const winner: Candidate = {
      email: override.email,
      firstName: override.firstName ?? null,
      lastName: null,
      position: override.position,
      tier: tierFor(override.position, tiers) ?? 1,
      confidence: 100,
      verification: "manual",
      score: 0,
      why: "Manual override from poc_overrides.json",
    };
    return { winner, topCandidates: [winner], source: "poc_overrides", noPoc: false };
  }

  return { winner: null, topCandidates: [], source: "none", noPoc: true };
}
