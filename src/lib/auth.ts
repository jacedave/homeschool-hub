import type { NextRequest } from "next/server";
import { checkPin, visitorKey, type PinCheck } from "./pinGuard";

export const clientIp = (req: NextRequest) =>
  req.headers.get("x-forwarded-for")?.split(",")[0].trim() || req.headers.get("x-real-ip") || "unknown";

/** True when the server has everything it needs to serve the family's real data. */
export const isConfigured = () => !!process.env.FAMILY_PIN && !!process.env.AIRTABLE_TOKEN && !!process.env.AIRTABLE_BASE_ID;

/** Checks the family PIN sent in the x-family-pin header, counting wrong tries per visitor. */
export function authorizePin(req: NextRequest): Promise<PinCheck> {
  const pin = req.headers.get("x-family-pin") || "";
  return checkPin(visitorKey(clientIp(req)), pin, isConfigured() ? (process.env.FAMILY_PIN as string) : "");
}

export const lockedMessage = (minutes: number) =>
  `Too many wrong PIN tries from this network. Try again in about ${minutes} minute${minutes === 1 ? "" : "s"}.`;
