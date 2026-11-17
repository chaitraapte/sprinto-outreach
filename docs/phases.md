# Build phases

0. **Setup** — Next.js app scaffolded in place, deps installed, evidence_map.yaml loader, smoke tests (Hunter /v2/account, one LLM call). Done when both pass.
1. **Steps 1-3 (scrape, extract, qualify)** — one domain end to end through `/api/run`, including the agent loop and all four gates. Done when cal.com returns a disposition with gate evidence and thoughtworks.com drops at G1 with no Hunter/email call.
2. **Steps 4-5 (contact, pains)** — contact tiers, whole-word title match, Director-vs-CTO test, no-qualifying-contact case, two pains with evidence.
3. **Steps 6-7 (email, send)** — dryRun first, then one real send to SEND_TO. Done when all email checks pass and the email lands in the inbox.
4. **UI + batch** — one page, passcode, demo domain list, progress, summary table, expandable run-log cards, phone width, design checker.
5. **Security pass, README, docs/defence.md, git commit.**
