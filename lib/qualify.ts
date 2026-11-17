import { ExtractedFacts } from "./extract";
import { loadEvidenceMap } from "./config";

export type GateVerdict = "pass" | "fail" | "unresolved";

export interface GateResult {
  gate: "G1" | "G2" | "G3" | "G4";
  name: string;
  verdict: GateVerdict;
  evidence: string;
}

export type Disposition = "QUALIFIED" | "QUALIFIED_FLAGGED" | "DROPPED" | "MANUAL_REVIEW" | "FAILED";

export interface QualifyResult {
  gates: GateResult[];
  disposition: Disposition;
  droppedAtGate?: string;
  flags: string[];
  score: number;
  band: "priority" | "standard" | "low_flagged";
}

function overlaps50to200(low: number | null, high: number | null): boolean {
  const lo = low ?? high;
  const hi = high ?? low;
  if (lo === null || hi === null) return false;
  return lo <= 200 && hi >= 50;
}

function near30to49or201to400(low: number | null, high: number | null): boolean {
  const lo = low ?? high;
  const hi = high ?? low;
  if (lo === null || hi === null) return false;
  return (lo <= 49 && hi >= 30 && !overlaps50to200(low, high)) || (lo <= 400 && hi >= 201);
}

export function evaluateG1(f: ExtractedFacts): GateResult {
  if (f.is_saas === true && f.buyer_named) {
    return { gate: "G1", name: "B2B SaaS", verdict: "pass", evidence: `Buyer named: ${f.buyer_named}` };
  }
  if (f.is_saas === false) {
    return { gate: "G1", name: "B2B SaaS", verdict: "fail", evidence: "Extractor found is_saas = false (agency/services/D2C/hardware)" };
  }
  return { gate: "G1", name: "B2B SaaS", verdict: "unresolved", evidence: "is_saas or buyer_named still unknown" };
}

export function evaluateG2(f: ExtractedFacts): GateResult {
  if (f.funding_stage === "D+" || f.funding_stage === "public" || f.funding_stage === "acquired") {
    return { gate: "G2", name: "Stage window", verdict: "fail", evidence: `funding_stage = ${f.funding_stage}` };
  }
  if ((f.headcount_low ?? 0) > 1000) {
    return { gate: "G2", name: "Stage window", verdict: "fail", evidence: `headcount_low = ${f.headcount_low} (> 1000)` };
  }
  if (f.headcount_high !== null && f.headcount_high < 15) {
    return { gate: "G2", name: "Stage window", verdict: "fail", evidence: `headcount_high = ${f.headcount_high} (< 15)` };
  }
  if (f.funding_stage === "A" || f.funding_stage === "B" || f.funding_stage === "C") {
    return { gate: "G2", name: "Stage window", verdict: "pass", evidence: `funding_stage = ${f.funding_stage} (${f.funding_evidence ?? "named round"})` };
  }
  const signals = [
    (f.open_roles_count ?? 0) >= 5,
    Boolean(f.enterprise_tier) || f.enterprise_logos.length > 0,
    overlaps50to200(f.headcount_low, f.headcount_high),
  ];
  const passedSignals = signals.filter(Boolean).length;
  if (passedSignals >= 2) {
    return { gate: "G2", name: "Stage window", verdict: "pass", evidence: `${passedSignals}/3 inferred signals present (roles, enterprise, headcount)` };
  }
  return { gate: "G2", name: "Stage window", verdict: "unresolved", evidence: "No named round and fewer than 2 inferred signals" };
}

export function evaluateG3(f: ExtractedFacts): GateResult {
  const achieved = f.certs_held.filter((c) => /soc ?2|iso ?27001|gdpr|hipaa/i.test(c));
  if (achieved.length > 0) {
    return { gate: "G3", name: "Not already certified", verdict: "fail", evidence: `certs_held: ${achieved.join(", ")}` };
  }
  if (f.certs_held.length === 0) {
    return { gate: "G3", name: "Not already certified", verdict: "pass", evidence: "No achieved certs found" };
  }
  return { gate: "G3", name: "Not already certified", verdict: "unresolved", evidence: "certs_held present but not a target cert — treated as unresolved" };
}

export function evaluateG4(f: ExtractedFacts): GateResult {
  const reasons: string[] = [];
  if (f.certs_in_progress.length > 0) reasons.push(`certs_in_progress: ${f.certs_in_progress.join(", ")}`);
  if (f.compliance_roles_open.length > 0) reasons.push(`compliance roles open: ${f.compliance_roles_open.join(", ")}`);
  if (f.enterprise_tier && f.certs_held.length === 0) reasons.push("enterprise tier with no held cert");
  if (f.security_questionnaire_language) reasons.push("security-questionnaire language on site");

  if (reasons.length > 0) {
    return { gate: "G4", name: "Audit pressure", verdict: "pass", evidence: reasons.join("; ") };
  }
  return { gate: "G4", name: "Audit pressure", verdict: "unresolved", evidence: "No pressure signal found (never fails)" };
}

