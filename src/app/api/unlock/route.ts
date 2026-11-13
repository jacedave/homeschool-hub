import { NextRequest, NextResponse } from "next/server";
import { tryUnlock, visitorKey } from "@/lib/pinGuard";
import { clientIp, isConfigured } from "@/lib/auth";

/**
 * Used by the demo screen to connect to the family's data. Three wrong PINs lock this visitor out
 * for 15 minutes, enforced here so clearing the browser's storage doesn't reset it.
 */
export async function POST(req: NextRequest) {
  const body = (await req.json().catch(() => ({}))) as { pin?: unknown };
  const pin = typeof body.pin === "string" ? body.pin.slice(0, 200) : "";
  if (!pin) return NextResponse.json({ error: "Enter the PIN." }, { status: 400 });

  const result = await tryUnlock(visitorKey(clientIp(req)), pin, isConfigured() ? (process.env.FAMILY_PIN as string) : "");

  if (result.status === "ok") return NextResponse.json({ ok: true });
  if (result.status === "locked") return NextResponse.json({ error: "locked", minutes: result.minutes }, { status: 429 });
  return NextResponse.json({ error: "wrong", triesLeft: result.triesLeft }, { status: 401 });
}
