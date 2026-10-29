import { useCallback, useState, type SetStateAction } from 'react';

// In-memory cache of page data for this browser tab. Revisiting a page shows
// its last data instantly while a fresh copy loads in the background.
// Cleared on sign-out so the next user never sees the previous user's data.
const cache = new Map<string, unknown>();

export function hasCached(key: string) {
  return cache.has(key);
}

export function clearPageCache() {
  cache.clear();
}

/** Drop cached entries whose key starts with `prefix` (e.g. after a change elsewhere). */
export function invalidateCache(prefix: string) {
  for (const key of cache.keys()) if (key.startsWith(prefix)) cache.delete(key);
}

/**
 * useState that is seeded from, and written through to, the page cache.
 * Pair with `useState(!hasCached(key))` for a loading flag that is only
 * true on the very first visit.
 */
export function useCachedState<T>(key: string, initial: T) {
  const [value, setValue] = useState<T>(() => (cache.has(key) ? (cache.get(key) as T) : initial));

  const set = useCallback(
    (next: SetStateAction<T>) => {
      setValue((prev) => {
        const resolved = typeof next === 'function' ? (next as (p: T) => T)(prev) : next;
        cache.set(key, resolved);
        return resolved;
      });
    },
    [key],
  );

  return [value, set] as const;
}
