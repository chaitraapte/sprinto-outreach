import fs from "fs";
import path from "path";
import YAML from "yaml";

// evidence_map.yaml is the single source of truth for every rule, budget, gate,
// score weight and check. We load it once per server instance and never hardcode
// its numbers elsewhere.
export interface EvidenceMap {
  icp_summary: string;
  fields: string[];
  budgets: {
    fetch_page_max: number;
    search_news_max: number;
    loop_iterations_max: number;
    page_token_cap: number;
    thin_page_words: number;
    at_cap: string;
    cache: string;
  };
  runtime: {
    platform: string;
    unit_of_work: string;
    max_duration_seconds: number;
    run_log: string;
    protection: {
      passcode_env: string;
      send_to_env: string;
      max_domains_per_batch: number;
      hunter_guard: string;
    };
  };
  gates: Record<string, any>;
  decision: Record<string, string>;
  score: Record<string, any>;
  poc: Record<string, any>;
  pains: Record<string, any>;
  email: Record<string, any>;
  failure: Record<string, any>;
}

let cached: EvidenceMap | null = null;

export function loadEvidenceMap(): EvidenceMap {
  if (cached) return cached;
  const file = path.join(process.cwd(), "evidence_map.yaml");
  const raw = fs.readFileSync(file, "utf8");
  cached = YAML.parse(raw) as EvidenceMap;
  return cached;
}
