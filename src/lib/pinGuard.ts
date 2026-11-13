import { createHash, timingSafeEqual } from "crypto";

/**
 * Server-side limit on PIN guesses made from the demo screen. Attempts are counted per visitor
 * address (stored only as a hash), saved in an optional "PinGuard" Airtable table so the count
 * survives server restarts, with an in-memory copy as a fallback if that table doesn't exist.
 */

export const MAX_TRIES = 3;
export const LOCKOUT_MS = 15 * 60 * 1000;
/** Old failures are forgotten after this long without a new one. */
const FORGET_AFTER_MS = 60 * 60 * 1000;

interface Guard {
  count: number;
  lockedUntil: number;
  updated: number;
  recordId?: string;
}

const memory = new Map<string, Guard>();
/** Airtable row for each visitor, and creations still in flight (so quick saves update one row instead of making several). */
const recordIds = new Map<string, string>();
const creating = new Map<string, Promise<string | undefined>>();
/** Short-lived copy so ordinary requests don't each read Airtable. */
const cache = new Map<string, { g: Guard; at: number }>();
const CACHE_MS = 3_000;
/** The last wrong PIN seen from each visitor, so a device repeating the same stale PIN isn't counted over and over. */
const lastWrong = new Map<string, { hash: string; at: number }>();
const REPEAT_WINDOW_MS = 2 * 60 * 1000;
const fresh = (): Guard => ({ count: 0, lockedUntil: 0, updated: 0 });

const BASE = () => `${process.env.AIRTABLE_API_URL || "https://api.airtable.com"}/v0/${process.env.AIRTABLE_BASE_ID}/PinGuard`;
const headers = () => ({ Authorization: `Bearer ${process.env.AIRTABLE_TOKEN}`, "Content-Type": "application/json" });

/** A hash of the visitor's address, so the table never holds a raw IP. */
export function visitorKey(ip: string): string {
  return createHash("sha256").update(`${ip}|${process.env.FAMILY_PIN || ""}`).digest("hex").slice(0, 32);
}

async function load(key: string): Promise<Guard> {
  try {
    const res = await fetch(`${BASE()}?maxRecords=5&filterByFormula=${encodeURIComponent(`{Key}='${key}'`)}`, { headers: headers(), cache: "no-store", signal: AbortSignal.timeout(6000) });
    if (!res.ok) throw new Error(`PinGuard ${res.status}`);
    const data = (await res.json()) as { records: { id: string; fields: Record<string, unknown> }[] };
    const rows = data.records.filter((r) => r.fields.Key === key);
    if (!rows.length) return memory.get(key) ?? fresh();
    // If duplicates ever exist, an active lockout wins, otherwise the most recently updated row.
    const now = Date.now();
    const locked = rows.filter((r) => Number(r.fields.LockedUntil || 0) > now);
    const pool = locked.length ? locked : rows;
    const rec = pool.reduce((best, r) => (Number(r.fields.Updated || 0) >= Number(best.fields.Updated || 0) ? r : best));
    recordIds.set(key, rec.id);
    return { recordId: rec.id, count: Number(rec.fields.Count || 0), lockedUntil: Number(rec.fields.LockedUntil || 0), updated: Number(rec.fields.Updated || 0) };
  } catch {
    return memory.get(key) ?? fresh(); // table missing or Airtable busy
  }
}

async function loadCached(key: string): Promise<Guard> {
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < CACHE_MS) return hit.g;
  const g = await load(key);
  cache.set(key, { g, at: Date.now() });
  return g;
}

