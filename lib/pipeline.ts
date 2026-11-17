import { loadEvidenceMap } from "./config";
import { fetchPage, homepageUrl } from "./scrape";
import { runAgentLoop } from "./loop";
import { decide, computeScore, Disposition, GateResult } from "./qualify";
import { pickContact, ContactResult } from "./contact";
import { pickPains, Pain } from "./pains";
import { draftAndCheckEmail, EmailOutcome } from "./email";
import { sendEmail, SendResult } from "./send";

export interface RunLog {
  domain: string;
  companyName: string;
  reasoning: string[];
  scrape: { status: string; words: number } | null;
  loopSteps: any[];
  gates: GateResult[];
  disposition: Disposition;
  droppedAtGate?: string;
  flags: string[];
  score: number;
  band: string;
  contact: ContactResult | null;
  pains: Pain[] | null;
  email: EmailOutcome | null;
  send: SendResult | null;
  error?: string;
}

function companyNameFromDomain(domain: string): string {
  const base = domain.replace(/^www\./, "").split(".")[0];
  return base.charAt(0).toUpperCase() + base.slice(1);
}

export async function runDomain(domain: string, shouldSend: boolean, dryRun: boolean): Promise<RunLog> {
  const companyName = companyNameFromDomain(domain);
  const reasoning: string[] = [];
  const log: RunLog = {
    domain,
    companyName,
    reasoning,
    scrape: null,
    loopSteps: [],
    gates: [],
    disposition: "FAILED",
    flags: [],
    score: 0,
    band: "low_flagged",
    contact: null,
    pains: null,
    email: null,
    send: null,
  };

  try {
    reasoning.push(`Fetching homepage for ${domain}.`);
    const homepage = await fetchPage(homepageUrl(domain), domain);
    log.scrape = { status: homepage.status, words: homepage.words };

    if (homepage.status === "blocked") {
      reasoning.push("Site is blocking us (robots.txt, 403, or a Cloudflare challenge) — not bypassing. Sending to manual review.");
      log.disposition = "MANUAL_REVIEW";
      log.flags = ["blocked by robots.txt, 403, or bot protection"];
      return log;
    }
    if (homepage.status === "error") {
      reasoning.push("Homepage fetch failed (timeout/network/4xx/5xx).");
      log.disposition = "FAILED";
      log.error = "fetch_error";
      return log;
    }
    if (homepage.status === "thin") {
      reasoning.push(`Homepage is thin (${homepage.words} words) — logging thin_signal, loop will try other pages.`);
    }

    reasoning.push("Extracting facts, then running the gate-driven agent loop for anything still missing.");
    const { facts, gates, steps, capHit } = await runAgentLoop(domain, companyName, homepage);
    log.loopSteps = steps;
    log.gates = gates;

    const { disposition, droppedAtGate, flags } = decide(gates, capHit);
    log.disposition = disposition;
    log.droppedAtGate = droppedAtGate;
    log.flags = flags;

    const g4 = gates.find((g) => g.gate === "G4")!;
    const { score, band } = computeScore(facts, g4);
    log.score = score;
    log.band = band;

    reasoning.push(`Disposition: ${disposition}${droppedAtGate ? ` (at ${droppedAtGate})` : ""}. Score ${score}/100 (${band}).`);

    if (disposition !== "QUALIFIED" && disposition !== "QUALIFIED_FLAGGED") {
      return log;
    }

    reasoning.push("Qualified — looking up a point of contact via Hunter.");
    const contact = await pickContact(domain, facts.headcount_high);
    log.contact = contact;

    if (!contact.winner) {
      reasoning.push("No contact qualifies (NO_POC) — no email will be drafted.");
      return log;
    }
    reasoning.push(`Contact chosen: ${contact.winner.email} (${contact.winner.position}, tier ${contact.winner.tier}).`);

    reasoning.push("Picking two pain points grounded in the scraped text.");
    const pains = await pickPains(facts, homepage.text, contact.winner);
    log.pains = pains;

    const g4Unresolved = g4.verdict === "unresolved";
    const g2Unresolved = gates.find((g) => g.gate === "G2")!.verdict === "unresolved";

    reasoning.push("Drafting the email and running the checks from evidence_map.yaml.");
    const emailOutcome = await draftAndCheckEmail(companyName, domain, contact.winner, pains, g4Unresolved, g2Unresolved, homepage.text);
    log.email = emailOutcome;
    reasoning.push(`Email checks: ${emailOutcome.checks.filter((c) => c.passed).length}/${emailOutcome.checks.length} passed${emailOutcome.regenerated ? " (after one regeneration)" : ""}.`);

    if (shouldSend && emailOutcome.draft) {
      reasoning.push(dryRun ? "Dry run — building .eml, not sending." : "Sending via Gmail to SEND_TO.");
      log.send = await sendEmail(companyName, emailOutcome.draft, dryRun);
      reasoning.push(`Send result: ${log.send.status} — ${log.send.detail}`);
    }

    return log;
  } catch (err) {
    log.disposition = "FAILED";
    log.error = (err as Error).message;
    reasoning.push(`FAILED: ${(err as Error).message}`);
    return log;
  }
}
