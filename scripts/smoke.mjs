// Phase 0 smoke tests: one Hunter call (account endpoint, no quota cost) and
// one one-line LLM call. Run with: node --env-file=.env scripts/smoke.mjs
import OpenAI from "openai";

async function hunterSmoke() {
  const key = process.env.HUNTER_API_KEY || "test-api-key";
  const res = await fetch(`https://api.hunter.io/v2/account?api_key=${encodeURIComponent(key)}`);
  console.log("Hunter /v2/account status:", res.status, res.ok ? "OK" : "FAIL");
  return res.ok || res.status === 401; // test-api-key can legitimately 401 — reachability is what matters
}

async function llmSmoke() {
  const client = new OpenAI({ apiKey: process.env.LLM_API_KEY, baseURL: process.env.LLM_BASE_URL });
  const res = await client.chat.completions.create({
    model: process.env.LLM_MODEL,
    messages: [{ role: "user", content: "Reply with exactly: pong" }],
    max_tokens: 10,
  });
  const text = res.choices[0]?.message?.content?.trim();
  console.log("LLM reply:", JSON.stringify(text));
  return Boolean(text);
}

const [hunterOk, llmOk] = await Promise.all([hunterSmoke(), llmSmoke()]);
console.log("Hunter smoke:", hunterOk ? "PASS" : "FAIL");
console.log("LLM smoke:", llmOk ? "PASS" : "FAIL");
if (!hunterOk || !llmOk) process.exit(1);