export function computeScore(f: ExtractedFacts, g4: GateResult): { score: number; band: QualifyResult["band"] } {
  let score = 0;

  if (f.certs_in_progress.length > 0) score += 15;
  else if (f.compliance_roles_open.length > 0) score += 10;
  else if ((f.enterprise_tier && f.certs_held.length === 0) || f.security_questionnaire_language) score += 5;

  if (overlaps50to200(f.headcount_low, f.headcount_high)) score += 25;
  else if (near30to49or201to400(f.headcount_low, f.headcount_high)) score += 10;

  if (f.enterprise_logos.length >= 2) score += 20;
  else if (f.selling_regions.length > 0 && f.selling_regions.every((r) => r === "US" || r === "EU")) score += 10;

  if (f.industry === "fintech" || f.industry === "healthtech") score += 20;
  else if (f.industry === "devtools" || f.industry === "hrtech") score += 12;
  else if (f.industry === "other") score += 6;

  if (f.funding_stage === "A" || f.funding_stage === "B" || f.funding_stage === "C") score += 5;

  const band: QualifyResult["band"] = score >= 70 ? "priority" : score >= 40 ? "standard" : "low_flagged";
  return { score, band };
}

/** Code-driven gate evaluation for the current fact state. Does not call the LLM. */
export function evaluateGates(f: ExtractedFacts): GateResult[] {
  return [evaluateG1(f), evaluateG2(f), evaluateG3(f), evaluateG4(f)];
}

/** Given the current gate results, decides disposition per evidence_map.yaml `decision`. */
export function decide(gates: GateResult[], capHit: boolean): { disposition: Disposition; droppedAtGate?: string; flags: string[] } {
  const byGate = Object.fromEntries(gates.map((g) => [g.gate, g])) as Record<string, GateResult>;
  const flags: string[] = [];

  const failed = gates.find((g) => g.verdict === "fail");
  if (failed) {
    return { disposition: "DROPPED", droppedAtGate: failed.gate, flags: [`${failed.gate} failed: ${failed.evidence}`] };
  }

  // manual_review per evidence_map.yaml: "G1 unresolved, or loop/budget cap hit before G1 settled".
  // A cap hit AFTER G1 has already passed does not trigger manual_review — G2/G3/G4 staying
  // unresolved is qualify_and_flag territory, not a reason to send the whole company to a human.
  if (byGate.G1.verdict === "unresolved") {
    return {
      disposition: "MANUAL_REVIEW",
      flags: [capHit ? "Budget cap hit before G1 settled" : "G1 unresolved — needs a human to confirm B2B SaaS"],
    };
  }

  if (byGate.G2.verdict === "unresolved") flags.push("stage unknown");
  if (byGate.G3.verdict === "unresolved") flags.push("certification status unknown — assumed not certified");
  if (byGate.G4.verdict === "unresolved") flags.push("audit pressure unknown — email will ask, not assert");

  if (flags.length > 0) {
    return { disposition: "QUALIFIED_FLAGGED", flags };
  }
  return { disposition: "QUALIFIED", flags: [] };
}

/** Which extracted fields matter for each still-unresolved gate — used to tell the loop/model what's missing. */
export function missingFieldsForGate(gate: GateResult["gate"], f: ExtractedFacts): string[] {
  switch (gate) {
    case "G1":
      return [!f.is_saas ? "is_saas" : null, !f.buyer_named ? "buyer_named" : null].filter(Boolean) as string[];
    case "G2":
      return [
        !f.funding_stage ? "funding_stage" : null,
        f.open_roles_count === null ? "open_roles_count" : null,
        f.enterprise_tier === null && f.enterprise_logos.length === 0 ? "enterprise_tier" : null,
        f.headcount_low === null ? "headcount_low/headcount_high" : null,
      ].filter(Boolean) as string[];
    case "G3":
      return f.certs_held.length === 0 ? ["certs_held"] : [];
    case "G4":
      return [
        f.certs_in_progress.length === 0 ? "certs_in_progress" : null,
        f.compliance_roles_open.length === 0 ? "compliance_roles_open" : null,
        f.security_questionnaire_language === null ? "security_questionnaire_language" : null,
      ].filter(Boolean) as string[];
  }
}

const CANDIDATE_PAGES: Record<GateResult["gate"], string[]> = {
  G1: ["/pricing", "/product", "/about"],
  G2: ["/careers", "/customers", "/pricing"],
  G3: ["/security", "/trust"],
  G4: ["/careers", "/security", "/pricing"],
};

/** First candidate page for a gate, per evidence_map.yaml's `sources` list — the default fallback source. */
export function defaultSourcePathForGate(gate: GateResult["gate"]): string {
  return CANDIDATE_PAGES[gate][0];
}

/** Next not-yet-fetched candidate page for a gate, or null if all have been tried. */
export function nextCandidatePathForGate(gate: GateResult["gate"], alreadyFetched: Set<string>): string | null {
  return CANDIDATE_PAGES[gate].find((p) => !alreadyFetched.has(p)) ?? null;
}
