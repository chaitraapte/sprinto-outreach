# Sprinto Cold Outreach: Our Rubrics

Adapted from the reference doc "Sprinto Cold Outreach: ICP & Shortlisting Criteria", then changed where it conflicts with the L4 deck or the case brief (see section 9). The machine-readable version is `evidence_map.yaml`; this file explains and defends it.

## 1. The ICP in one line

A **Series A-C B2B SaaS company (typically 100+ people, a soft signal), with audit pressure, that is not already certified and not already a Sprinto customer.** Sprinto's wedge is the window where compliance is urgent but there is no GRC team yet: too early for a Big Four firm, too late to ignore.

## 2. Four gates, cheapest first

Any gate that fails drops the company; nothing downstream runs (no Hunter search, no draft).

| Gate | Passes when | Fails when | Unresolved after budget |
|---|---|---|---|
| **G0 Not already a Sprinto customer** | Domain is not in `data/existing_customers.json` | Domain is in the list | Pass (costs nothing) |
| **G1 B2B SaaS** | Product is software sold to a named business buyer | Agency, services, D2C, hardware | `manual_review` |
| **G2 Stage window** | Series A, B or C named; or two of: 5+ open roles, enterprise tier or logos, headcount 50-200 | **Positive** evidence it is outside the window: Series D+, public, acquired, over 1,000 people, under 15 people | Qualify and flag ("stage unknown") |
| **G3 Not already certified** | No SOC 2, ISO 27001, GDPR or HIPAA shown as **achieved** | An achieved cert is shown | Assume not certified and flag |
| **G4 Audit pressure** | "In progress" cert statement, an open security or compliance role, an enterprise tier with no cert, or security-questionnaire language | Never fails | Qualify and flag; email asks a question instead of asserting |

G4 is the only gate allowed to stay unknown. If the homepage, careers page, security page and one news search can't settle it, the company can still be a real buyer, so we write to them but ask rather than tell.

**The trap in G3.** "SOC 2 in progress", "working toward ISO 27001" and "coming soon" are the best buying signals. The extractor splits `certs_held` (achieved) from `certs_in_progress`. Only `certs_held` disqualifies.

**Decision rule**

| Outcome | When |
|---|---|
| `QUALIFIED` | G1-G4 all pass |
| `QUALIFIED_FLAGGED` | G1 passes, nothing fails, and G2, G3 or G4 is unresolved. The flag names which |
| `DROPPED` | Any gate fails. The run log names the gate and the evidence |
| `MANUAL_REVIEW` | G1 unresolved, or a budget cap is hit before G1 settles |
| `FAILED` | Fetch, LLM or Hunter error. Logged and queued; the batch continues |

## 3. Score (0-100): ordering only, never a gate

| Signal | Points | Rule |
|---|---|---|
| G4 pressure strength (cap 30) | 15 / 10 / 10 / 5 / 5 | "In progress" cert 15; open compliance role 10; new CISO or compliance head announced 10; enterprise tier or questionnaire language 5; security incident in the news 5 (internal only: **never mentioned in the email**) |
| S1 headcount (soft) | 25 | Range overlaps 100-500 = 25; 50-99 or 501-1,000 = 10; unknown = 0 and flagged. Never a drop |
| S2 enterprise customers | 20 | 2+ recognisable logos or an enterprise case study = 20; clearly selling US/EU only = 10 |
| S3 industry | 20 / 12 / 6 | Fintech or healthtech 20; devtools or hrtech 12; other 6 |
| S4 funding confirmed | 5 | Named Series A-C |
| Cloud provider | 0 | Hook only: "your AWS environment" makes the email feel researched but doesn't predict buying |

Bands: **70 and above** = send first; **40-69** = standard; **below 40** = drafted but marked for human review.

## 4. The agent loop (step 3)

1. Extract facts from the homepage into the named fields.
2. **Code** checks which fields each unresolved gate needs. The model never decides whether it "knows enough".
3. For the first unresolved gate, call one tool, and re-extract. Repeat.
4. Stop when all gates are settled, a short-circuit fires, or a budget is hit.

