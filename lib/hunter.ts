const HUNTER_BASE = "https://api.hunter.io/v2";

export async function hunterAccountCheck(): Promise<{ ok: boolean; status: number }> {
  const key = process.env.HUNTER_API_KEY || "test-api-key";
  const res = await fetch(`${HUNTER_BASE}/account?api_key=${encodeURIComponent(key)}`);
  return { ok: res.ok, status: res.status };
}
