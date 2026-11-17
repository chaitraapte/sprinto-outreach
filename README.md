# Sprinto Outreach

Cold outreach at scale, for Sprinto. Given a list of company domains, it scrapes the
homepage, decides (with code, not vibes) whether the company fits Sprinto's ICP, finds a
real point of contact, picks two grounded pain points, drafts a short email, and sends it —
with every decision logged so it can be defended afterwards.

The rules (gates, score, contact tiers, budgets, email checks) all live in
[`evidence_map.yaml`](./evidence_map.yaml). The model only extracts facts into named
fields; code applies every rule. [`sprinto-rubrics.md`](./sprinto-rubrics.md) explains and
defends those rules in plain language.

## Running it locally

```bash
npm install
npm run dev
```

Open http://localhost:3000, enter the passcode (from `.env`'s `DEMO_PASSCODE`), paste up to
8 domains (one per line, bare hostnames like `cal.com` — no `https://`, no path), and hit
Run. Click "Try the demo list" to load a pre-picked spread of outcomes.

### Environment variables

Copy `.env.example` to `.env` and fill in:

| Variable | What it's for |
|---|---|
| `HUNTER_API_KEY` | Hunter.io Domain Search, for finding a contact. Use `test-api-key` while developing (free, returns fixed dummy data) — switch to a real key only for the final run, since the free plan is 50 searches/month and this app budgets at most 2 per qualified company. |
| `LLM_API_KEY` | OpenRouter API key. |
| `LLM_BASE_URL` | `https://openrouter.ai/api/v1` |
| `LLM_MODEL` | `google/gemini-2.5-flash-lite` — cheap, fast, supports JSON output and tool calling. |
| `GMAIL_ADDRESS` | The Gmail address the app sends *from*. |
| `GMAIL_APP_PASSWORD` | A Gmail [app password](https://myaccount.google.com/apppasswords) for that address (not your normal password). |
| `SEND_TO` | Where every email actually goes. Hardcoded server-side — the browser can never change it, no matter what it sends in the request. |
| `DEMO_PASSCODE` | Required on every `/api/run` call via the `x-passcode` header, since this app will be hosted publicly. |

### Manual contact overrides

If Hunter finds no one who qualifies, the app falls back to `data/poc_overrides.json`:

```json
{
  "acme.com": { "email": "jane@acme.com", "position": "Head of Security", "firstName": "Jane" }
}
```

Key = domain. One entry per domain you've manually looked up (e.g. via Apollo or LinkedIn).
If a domain has no override either, the result is `NO_POC` and no email is drafted.

## How it works

Seven steps, one module per step in `lib/`:

1. **`scrape.ts`** — fetches the homepage (and later, other pages), respects `robots.txt`,
   strips nav/footer/cookie noise, caps at 2,000 cleaned tokens.
2. **`extract.ts`** — the LLM extracts facts into the fields named in `evidence_map.yaml`.
   Missing facts stay `null`; the model never guesses.
3. **`qualify.ts` + `loop.ts`** — code evaluates the four gates (G1–G4) in order. For any
   gate still unresolved, the model picks **one** tool call (`fetch_page` or `search_news`)
   to try to resolve it; code enforces the budgets (4 fetches, 2 news searches, 3
   iterations) and rejects anything outside the rules. Produces a disposition
   (`QUALIFIED` / `QUALIFIED_FLAGGED` / `DROPPED` / `MANUAL_REVIEW` / `FAILED`) and a 0–100
   score for ordering only.
4. **`contact.ts`** — Hunter Domain Search, filtered first then unfiltered, whole-word title
   matching, tiers, hard excludes, min confidence 70.
5. **`pains.ts`** — exactly two pain points, each grounded in a verbatim quote from the
   scraped text where possible, else a persona default.
6. **`email.ts`** — drafts the email, then runs every check from `evidence_map.yaml`
   (word counts, grounded hook, banned words, G2/G4-aware phrasing). One regeneration on
   failure, then flagged.
7. **`send.ts`** — nodemailer over Gmail SMTP, to `SEND_TO` only, asserted before every send.
   `dryRun` builds the `.eml` without sending.

`pipeline.ts` orchestrates all seven and builds the run log returned by `/api/run` — this
app never writes to disk (Vercel's filesystem is read-only), so the full log is returned in
the API response and shown in the UI.

## Deploying on Vercel

1. Import this repo from the Vercel dashboard.
2. Add these environment variables in Project Settings → Environment Variables:
   `HUNTER_API_KEY`, `LLM_API_KEY`, `LLM_BASE_URL`, `LLM_MODEL`, `GMAIL_ADDRESS`,
   `GMAIL_APP_PASSWORD`, `SEND_TO`, `DEMO_PASSCODE`.
3. Deploy. The `/api/run` route runs on the Node runtime with `maxDuration = 120` (Hobby
   plan allows up to 300s).

No build step or database is required — everything is stateless per request, with an
in-memory cache that only lives for the life of one serverless instance.

## Security

- Every `/api/run` call requires the `x-passcode` header to match `DEMO_PASSCODE`, else 401.
- `SEND_TO` is read server-side only; the request body can never set or override it.
- Domains are validated server-side: bare hostnames only (no scheme/path/port), and
  private/loopback/localhost hosts are rejected (SSRF guard).
- `fetch_page` only ever fetches the company's own domain, and respects `robots.txt`.
- A batch is capped at 8 domains; Hunter is only called for companies that already passed
  their gates.
- No secrets are hardcoded; everything comes from `process.env`, and `.env` is gitignored.
