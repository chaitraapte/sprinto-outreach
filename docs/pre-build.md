# Pre-Build Pack: Sprinto Cold Outreach (Case 02)

The L4 frame: 30 minutes on paper before code. Nine Checks, five pre-build decisions, the Evidence Map (in `evidence_map.yaml`), the Qualification Table and the Components Map. Every answer is meant to be defended.

## 1. The Nine Checks

| # | Check | Answer | Why |
|---|---|---|---|
| 1 | Problem real? (kill) | Yes | Research and writing take 15-20 minutes per company at 8-15 a week; quality drops toward the end of the list because the writer is tired |
| 2 | Workflow repeated? (kill) | Yes | The same research is repeated weekly for every new prospect |
| 3 | Input available? (kill) | Yes | Company websites are public; contacts come from Hunter.io or Apollo |
| 4 | Output valuable? (sizing) | Yes | A qualified lead with a drafted, personalised email is directly usable |
| 5 | Impact measurable? (sizing) | Yes | Time per company, share of emails the Growth Lead rewrites, pipeline conversion |
| 6 | ROI worth it? (sizing) | Yes | Even a modest conversion gain on outbound outweighs the cost: running cost per company is a few paise of model tokens plus one Hunter search |
| 7 | Failure risk OK? (boundary) | Partial | Emails go to my own inbox only, so no real-world risk in this build. Contact data may be stale; the 70% confidence floor refuses to guess |
| 8 | Judgment protected? (boundary) | Partial | I set the ICP rules in `evidence_map.yaml`; the model only extracts facts and drafts. The Growth Lead reviews before any real send |
| 9 | Owner clear? (boundary) | Yes | The Growth Lead owns the output and the decision to send |

**The cut:** checks 7 and 8 land in the Boundary column, so the designed limit of this build is that **no email goes to a real prospect without human review.** The system researches and drafts; the Growth Lead sends.

## 2. Five Pre-Build Decisions

1. **Outcome definition:** reduce research-to-draft time from 15-20 minutes to under 2 minutes per company, for Sprinto's Growth Lead, measured by time-to-draft and share of drafts rewritten.
2. **Workflow change:** the Growth Lead moves from researcher-and-writer to reviewer-and-sender. She supplies the domain list; the system does the rest; she approves before any real send.
3. **Kill criterion:** shut it down if the Growth Lead rewrites more than 50% of emails, or running it takes more time than it saves, or qualification accuracy falls below 60% on a spot-check.
4. **Baseline:** 8-15 companies a week at 15-20 minutes each, manual research and writing, quality inconsistent and dropping toward the end of the list.
5. **Measurement plan (90 days):** time per company under 2 minutes; fewer than 20% of emails rewritten; pipeline conversion holds or improves against the CRM baseline.

## 3. Evidence Map

See `evidence_map.yaml` (gates G0-G4 with question, data, source, sufficient-when, limit, if-unanswered, short-circuit). Worst case per company: 4 page fetches and 2 news searches beyond the homepage, 3 loop iterations.

## 4. Qualification Table

Each parameter is a **gate** (go / no-go) or a **weight**, never both. Where one fact plays two roles in the YAML, it is split into two parameters here.

| Parameter | Data source | Signal | Gate or weight | Value |
|---|---|---|---|---|
| Already a Sprinto customer | `data/existing_customers.json` | domain listed | Gate | Drop |
| B2B SaaS | Homepage, `/pricing`, `/product` | Software sold to a named business buyer | Gate | Drop (not SaaS); manual review (unknown) |
| Out-of-window stage | `/careers`, news, `/about` | Series D+, public, acquired, over 1,000 people, under 15 people | Gate | Drop only on positive evidence |
| Already certified | Footer, `/security`, `/trust` | SOC 2, ISO 27001, GDPR or HIPAA shown as achieved | Gate | Drop |
| Stage confirmed | News, `/careers` | Named Series A, B or C | Weight | 5 |
| Headcount | `/careers`, `/about` | Range overlaps 100-500 (soft) | Weight | 25 or 10 or 0 |
| Audit-pressure signals | `/careers`, `/security`, `/pricing`, news | In-progress cert, open compliance role, new security leader, enterprise tier, questionnaire language, incident in news | Weight | Up to 30 |
| Enterprise customers | `/customers`, homepage | 2+ named logos or enterprise case study | Weight | 20 or 10 |
| Industry | Homepage | Fintech/healthtech, devtools/hrtech, other | Weight | 20 / 12 / 6 |
| Cloud provider | Subprocessors, docs, jobs | AWS, GCP or Azure named | Hook only | 0 |

Unknown handling: hard parameters (B2B SaaS) never get dropped silently when data is missing; they go to a human. Soft parameters are flagged and the company proceeds.

## 5. Components Map

Each block has one job, one input, one output and one named failure behaviour.

| Block | Job | Input | Output | Decides how | On failure |
|---|---|---|---|---|---|
| 1. Fetch | Get one page from the company's own domain | URL | Raw HTML or a status | Code (robots.txt, timeout, domain lock) | Retry twice, then log and move on; blocked pages go to manual review |
| 2. Parse | Read the page structure | Raw HTML | Labelled blocks (heading, paragraph, nav, footer) | Code (cheerio) | Log parse error |
| 3. Clean | Strip navigation, footer, cookie text; dedupe; cap at 2,000 tokens | Labelled blocks | Clean text | Code (rules and heuristics) | Thin page (under 200 words) is flagged `thin_signal` |
| 4. Extract | Fill the named fields | Clean text | Fields JSON, null where unknown | LLM, validated by code | Retry twice, then FAILED |
| 5. Store | Keep the structured output in the shape the next step needs | Fields JSON | Run log object, returned to the UI and downloadable as JSON | Code | Vercel's disk is read-only, so the store is the response plus download; a database is a later upgrade |
| 6. Qualify loop | Apply gates, find missing fields, choose the next source | Fields, budgets | Disposition with evidence | Code applies rules; LLM chooses which page or search | At a cap: manual review |
| 7. Contact | Pick one person | Hunter results | Name, email, tier, score | Code (whole-word title match, tiers, 70% floor) | No match: override file or no email |
| 8. Pains | Two pain points with evidence | Fields, persona | Pains JSON | LLM, validated by code | Inferred pains are labelled |
| 9. Email | Draft and check | Persona, pains, hook | Subject and body with check results | LLM drafts; code checks | One regeneration, then flag |
| 10. Send | Deliver to my own inbox | Approved draft | Send status | Code (SEND_TO asserted) | Retry once; save as `.eml` |

## 6. Where the disqualification logic lives

The gate rules live in `evidence_map.yaml` and run in one function (`lib/qualify.ts`). To change who qualifies, edit the YAML; no code change.
