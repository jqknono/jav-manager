import type { Env } from '../env';
import { JAVDB_RECENT_MAX_ITEMS, JAVDB_RECENT_TTL_SECONDS } from './config';

// JavDB 最近搜索与排序记录的 KV 存储。

type RecentTopItem = { id?: string; number?: string; title?: string };

function extractTopItemsFromJson(jsonValue: unknown, limit = 20): RecentTopItem[] {
  const queue: Array<{ v: unknown; d: number }> = [{ v: jsonValue, d: 0 }];
  while (queue.length) {
    const cur = queue.shift();
    if (!cur) break;
    const { v, d } = cur;
    if (d > 6) continue;
    if (Array.isArray(v) && v.length && v.some(x => x && typeof x === 'object' && !Array.isArray(x))) {
      const out: RecentTopItem[] = [];
      for (const item of v) {
        if (!item || typeof item !== 'object' || Array.isArray(item)) continue;
        const obj = item as Record<string, unknown>;
        const nestedMovie = (obj.movie && typeof obj.movie === 'object' && !Array.isArray(obj.movie))
          ? (obj.movie as Record<string, unknown>)
          : null;
        const idRaw = obj.id ?? nestedMovie?.id;
        const numberRaw = obj.number ?? nestedMovie?.number;
        const titleRaw = obj.title ?? nestedMovie?.title;
        const id = idRaw !== undefined && idRaw !== null ? String(idRaw) : undefined;
        const number = typeof numberRaw === 'string' ? numberRaw : numberRaw != null ? String(numberRaw) : undefined;
        const title = typeof titleRaw === 'string' ? titleRaw : titleRaw != null ? String(titleRaw) : undefined;
        if (!id && !number && !title) continue;
        out.push({ id, number, title });
        if (out.length >= limit) break;
      }
      return out;
    }
    if (v && typeof v === 'object') {
      for (const child of Object.values(v as Record<string, unknown>)) {
        queue.push({ v: child, d: d + 1 });
      }
    }
  }
  return [];
}

async function kvGetJsonArray(env: Env, key: string): Promise<unknown[]> {
  const value = await env.JAVDB_KV.get(key, { type: 'json' }) as unknown;
  return Array.isArray(value) ? value : [];
}

async function kvUpsertRecent(env: Env, key: string, entry: Record<string, unknown>): Promise<void> {
  const list = await kvGetJsonArray(env, key);
  const url = typeof entry.url === 'string' ? entry.url : '';
  const deduped = list.filter(x => !(x && typeof x === 'object' && (x as Record<string, unknown>).url === url));
  deduped.unshift(entry);
  const trimmed = deduped.slice(0, JAVDB_RECENT_MAX_ITEMS);
  await env.JAVDB_KV.put(key, JSON.stringify(trimmed), { expirationTtl: JAVDB_RECENT_TTL_SECONDS });
}

export { extractTopItemsFromJson, kvGetJsonArray, kvUpsertRecent };
