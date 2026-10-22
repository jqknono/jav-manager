// 各路由共享的 isolate 内存缓存，保留原有容量与过期策略。

type MemCacheEntry<T> = { t: number; value: T };

const MEM_CACHE = new Map<string, MemCacheEntry<unknown>>();

const MEM_CACHE_MAX_ENTRIES = 2000;

function memCacheGet<T>(key: string, ttlMs: number): T | null {
  const hit = MEM_CACHE.get(key);
  if (!hit) return null;
  if (Date.now() - hit.t > ttlMs) {
    MEM_CACHE.delete(key);
    return null;
  }
  return hit.value as T;
}

function memCacheSet(key: string, value: unknown): void {
  if (MEM_CACHE.size >= MEM_CACHE_MAX_ENTRIES) {
    // Simple bound: drop all entries (fast, avoids a more complex LRU).
    MEM_CACHE.clear();
  }
  MEM_CACHE.set(key, { t: Date.now(), value });
}

export { memCacheGet, memCacheSet };
