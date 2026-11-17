# Defence: what the system decided, and why

Run against the demo list with `HUNTER_API_KEY` set to a real (free-tier) key, model
`google/gemini-2.5-flash-lite`. Full run logs are in the app's "Download JSON" button per
domain; this is the plain-language version.

## cal.com — `QUALIFIED_FLAGGED`, score 26 (low, flagged)

- **G1 (B2B SaaS): pass.** Homepage names the buyer ("teams") and describes a scheduling
  product.
- **G2 (stage window): unresolved** ("stage unknown"). No funding round is named anywhere
  on the site, and the loop spent its full budget (`/careers`, `/company`, `/customers`)
  without finding headcount or open-roles numbers — `/careers` was JS-rendered and came
  back thin. Per the rubric, unresolved stage doesn't fail the company; it qualifies at
  lower rank with a flag, and the email is written not to mention funding.
- **G3 (not certified): pass.** No achieved certification found.
- **G4 (audit pressure): unresolved.** No compliance job posting, enterprise tier, or
  questionnaire language found on the pages fetched.
- **Contact: `NO_POC`.** Hunter (real key, free tier) returned no email for cal.com, and
  there's no manual override on file — so no email was drafted. This is the system
  correctly refusing to send rather than guessing.
- **Cost:** 1 homepage fetch + 3 loop page fetches, 4 LLM extraction calls, 1 Hunter search
  (returned 0 usable candidates), 0 email drafts (none attempted — no contact).

## hasura.io — `QUALIFIED_FLAGGED`, score 17 (low, flagged) — **sent**

- **G1: pass** (buyer named). **G2: unresolved** ("stage unknown") — same reasoning as
  cal.com, the loop couldn't find a round or enough inferred signals within budget.
- **G3: pass** (no held cert). **G4: pass** — an in-progress certification or compliance
  signal was found, which is the strongest kind of G4 evidence.
- **Contact:** Hunter found `rajoshi@hasura.io`, tier-matched and above the 70-confidence
  floor — winner.
- **Email:** 8/8 checks passed on the first draft (no regeneration needed). Hook was
  grounded in a verbatim site quote about Hasura's AI focus. **Sent** to the inbox.
- **Cost:** 1 homepage fetch (thin — 103 words, triggered the loop) + 3 loop fetches, 1
  Hunter search (returned a usable candidate), 1 email draft (passed first try).

## zluri.com — `DROPPED` at G3

- **G1: pass.** **G2: unresolved.**
- **G3 (not already certified): fail.** The site states SOC 2 as *achieved*, not
  in-progress — this is exactly the short-circuit G3 exists for (see `sprinto-rubrics.md`
  §2): a company that already has SOC 2 has no reason to buy. Dropped before any Hunter
  call or email draft.
- **Cost:** 1 homepage fetch + 3 loop fetches (still exploring G2 before G3's fail was
  computed — the loop tries the *first* unresolved gate each iteration, and G2 sorted
  before G3 was settled), 0 Hunter calls, 0 emails.

## thoughtworks.com — `DROPPED` at G2

- **G1: pass** (buyer named "clients" — plausible but this is in fact a services
  consultancy, which the homepage text didn't state clearly enough for the model to flag
  as non-SaaS).
- **G2 (stage window): fail.** `headcount_low = 10000`, over the 1,000-person ceiling —
  positive evidence the company is well outside the ICP window, regardless of what G1
  said. This is the gate design working as intended: even if an earlier gate under-reacts,
  a later one catches the real disqualifier.
- Dropped before G3/G4 evaluation, before any Hunter call or email draft.
- **Note:** our build brief hypothesized ThoughtWorks would drop at G1 (services firm).
  It didn't — the homepage text is dominated by a country/locale picker menu, which starved
  the extractor of a clean signal for `is_saas`. It still correctly dropped, just at G2
  instead. We did not retune the gates to force a G1 drop — the rule is "report what
  actually happens," not "match the hypothesis."

## hubspot.com — `QUALIFIED_FLAGGED`, score 31 (low, flagged) — **sent**

- **G1: pass. G2: unresolved** ("stage unknown" — no round named, and HubSpot being public
  wasn't stated clearly enough on the pages fetched for the model to flag `funding_stage =
  public`). **G3: pass. G4: pass** (enterprise tier with no held cert, or similar pressure
  signal).
- **Note:** our build brief hypothesized HubSpot would drop at G2 for being public. It
  qualified-flagged instead, because our extractor never saw an explicit "public company"
  statement on the pages it fetched — a real limitation of homepage-only scraping, reported
  as it happened rather than patched to match the guess.
- **Contact:** Hunter found `dshah@hubspot.com`. **Email:** 8/8 checks passed, **sent**.
- **Cost:** 1 homepage fetch + 3 loop fetches, 1 Hunter search, 1 email draft (passed first
  try).

## drata.com — `MANUAL_REVIEW`

- The homepage returned HTTP 403 (bot/Cloudflare protection). Per the failure policy in
  `evidence_map.yaml`, a 403/robots-blocked site is never bypassed — it's handed to a human
  instead. No gates were evaluated, no Hunter call, no email.
- **Note:** our build brief hypothesized Drata would drop at G2 or G3. We couldn't even
  read the homepage, so no gate ran at all — a more conservative (and more honest) outcome
  than guessing.

## Totals across the batch

| | |
|---|---|
| Domains run | 6 |
| Hunter searches used | 3 of 50/month available (well under the 10-search budget) |
| Emails sent | 2 (hasura.io, hubspot.com) |
| Dropped | 2 (zluri.com at G3, thoughtworks.com at G2) |
| Manual review | 1 (drata.com, blocked) |
| Qualified-flagged with no contact found | 1 (cal.com, NO_POC) |

Two real bugs were found and fixed while building this, both visible in the above run:

1. **Loop retried the same 404'd page three times** instead of trying alternate candidate
   pages for a gate (e.g. `/pricing` → `/product` → `/about` for G1). Fixed by giving each
   gate a short list of candidate pages instead of one fixed default.
2. **One malformed field from the LLM (e.g. a list where a single string was expected)
   silently discarded the entire extraction**, because the whole object was validated by one
   strict schema. Fixed with a coercion step that sanitizes individual fields before
   validation, so one wrong type doesn't erase everything else the model got right.
3. **A 403/Cloudflare block was being treated as a hard failure (`FAILED`)** instead of the
   "don't bypass, hand to a human" (`MANUAL_REVIEW`) the failure policy calls for. Fixed by
   mapping 403/503 to the same "blocked" status as a robots.txt disallow.