async function save(key: string, g: Guard): Promise<void> {
  const next = { ...g, recordId: g.recordId ?? recordIds.get(key) };
  memory.set(key, next);
  cache.set(key, { g: next, at: Date.now() });
  try {
    const fields = { Key: key, Count: g.count, LockedUntil: g.lockedUntil, Updated: g.updated };
    const write = (id: string | undefined) =>
      fetch(id ? `${BASE()}/${id}` : BASE(), {
        method: id ? "PATCH" : "POST",
        headers: headers(),
        body: JSON.stringify({ fields, typecast: true }),
        signal: AbortSignal.timeout(6000),
      });

    let id = next.recordId;
    if (!id && creating.has(key)) id = await creating.get(key); // another save is creating the row: wait, then update it
    if (id) {
      await write(id);
      return;
    }
    const creation = (async () => {
      const res = await write(undefined);
      if (!res.ok) return undefined;
      const created = ((await res.json()) as { id: string }).id;
      recordIds.set(key, created);
      memory.set(key, { ...(memory.get(key) as Guard), recordId: created });
      cache.set(key, { g: { ...next, recordId: created }, at: Date.now() });
      return created;
    })();
    creating.set(key, creation);
    try {
      await creation;
    } finally {
      creating.delete(key);
    }
  } catch {
    // The in-memory copy still applies.
  }
}

function samePin(a: string, b: string): boolean {
  const x = Buffer.from(a);
  const y = Buffer.from(b);
  return x.length === y.length && timingSafeEqual(x, y);
}

export type UnlockResult =
  | { status: "ok" }
  | { status: "wrong"; triesLeft: number }
  | { status: "locked"; minutes: number };

/** Checks a PIN typed on the demo screen, counting wrong tries and locking out after too many. */
export async function tryUnlock(key: string, pin: string, expected: string): Promise<UnlockResult> {
  const now = Date.now();
  let g = await load(key);
  if (g.lockedUntil > now) return { status: "locked", minutes: Math.max(1, Math.round((g.lockedUntil - now) / 60000)) };
  // A finished lockout, or very old failures, start the count over.
  if (g.lockedUntil || now - g.updated > FORGET_AFTER_MS) g = { ...g, count: 0, lockedUntil: 0 };

  if (expected && samePin(pin, expected)) {
    if (g.count || g.lockedUntil) await save(key, { ...g, count: 0, lockedUntil: 0, updated: now });
    return { status: "ok" };
  }

  const count = g.count + 1;
  if (count >= MAX_TRIES) {
    await save(key, { ...g, count: 0, lockedUntil: now + LOCKOUT_MS, updated: now });
    return { status: "locked", minutes: Math.round(LOCKOUT_MS / 60000) };
  }
  await save(key, { ...g, count, lockedUntil: 0, updated: now });
  return { status: "wrong", triesLeft: MAX_TRIES - count };
}

export type PinCheck = { status: "ok" | "none" | "wrong" } | { status: "locked"; minutes: number };

/**
 * Checks the PIN sent with an ordinary request. No PIN means a demo visitor (never counted or blocked).
 * A wrong PIN counts toward the same limit as the demo screen's unlock, and once a visitor is locked
 * out every request that carries a PIN is refused, including the right one.
 * Repeating the same wrong PIN (a device with an out-of-date saved PIN) is only counted once.
 */
export async function checkPin(key: string, pin: string, expected: string): Promise<PinCheck> {
  if (!pin || !expected) return { status: "none" };
  const now = Date.now();
  let g = await loadCached(key);
  if (g.lockedUntil > now) return { status: "locked", minutes: Math.max(1, Math.round((g.lockedUntil - now) / 60000)) };
  if (samePin(pin, expected)) return { status: "ok" };

  // Decided without waiting, so two requests sent together with the same wrong PIN count once.
  const hash = createHash("sha256").update(pin).digest("hex");
  const prev = lastWrong.get(key);
  if (prev && prev.hash === hash && now - prev.at < REPEAT_WINDOW_MS) return { status: "wrong" };
  lastWrong.set(key, { hash, at: now });

  if (g.lockedUntil || now - g.updated > FORGET_AFTER_MS) g = { ...g, count: 0, lockedUntil: 0 };
  const count = g.count + 1;
  if (count >= MAX_TRIES) {
    await save(key, { ...g, count: 0, lockedUntil: now + LOCKOUT_MS, updated: now });
    return { status: "locked", minutes: Math.round(LOCKOUT_MS / 60000) };
  }
  await save(key, { ...g, count, lockedUntil: 0, updated: now });
  return { status: "wrong" };
}
