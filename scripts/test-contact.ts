// Phase 2 check: contact tiering with mocked Hunter data — no network call, no Hunter quota.
// Run with: npx tsx --env-file=.env scripts/test-contact.ts
import { rankCandidates, HunterEmail } from "../lib/contact";

function assert(name: string, cond: boolean) {
  console.log(`${cond ? "PASS" : "FAIL"} — ${name}`);
  if (!cond) process.exitCode = 1;
}

function mk(partial: Partial<HunterEmail>): HunterEmail {
  return {
    value: "x@example.com",
    first_name: "X",
    last_name: "Y",
    position: null,
    department: null,
    confidence: 90,
    verification: { status: "valid" },
    ...partial,
  };
}

// 1. Director-vs-CTO whole-word test: a "Director of Marketing" must NOT match tier 2's "cto".
{
  const emails: HunterEmail[] = [
    mk({ value: "dir@acme.com", position: "Director of Marketing", department: "marketing", confidence: 95 }),
  ];
  const result = rankCandidates(emails, 100);
  assert("Director of Marketing is excluded (not matched as CTO, and marketing dept excluded)", result.length === 0);
}

// 2. A real CTO does match tier 2.
{
  const emails: HunterEmail[] = [mk({ value: "cto@acme.com", position: "CTO", confidence: 95 })];
  const result = rankCandidates(emails, 100);
  assert("Real CTO matches tier 2", result.length === 1 && result[0].tier === 2);
}

// 3. Tier ordering: Head of Security (tier 1) beats CTO (tier 2) when both present.
{
  const emails: HunterEmail[] = [
    mk({ value: "cto@acme.com", position: "CTO", confidence: 95 }),
    mk({ value: "sec@acme.com", position: "Head of Security", confidence: 80 }),
  ];
  const result = rankCandidates(emails, 100);
  assert("Head of Security (tier 1) wins over CTO (tier 2) despite lower confidence", result[0]?.email === "sec@acme.com");
}

// 4. Tier 3 (founder/CEO) is excluded when headcount >= 80.
{
  const emails: HunterEmail[] = [mk({ value: "ceo@acme.com", position: "CEO", confidence: 95 })];
  const bigCo = rankCandidates(emails, 150);
  const smallCo = rankCandidates(emails, 50);
  assert("CEO excluded at headcount 150 (>= 80)", bigCo.length === 0);
  assert("CEO included at headcount 50 (< 80)", smallCo.length === 1);
}

// 5. Minimum confidence 70 — below that, refuse rather than guess.
{
  const emails: HunterEmail[] = [mk({ value: "cto@acme.com", position: "CTO", confidence: 65 })];
  const result = rankCandidates(emails, 100);
  assert("Confidence 65 (< 70) is refused", result.length === 0);
}

// 6. No qualifying contact at all -> empty result (caller falls back to poc_overrides, then NO_POC).
{
  const emails: HunterEmail[] = [mk({ value: "info@acme.com", position: null, confidence: 95 })];
  const result = rankCandidates(emails, 100);
  assert("Generic info@ address with no title produces no candidates", result.length === 0);
}
