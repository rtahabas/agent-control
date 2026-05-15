// Cache + single-flight helper for /api/state. The route handler shells
// out to a bash script that takes ~2-3s per fresh fetch, so concurrent
// requests (e.g. visibilitychange storms during alt-tabbing) need to
// coalesce, and warm hits need to be near-instant. This module owns the
// cache state and the inflight Map so the route handler stays thin and
// the cache layer can be tested in isolation.

export interface CachedState { ts: number; body: string; }

const TTL_MS = 60_000;
const cache = new Map<string, CachedState>();
const inflight = new Map<string, Promise<string>>();

export function getCacheTtlMs(): number {
  return TTL_MS;
}

export function readCachedState(key: string, now: number = Date.now()): string | null {
  const entry = cache.get(key);
  if (!entry) return null;
  if (now - entry.ts >= TTL_MS) return null;
  return entry.body;
}

export function writeCachedState(key: string, body: string, now: number = Date.now()): void {
  cache.set(key, { ts: now, body });
}

export async function withSingleFlight(
  key: string,
  fetcher: () => Promise<string>,
): Promise<string> {
  const existing = inflight.get(key);
  if (existing) return existing;
  const promise = fetcher().finally(() => {
    inflight.delete(key);
  });
  inflight.set(key, promise);
  return promise;
}

export function _resetStateCacheForTests(): void {
  cache.clear();
  inflight.clear();
}