**Budgets, enforced in code:** 4 page fetches beyond the homepage, 2 news searches, 3 loop iterations, 2,000 cleaned tokens per page. Responses are cached in memory for the life of the server instance (Vercel's disk is read-only), so repeated clicks on the same domain are cheap but a cold start forgets them.

**Tool descriptions** (L6's four rules: what, when, when not, returns):

- `fetch_page(url)`: Fetches one page on the company's **own domain** and returns cleaned main text (navigation, footer and cookie text removed, 2,000 token cap). Use when a gate field is missing and a specific page should hold it (`/careers`, `/pricing`, `/customers`, `/security`, `/trust`). Do not use for other domains, for pages blocked by robots.txt, or to re-fetch a page already in cache. Returns `{status, words, text}` or `{status: blocked|not_found|thin}`.
- `search_news(query)`: Searches Google News (RSS) for recent headlines about the company. Use only to confirm a funding round or a certification announcement that the company's own site did not state. Do not use for contact details, for general research, or more than twice per company. Returns up to 5 `{title, source, date}` items, or an empty list.

## 5. Choosing the person (step 4)

Hunter Domain Search first (free tier: 25 searches a month, at most 10 emails per call, counted only when results return). Fall back to `poc_overrides.json` (manual Apollo lookups).

| Tier | Titles | Applies when |
|---|---|---|
| 1 | Head of Security, CISO, Compliance Lead, GRC Lead, Head of Compliance, Director of Compliance, Chief Compliance Officer (CCO), Head of Information Security | Always |
| 2 | CTO, VP Engineering, Head of Engineering | Always |
| 3 | CEO, Co-founder, Founder | Only if headcount is under 80 or unknown |

- Highest tier wins, then highest confidence, then `valid` verification. **Minimum confidence 70.** Below that, or with no tier match, the pipeline refuses to send rather than guess.
- **Match whole words, not substrings.** "cto" is inside "Dire**cto**r", so a substring match would send a cold email to every Director of Marketing.
- Hard excludes: generic addresses (`info@`, `support@`), HR, sales, marketing, support, finance and legal departments, and titles with intern, assistant, associate, coordinator, recruiter, advisor, former or board.
- Why tier 3 is restricted: at over 80 people the CEO is shielded by a team; at fewer, they read their own inbox.
- Because free Hunter returns only 10 emails, try a filtered query first (`seniority=senior,executive`, `department=executive,it,management`), then one unfiltered query. Maximum 2 searches per domain.
- Log the top 3 candidates and why the winner won.

## 6. Pain points (step 5)

Exactly two per person. Each has `pain`, `evidence_quote` (from scraped text) and `why_this_persona`. A pain with no evidence is marked `inferred` and may only come from the persona defaults:

| Persona | Defaults |
|---|---|
| Security or compliance | Manual evidence collection across tools; staying continuously audit-ready |
| CTO or engineering | Engineers pulled off the roadmap for audit evidence; enterprise security questionnaires slowing deals |
| CEO or founder | Enterprise deals stalling on security review; audit becoming a distraction from growth |

## 7. The email (step 6)

Code-checked before send; one regeneration on failure, then flagged:

- Addressed by first name; no placeholder text
- 120 words or fewer; subject 8 words or fewer; exactly one ask (a short call)
- **The hook is grounded:** the `hook_source` string must appear verbatim in the scraped text (a job post, a product line, a named customer, the cloud provider). Funding news alone is not a hook.
- G4 unknown: the hook is a question, not an assertion. G2 unknown: no mention of funding or stage.
- No invented statistics, no claims about anything that was not scraped, no banned words (revolutionise, seamless, supercharge, game-changing, leverage, synergy)

## 8. Send (step 7) and the run log

`to:` is hardcoded to your own address and asserted before sending. `DRY_RUN=1` writes the `.eml` without sending. The subject includes the company name so batch emails are distinguishable.

Every domain returns a run log (shown in the UI and downloadable as JSON, since a hosted app can't write files): fetches, extracted facts, loop iterations with the field each fetch was for, gate-by-gate verdicts with evidence, score breakdown, Hunter candidates with scores, pains with evidence, email check results, send status. A summary table across the run is generated at the end. This is what lets you defend every decision.

## 9. Where this differs from the reference, and why

1. **Unknown stage no longer drops a company.** The reference drops on G2 unresolved, which is why it lost warp.dev: the company had raised a Series B but the news search was ambiguous. L4's Evidence Map says stage unanswered means qualify at lower rank, flagged. We drop only on positive evidence the company is outside the window.
2. **Funding can be inferred.** A named round is the strong signal; two of (5+ open roles, enterprise tier, 50-200 headcount) also passes. Scraped sites rarely state rounds.
3. **We added the "already certified" gate (G3).** The reference never tests it, but it is the first short-circuit in L4's Sprinto Evidence Map: a company that already has SOC 2 has no reason to buy.
4. **G4 pressure strength is now scored.** The reference gave G3 pass/unknown only, so an "in progress" cert scored the same as a vague enterprise tier.
5. **Title matching is whole-word,** to stop "cto" matching "Director".
6. **G1 unresolved goes to a human** rather than being silently dropped, per L4.
7. **Score bands defined.** The reference printed 43/100 with no meaning attached.
8. **The reference's worked example** (cal.com, Clay and others) is that author's run. We do not reuse it; ours is generated by your own runs.

## 10. Expected spread on the demo batch

Pick 5-6 domains so the run shows the system saying no for different reasons: one clean `QUALIFIED`, one `QUALIFIED_FLAGGED`, one dropped at G1 (services firm), one dropped at G2 (too late), one dropped at G3 (already certified), and one thin-homepage company that triggers the loop. Domain choices come with the build prompt.

## 11. Deployment on Vercel

- **Stack:** Next.js (App Router, TypeScript) with API routes on the Node runtime. Vercel's free plan allows functions up to 300 seconds, so one domain per request (about 30-90 seconds) is safe. A batch is the browser calling `/api/run` once per domain, in sequence, with a progress list.
- **No headless browser, no disk.** A thin or JavaScript-only homepage is logged as `thin_signal`; the loop tries other pages, and if signal is still missing the company goes to `MANUAL_REVIEW`. The run log is returned in the response, not written to a file.
- **The URL is public, so it is protected.** Every API call needs `DEMO_PASSCODE`. `SEND_TO` is read server-side from the environment and can never be set by the request. Domains per batch are capped at 8, and Hunter is never called for a company that has not passed its gates, because that is your 25-searches-a-month budget.
- **Secrets** live in Vercel environment variables, never in the repo or in front-end code.
- **Pages:** one input page (paste domains, enter the passcode, run), and one results view per company showing gate verdicts with evidence, score, contact choice, the drafted email, send status and the full log.
