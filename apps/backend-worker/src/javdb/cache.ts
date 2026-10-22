import type { Env } from '../env';
import { ensureSchema } from '../storage/schema';

// JavDB 代理缓存的 D1 读写与命中计数。

type JavDbProxyCacheRow = {
  cache_key: string;
  upstream_url: string;
  upstream_host: string;
  path: string;
  query: string;
  method: string;
  status: number;
  content_type: string | null;
  headers_json: string | null;
  body_text: string | null;
  r2_key: string | null;
  bytes: number | null;
  body_sha256: string | null;
};

async function getJavDbProxyCache(env: Env, cacheKey: string): Promise<JavDbProxyCacheRow | null> {
  await ensureSchema(env);
  const row = await env.DB.prepare(`
    SELECT
      cache_key, upstream_url, upstream_host, path, query, method, status,
      content_type, headers_json, body_text, r2_key, bytes, body_sha256
    FROM javdb_proxy_cache
    WHERE cache_key = ?
    LIMIT 1
  `).bind(cacheKey).first<JavDbProxyCacheRow>();
  return row ?? null;
}

async function markJavDbProxyCacheHit(env: Env, cacheKey: string): Promise<void> {
  await ensureSchema(env);
  await env.DB.prepare(`
    UPDATE javdb_proxy_cache
    SET hit_count = hit_count + 1, last_access_at = datetime('now')
    WHERE cache_key = ?
  `).bind(cacheKey).run();
}

type JavDbProxyUpsert = {
  cacheKey: string;
  upstreamUrl: string;
  upstreamHost: string;
  path: string;
  query: string;
  method: string;
  status: number;
  contentType: string | null;
  headersJson: string | null;
  bodyText: string | null;
  r2Key: string | null;
  bytes: number | null;
  bodySha256: string | null;
};

async function upsertJavDbProxyCache(env: Env, value: JavDbProxyUpsert): Promise<void> {
  await ensureSchema(env);
  await env.DB.prepare(`
    INSERT INTO javdb_proxy_cache (
      cache_key, upstream_url, upstream_host, path, query, method, status,
      content_type, headers_json, body_text, r2_key, bytes, body_sha256,
      updated_at
    )
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
    ON CONFLICT(cache_key) DO UPDATE SET
      upstream_url = excluded.upstream_url,
      upstream_host = excluded.upstream_host,
      path = excluded.path,
      query = excluded.query,
      method = excluded.method,
      status = excluded.status,
      content_type = excluded.content_type,
      headers_json = excluded.headers_json,
      body_text = excluded.body_text,
      r2_key = excluded.r2_key,
      bytes = excluded.bytes,
      body_sha256 = excluded.body_sha256,
      updated_at = datetime('now')
  `).bind(
    value.cacheKey,
    value.upstreamUrl,
    value.upstreamHost,
    value.path,
    value.query,
    value.method,
    value.status,
    value.contentType,
    value.headersJson,
    value.bodyText,
    value.r2Key,
    value.bytes,
    value.bodySha256
  ).run();
}

export { JavDbProxyCacheRow, JavDbProxyUpsert, getJavDbProxyCache, markJavDbProxyCacheHit, upsertJavDbProxyCache };
