/**
 * Domain-keyed scan cache — Redis-ready abstraction with in-memory default.
 * Prevents duplicate scans for the same domain within a short TTL window.
 */

const DEFAULT_TTL_MS = 10 * 60 * 1000; // 10 minutes (within 5–15 min spec)

export interface CacheStore {
  get<T>(key: string): T | null;
  set<T>(key: string, value: T, ttlMs: number): void;
  delete(key: string): void;
}

class MemoryCacheStore implements CacheStore {
  private store = new Map<string, { value: unknown; expiresAt: number }>();

  get<T>(key: string): T | null {
    const entry = this.store.get(key);
    if (!entry) return null;
    if (Date.now() > entry.expiresAt) {
      this.store.delete(key);
      return null;
    }
    return entry.value as T;
  }

  set<T>(key: string, value: T, ttlMs: number): void {
    this.store.set(key, { value, expiresAt: Date.now() + ttlMs });
  }

  delete(key: string): void {
    this.store.delete(key);
  }
}

/** Swap for Redis-backed store in production without changing call sites. */
let cacheStore: CacheStore = new MemoryCacheStore();

export function setCacheStore(store: CacheStore): void {
  cacheStore = store;
}

const inFlightByDomain = new Map<string, Promise<unknown>>();

export function normalizeDomain(domainOrUrl: string): string {
  try {
    const parsed = new URL(
      domainOrUrl.startsWith('http') ? domainOrUrl : `https://${domainOrUrl}`,
    );
    return parsed.hostname.replace(/^www\./, '').toLowerCase();
  } catch {
    return domainOrUrl
      .replace(/^https?:\/\//, '')
      .replace(/^www\./, '')
      .split('/')[0]
      .toLowerCase();
  }
}

function cacheKey(domain: string): string {
  return `scan:${normalizeDomain(domain)}`;
}

export function getCachedScan<T>(domain: string): T | null {
  return cacheStore.get<T>(cacheKey(domain));
}

export function setCachedScan<T>(domain: string, data: T, ttlMs = DEFAULT_TTL_MS): void {
  cacheStore.set(cacheKey(domain), data, ttlMs);
}

export function invalidateScan(domain: string): void {
  cacheStore.delete(cacheKey(domain));
  inFlightByDomain.delete(normalizeDomain(domain));
}

/** Coalesce concurrent scan requests for the same domain into one execution. */
export async function dedupeScan<T>(domain: string, runner: () => Promise<T>): Promise<T> {
  const key = normalizeDomain(domain);

  const cached = getCachedScan<T>(key);
  if (cached) return cached;

  const existing = inFlightByDomain.get(key);
  if (existing) return existing as Promise<T>;

  const promise = runner()
    .then((result) => {
      setCachedScan(key, result);
      return result;
    })
    .finally(() => {
      inFlightByDomain.delete(key);
    });

  inFlightByDomain.set(key, promise);
  return promise;
}

export function pruneExpiredScanCache(): void {
  if (cacheStore instanceof MemoryCacheStore) {
    // Memory store self-prunes on get; best-effort no-op for interface compat.
  }
}
