import * as cheerio from "cheerio";
import robotsParser from "robots-parser";
import { loadEvidenceMap } from "./config";

const USER_AGENT = "SprintoOutreachBot/0.1 (+educational demo; contact via case study)";
const FETCH_TIMEOUT_MS = 8000;

export type FetchStatus = "ok" | "blocked" | "not_found" | "thin" | "error";

export interface PageResult {
  status: FetchStatus;
  words: number;
  text: string;
  url: string;
}

async function fetchWithTimeout(url: string): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    return await fetch(url, {
      signal: controller.signal,
      headers: { "User-Agent": USER_AGENT },
      redirect: "follow",
    });
  } finally {
    clearTimeout(timer);
  }
}

async function isAllowedByRobots(url: string): Promise<boolean> {
  const u = new URL(url);
  const robotsUrl = `${u.protocol}//${u.host}/robots.txt`;
  try {
    const res = await fetchWithTimeout(robotsUrl);
    if (!res.ok) return true; // no robots.txt = allowed
    const body = await res.text();
    const robots = robotsParser(robotsUrl, body);
    return robots.isAllowed(url, USER_AGENT) !== false;
  } catch {
    return true; // can't reach robots.txt — don't block on that alone
  }
}

/** Strips nav/footer/cookie/script noise and dedupes repeated blocks of text. */
function cleanHtml(html: string): string {
  const $ = cheerio.load(html);
  $("script, style, nav, footer, noscript, svg, iframe").remove();
  $("[class*=cookie], [id*=cookie], [class*=banner]").remove();

  const blocks: string[] = [];
  $("body")
    .find("p, li, h1, h2, h3, h4, td, span, div")
    .each((_, el) => {
      const t = $(el).clone().children().remove().end().text().trim().replace(/\s+/g, " ");
      if (t.length > 20) blocks.push(t);
    });

  const seen = new Set<string>();
  const deduped = blocks.filter((b) => {
    if (seen.has(b)) return false;
    seen.add(b);
    return true;
  });

  return deduped.join("\n");
}

function capTokens(text: string, cap: number): string {
  // ~4 chars/token heuristic — good enough for a budget cap, not exact tokenization.
  const approxChars = cap * 4;
  return text.length > approxChars ? text.slice(0, approxChars) : text;
}

/** Fetches a single page on the company's own domain, respecting robots.txt. */
export async function fetchPage(url: string, domain: string): Promise<PageResult> {
  const map = loadEvidenceMap();
  const target = new URL(url);
  if (target.hostname.replace(/^www\./, "") !== domain.replace(/^www\./, "")) {
    return { status: "error", words: 0, text: "", url };
  }

  const allowed = await isAllowedByRobots(url);
  if (!allowed) {
    return { status: "blocked", words: 0, text: "", url };
  }

  // Timeout/network failures get 2 retries per evidence_map.yaml's failure policy; a deterministic
  // response (403/404/etc.) is returned immediately since retrying it would not change anything.
  for (let attempt = 0; attempt <= 2; attempt++) {
    try {
      const res = await fetchWithTimeout(url);
      if (res.status === 404) return { status: "not_found", words: 0, text: "", url };
      // 403 (and Cloudflare's 503 challenge page) mean "blocked": do not bypass, send to manual_review —
      // same bucket as a robots.txt disallow.
      if (res.status === 403 || res.status === 503) return { status: "blocked", words: 0, text: "", url };
      if (!res.ok) return { status: "error", words: 0, text: "", url };

      const html = await res.text();
      const cleaned = cleanHtml(html);
      const capped = capTokens(cleaned, map.budgets.page_token_cap);
      const words = capped.split(/\s+/).filter(Boolean).length;

      if (words < map.budgets.thin_page_words) {
        return { status: "thin", words, text: capped, url };
      }
      return { status: "ok", words, text: capped, url };
    } catch {
      if (attempt === 2) return { status: "error", words: 0, text: "", url };
    }
  }
  return { status: "error", words: 0, text: "", url };
}

export function homepageUrl(domain: string): string {
  return `https://${domain}/`;
}
