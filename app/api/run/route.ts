import { NextRequest, NextResponse } from "next/server";
import { validateDomain } from "@/lib/validate";
import { runDomain } from "@/lib/pipeline";

export const runtime = "nodejs";
export const maxDuration = 120;

export async function POST(req: NextRequest) {
  const passcode = req.headers.get("x-passcode");
  if (!passcode || passcode !== process.env.DEMO_PASSCODE) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  let body: any;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid JSON body" }, { status: 400 });
  }

  const { domain, send, dryRun } = body ?? {};
  const validated = validateDomain(String(domain ?? ""));
  if (!validated.ok) {
    return NextResponse.json({ error: `invalid domain: ${validated.reason}` }, { status: 400 });
  }

  const log = await runDomain(validated.domain, Boolean(send), dryRun !== false);
  return NextResponse.json(log);
}
