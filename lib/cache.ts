/**
 * Simple module-level in-memory cache for Vercel serverless functions.
 * Entries persist across warm invocations within the same instance.
 * TTL is enforced on read — stale entries are evicted lazily.
 */

interface CacheEntry<T> {
  data: T;
  expires: number;
}

const store = new Map<string, CacheEntry<unknown>>();

export function getCached<T>(key: string): T | null {
  const entry = store.get(key) as CacheEntry<T> | undefined;
  if (!entry) return null;
  if (Date.now() > entry.expires) {
    store.delete(key);
    return null;
  }
  return entry.data;
}

export function setCached<T>(key: string, data: T, ttlMs: number): void {
  store.set(key, { data, expires: Date.now() + ttlMs });
}

export function invalidateCache(key: string): void {
  store.delete(key);
}

export function invalidateCachePrefix(prefix: string): void {
  const toDelete: string[] = [];
  store.forEach((_, key) => { if (key.startsWith(prefix)) toDelete.push(key); });
  toDelete.forEach(key => store.delete(key));
}
