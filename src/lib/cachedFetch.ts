/**
 * Fetches JSON from an outside service with a short deadline and a small in-memory cache.
 * If the service is slow or down, the last good answer is used instead of failing.
 *
 * This is used instead of Next's built-in fetch caching (`next: { revalidate }`), which can turn a failed
 * background refresh into a 500 error for the whole request.
 */
const store = new Map<string, { data: unknown; at: number }>();
const MAX_ENTRIES = 100;
/** After a failure, don't try the same address again for a minute so a down service doesn't slow every refresh. */
const failedAt = new Map<string, number>();
const RETRY_AFTER_MS = 60 * 1000;

export async function fetchJsonCached<T>(url: string, opts: { ttlMs: number; timeoutMs?: number }): Promise<T> {
  const hit = store.get(url);
  if (hit && Date.now() - hit.at < opts.ttlMs) return hit.data as T;
  if (Date.now() - (failedAt.get(url) ?? 0) < RETRY_AFTER_MS) {
    if (hit) return hit.data as T;
    throw new Error("service recently unavailable");
  }
  try {
    const res = await fetch(url, { cache: "no-store", signal: AbortSignal.timeout(opts.timeoutMs ?? 5000) });
    if (!res.ok) throw Object.assign(new Error(`HTTP ${res.status}`), { status: res.status });
    const data = (await res.json()) as T;
    failedAt.delete(url);
    store.set(url, { data, at: Date.now() });
    if (store.size > MAX_ENTRIES) store.delete(store.keys().next().value as string);
    return data;
  } catch (e) {
    failedAt.set(url, Date.now());
    // Only the host is logged: the address can contain an API key.
    console.warn(`Request to ${new URL(url).hostname} failed: ${e instanceof Error ? e.message : e}${hit ? " (using the last good answer)" : ""}`);
    if (hit) return hit.data as T;
    throw e;
  }
}
