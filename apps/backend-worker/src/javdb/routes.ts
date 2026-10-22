import { jsonResponse, normalizeText } from '../http';
import type { RouteContext } from '../types';
import { getJavDbProxyCache, markJavDbProxyCacheHit, upsertJavDbProxyCache } from './cache';
import type { JavDbProxyCacheRow, JavDbProxyUpsert } from './cache';
import {
  JAVDB_APP_API_HOST_FALLBACK,
  JAVDB_APP_API_HOST_PRIMARY,
  JAVDB_IMG_HOST,
  JAVDB_PREVIEW_HOST,
  JAVDB_PROXY_APP_PREFIX,
  JAVDB_PROXY_IMG_PREFIX,
  JAVDB_PROXY_PREFIX,
  JAVDB_PROXY_PREVIEW_PREFIX,
  JAVDB_RECENT_SEARCH_KEY,
  JAVDB_RECENT_SORT_KEY,
  getJavDbAppSalt,
  getJavDbAppSecret,
  isProxyKeyAuthorized,
} from './config';
import { md5HexText, sha256HexBytes, sha256HexText } from './crypto';
import { extractTopItemsFromJson, kvGetJsonArray, kvUpsertRecent } from './recent';
import {
  canonicalizeUrl,
  filterReplayableHeaders,
  isLikelyM3u8,
  mergeCorsHeaders,
  parseBytesRangeHeader,
  rewriteJavDbJsonText,
  rewriteM3u8Text,
} from './resources';

// JavDB App、图片与预览代理；保持缓存和后台任务的执行时机。

export async function handleJavDbProxy(context: RouteContext): Promise<Response> {
  const { request, env, ctx, url, path, admin, javdbCorsHeaders, respond } = context;

  const expectedProxyKey = normalizeText(env.JAVDB_PROXY_KEY, 256);
  if (!admin && !expectedProxyKey) {
    return respond(jsonResponse({ error: 'Proxy not configured' }, { status: 503, headers: javdbCorsHeaders }));
  }
  if (!admin && !isProxyKeyAuthorized(request, env)) {
    return respond(jsonResponse({ error: 'Unauthorized' }, { status: 401, headers: javdbCorsHeaders }));
  }

  if (request.method !== 'GET' && request.method !== 'HEAD') {
    return respond(jsonResponse({ error: 'Method Not Allowed' }, { status: 405, headers: javdbCorsHeaders }));
  }

  const origin = url.origin;

  // Debug endpoints (KV)
  if (path === `${JAVDB_PROXY_PREFIX}/recent/search` && request.method === 'GET') {
    const data = await kvGetJsonArray(env, JAVDB_RECENT_SEARCH_KEY);
    return respond(jsonResponse({ data }, { headers: javdbCorsHeaders }));
  }
  if (path === `${JAVDB_PROXY_PREFIX}/recent/sort` && request.method === 'GET') {
    const data = await kvGetJsonArray(env, JAVDB_RECENT_SORT_KEY);
    return respond(jsonResponse({ data }, { headers: javdbCorsHeaders }));
  }

  const buildReplayHeaders = (row: JavDbProxyCacheRow): Headers => {
    const headers = new Headers();
    let replay: Record<string, string> = {};
    if (row.headers_json) {
      try {
        const parsed = JSON.parse(row.headers_json) as unknown;
        if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) replay = parsed as Record<string, string>;
      } catch {
        replay = {};
      }
    }
    for (const [k, v] of Object.entries(replay)) headers.set(k, v);
    if (row.content_type && !headers.has('content-type')) headers.set('content-type', row.content_type);
    if (!headers.has('cache-control')) headers.set('cache-control', 'private, max-age=300');
    return headers;
  };

  const serveCachedText = (row: JavDbProxyCacheRow): Response => {
    const headers = buildReplayHeaders(row);
    return new Response(request.method === 'HEAD' ? null : (row.body_text ?? ''), {
      status: row.status || 200,
      headers: mergeCorsHeaders(headers, javdbCorsHeaders),
    });
  };

  const serveCachedR2 = async (row: JavDbProxyCacheRow): Promise<Response | null> => {
    if (!row.r2_key) return null;
    const range = parseBytesRangeHeader(request.headers.get('Range'));
    const getOpts: R2GetOptions = {};
    if (range.type === 'offset') getOpts.range = { offset: range.offset };
    if (range.type === 'offset_length') getOpts.range = { offset: range.offset, length: range.length };
    if (range.type === 'suffix') getOpts.range = { suffix: range.suffix };
    const obj = await env.JAVDB_R2.get(row.r2_key, getOpts);
    if (!obj) return null;

    const headers = new Headers();
    const ct = row.content_type ?? obj.httpMetadata?.contentType ?? 'application/octet-stream';
    headers.set('Content-Type', ct);
    headers.set('Accept-Ranges', 'bytes');
    if (!headers.has('Cache-Control')) headers.set('Cache-Control', 'private, max-age=300');

    let status = 200;
    const r = obj.range;
    if (r && ('offset' in r) && typeof r.offset === 'number') {
      status = 206;
      const offset = r.offset;
      const length = ('length' in r && typeof r.length === 'number') ? r.length : null;
      const total = obj.size;
      if (length !== null && Number.isFinite(total)) {
        const end = offset + length - 1;
        headers.set('Content-Range', `bytes ${offset}-${end}/${total}`);
        headers.set('Content-Length', String(length));
      }
    } else if (r && ('suffix' in r) && typeof r.suffix === 'number') {
      status = 206;
      const total = obj.size;
      if (Number.isFinite(total)) {
        const length = Math.min(r.suffix, total);
        const offset = Math.max(total - length, 0);
        const end = offset + length - 1;
        headers.set('Content-Range', `bytes ${offset}-${end}/${total}`);
        headers.set('Content-Length', String(length));
      }
    } else if (Number.isFinite(obj.size)) {
      headers.set('Content-Length', String(obj.size));
    }

    return new Response(request.method === 'HEAD' ? null : obj.body, {
      status,
      headers: mergeCorsHeaders(headers, javdbCorsHeaders),
    });
  };

  const storeText = (value: JavDbProxyUpsert, bodyText: string) => {
    ctx.waitUntil((async () => {
      try {
        const bodySha256 = await sha256HexText(bodyText);
        await upsertJavDbProxyCache(env, { ...value, bodyText, bodySha256 });
      } catch (e) {
        console.error('Failed to store javdb proxy text:', e);
      }
    })());
  };

  const storeBinaryToR2 = (value: JavDbProxyUpsert, r2Key: string, body: Uint8Array, contentType: string | null) => {
    ctx.waitUntil((async () => {
      try {
        const bodySha256 = await sha256HexBytes(body);
        await env.JAVDB_R2.put(r2Key, body, {
          httpMetadata: {
            contentType: contentType ?? 'application/octet-stream',
          },
        });
        await upsertJavDbProxyCache(env, {
          ...value,
          r2Key,
          bytes: body.byteLength,
          bodyText: null,
          bodySha256,
        });
      } catch (e) {
        console.error('Failed to store javdb proxy binary:', e);
      }
    })());
  };

  const updateRecentKvFromJson = (upstreamPath: string, upstreamUrl: string, jsonText: string) => {
    ctx.waitUntil((async () => {
      try {
        const parsed = JSON.parse(jsonText) as unknown;
        const top = extractTopItemsFromJson(parsed, 20);
        if (upstreamPath.startsWith('/api/v2/search')) {
          const u = new URL(upstreamUrl);
          const q = u.searchParams.get('q');
          const type = u.searchParams.get('type');
          await kvUpsertRecent(env, JAVDB_RECENT_SEARCH_KEY, {
            ts: Date.now(),
            url: upstreamUrl,
            q,
            type,
            top,
          });
          return;
        }
        if (
          upstreamPath === '/api/v1/movies/latest'
          || upstreamPath === '/api/v1/movies/top'
          || upstreamPath.startsWith('/api/v1/rankings')
        ) {
          await kvUpsertRecent(env, JAVDB_RECENT_SORT_KEY, {
            ts: Date.now(),
            url: upstreamUrl,
            sortKey: upstreamPath,
            top,
          });
        }
      } catch {
        // ignore
      }
    })());
  };

  // /api/javdb/app/*
  if (path.startsWith(JAVDB_PROXY_APP_PREFIX)) {
    const upstreamPath = path.slice(JAVDB_PROXY_APP_PREFIX.length) || '/';
    if (!upstreamPath.startsWith('/api/')) {
      return respond(jsonResponse({ error: 'Invalid upstream path' }, { status: 400, headers: javdbCorsHeaders }));
    }
    if (upstreamPath.startsWith('/api/v1/sessions') || upstreamPath.startsWith('/api/v1/users')) {
      return respond(jsonResponse({ error: 'Forbidden' }, { status: 403, headers: javdbCorsHeaders }));
    }

    const upstreamUrlPrimary = new URL(`https://${JAVDB_APP_API_HOST_PRIMARY}${upstreamPath}`);
    upstreamUrlPrimary.search = url.search;
    const canonicalUpstreamUrl = canonicalizeUrl(upstreamUrlPrimary);
    const acceptLanguage = normalizeText(request.headers.get('Accept-Language'), 128) ?? '';
    const cacheKey = await sha256HexText(`${canonicalUpstreamUrl}|al=${acceptLanguage}`);

    const cached = await getJavDbProxyCache(env, cacheKey);
    if (cached && cached.body_text) {
      ctx.waitUntil(markJavDbProxyCacheHit(env, cacheKey));
      updateRecentKvFromJson(upstreamPath, canonicalUpstreamUrl, cached.body_text);
      return respond(serveCachedText(cached));
    }

    const headers = new Headers();
    headers.set('User-Agent', 'JavDB-App/1.0');
    headers.set('Accept', 'application/json');
    if (acceptLanguage) headers.set('Accept-Language', acceptLanguage);
    const ts = Math.floor(Date.now() / 1000);
    const salt = getJavDbAppSalt(env);
    const secret = getJavDbAppSecret(env);
    const sig = `${ts}.${salt}.${md5HexText(`${ts}${secret}`)}`;
    headers.set('jdsignature', sig);
    const ifNoneMatch = request.headers.get('If-None-Match');
    const ifModifiedSince = request.headers.get('If-Modified-Since');
    if (ifNoneMatch) headers.set('If-None-Match', ifNoneMatch);
    if (ifModifiedSince) headers.set('If-Modified-Since', ifModifiedSince);

    const fetchInit: RequestInit = {
      method: 'GET',
      headers,
      signal: AbortSignal.timeout(15000),
    };

    let upstreamRes: Response | null = null;
    try {
      upstreamRes = await fetch(upstreamUrlPrimary.toString(), fetchInit);
      if (!upstreamRes.ok && (upstreamRes.status >= 500 || upstreamRes.status === 429)) {
        const upstreamUrlFallback = new URL(`https://${JAVDB_APP_API_HOST_FALLBACK}${upstreamPath}`);
        upstreamUrlFallback.search = url.search;
        upstreamRes = await fetch(upstreamUrlFallback.toString(), fetchInit);
      }
    } catch (e) {
      console.error('Failed to fetch javdb app primary:', e);
      const upstreamUrlFallback = new URL(`https://${JAVDB_APP_API_HOST_FALLBACK}${upstreamPath}`);
      upstreamUrlFallback.search = url.search;
      upstreamRes = await fetch(upstreamUrlFallback.toString(), fetchInit);
    }

    const contentType = upstreamRes.headers.get('Content-Type');
    const text = await upstreamRes.text();
    const bodyText = (contentType ?? '').toLowerCase().includes('application/json')
      ? rewriteJavDbJsonText(text, origin)
      : text;

    const replayHeaders = filterReplayableHeaders(upstreamRes.headers);
    const stored: JavDbProxyUpsert = {
      cacheKey,
      upstreamUrl: canonicalUpstreamUrl,
      upstreamHost: JAVDB_APP_API_HOST_PRIMARY,
      path: upstreamPath,
      query: upstreamUrlPrimary.searchParams.toString(),
      method: 'GET',
      status: upstreamRes.status,
      contentType,
      headersJson: JSON.stringify(replayHeaders),
      bodyText: null,
      r2Key: null,
      bytes: bodyText.length,
      bodySha256: null,
    };

    if (upstreamRes.ok) {
      storeText(stored, bodyText);
      updateRecentKvFromJson(upstreamPath, canonicalUpstreamUrl, bodyText);
    }

    const resHeaders = new Headers(replayHeaders);
    resHeaders.set('Content-Type', contentType ?? 'application/json; charset=utf-8');
    resHeaders.set('Cache-Control', 'private, max-age=60');
    return respond(new Response(request.method === 'HEAD' ? null : bodyText, {
      status: upstreamRes.status,
      headers: mergeCorsHeaders(resHeaders, javdbCorsHeaders),
    }));
  }

  // /api/javdb/img/*
  if (path.startsWith(JAVDB_PROXY_IMG_PREFIX)) {
    const upstreamPath = path.slice(JAVDB_PROXY_IMG_PREFIX.length) || '/';
    const upstreamUrl = new URL(`https://${JAVDB_IMG_HOST}${upstreamPath}`);
    upstreamUrl.search = url.search;
    const canonicalUpstreamUrl = canonicalizeUrl(upstreamUrl);
    const cacheKey = await sha256HexText(canonicalUpstreamUrl);

    const cached = await getJavDbProxyCache(env, cacheKey);
    if (cached?.r2_key) {
      const cachedRes = await serveCachedR2(cached);
      if (cachedRes) {
        ctx.waitUntil(markJavDbProxyCacheHit(env, cacheKey));
        return respond(cachedRes);
      }
    }

    const range = parseBytesRangeHeader(request.headers.get('Range'));
    const headers = new Headers();
    const ifNoneMatch = request.headers.get('If-None-Match');
    const ifModifiedSince = request.headers.get('If-Modified-Since');
    if (ifNoneMatch) headers.set('If-None-Match', ifNoneMatch);
    if (ifModifiedSince) headers.set('If-Modified-Since', ifModifiedSince);
    if (range.type !== 'none') headers.set('Range', request.headers.get('Range') ?? '');

    const upstreamRes = await fetch(upstreamUrl.toString(), { method: 'GET', headers, signal: AbortSignal.timeout(15000) });
    const contentType = upstreamRes.headers.get('Content-Type');

    // Range 请求不落盘，避免只缓存分片/局部内容
    if (!upstreamRes.ok || range.type !== 'none') {
      const resHeaders = new Headers(filterReplayableHeaders(upstreamRes.headers));
      if (contentType) resHeaders.set('Content-Type', contentType);
      resHeaders.set('Cache-Control', 'private, max-age=60');
      return respond(new Response(request.method === 'HEAD' ? null : upstreamRes.body, {
        status: upstreamRes.status,
        headers: mergeCorsHeaders(resHeaders, javdbCorsHeaders),
      }));
    }

    const body = new Uint8Array(await upstreamRes.arrayBuffer());
    const r2Key = `javdb/${JAVDB_IMG_HOST}/${cacheKey}`;
    const replayHeaders = filterReplayableHeaders(upstreamRes.headers);
    const stored: JavDbProxyUpsert = {
      cacheKey,
      upstreamUrl: canonicalUpstreamUrl,
      upstreamHost: JAVDB_IMG_HOST,
      path: upstreamPath,
      query: upstreamUrl.searchParams.toString(),
      method: 'GET',
      status: upstreamRes.status,
      contentType,
      headersJson: JSON.stringify(replayHeaders),
      bodyText: null,
      r2Key: null,
      bytes: body.byteLength,
      bodySha256: null,
    };
    storeBinaryToR2(stored, r2Key, body, contentType);

    const resHeaders = new Headers(replayHeaders);
    resHeaders.set('Content-Type', contentType ?? 'application/octet-stream');
    resHeaders.set('Cache-Control', 'private, max-age=300');
    resHeaders.set('Accept-Ranges', 'bytes');
    resHeaders.set('Content-Length', String(body.byteLength));
    return respond(new Response(request.method === 'HEAD' ? null : body, {
      status: upstreamRes.status,
      headers: mergeCorsHeaders(resHeaders, javdbCorsHeaders),
    }));
  }

  // /api/javdb/preview/*
  if (path.startsWith(JAVDB_PROXY_PREVIEW_PREFIX)) {
    const upstreamPath = path.slice(JAVDB_PROXY_PREVIEW_PREFIX.length) || '/';
    const upstreamUrl = new URL(`https://${JAVDB_PREVIEW_HOST}${upstreamPath}`);
    upstreamUrl.search = url.search;
    const canonicalUpstreamUrl = canonicalizeUrl(upstreamUrl);

    const maybeM3u8 = upstreamPath.toLowerCase().endsWith('.m3u8');
    const cacheKey = maybeM3u8 ? await sha256HexText(canonicalUpstreamUrl) : '';

    if (maybeM3u8) {
      const cached = await getJavDbProxyCache(env, cacheKey);
      if (cached?.body_text) {
        ctx.waitUntil(markJavDbProxyCacheHit(env, cacheKey));
        return respond(serveCachedText(cached));
      }
    }

    const range = parseBytesRangeHeader(request.headers.get('Range'));
    const headers = new Headers();
    const ifNoneMatch = request.headers.get('If-None-Match');
    const ifModifiedSince = request.headers.get('If-Modified-Since');
    if (ifNoneMatch) headers.set('If-None-Match', ifNoneMatch);
    if (ifModifiedSince) headers.set('If-Modified-Since', ifModifiedSince);
    if (range.type !== 'none') headers.set('Range', request.headers.get('Range') ?? '');

    const upstreamRes = await fetch(upstreamUrl.toString(), { method: 'GET', headers, signal: AbortSignal.timeout(20000) });
    const contentType = upstreamRes.headers.get('Content-Type');

    // 只缓存/归档 m3u8；ts 分片只转发不落盘
    const isM3u8Hint = maybeM3u8 || isLikelyM3u8(contentType, upstreamPath);
    if (!isM3u8Hint) {
      // 非 m3u8：直接透传（不落盘）
      const resHeaders = new Headers(filterReplayableHeaders(upstreamRes.headers));
      if (contentType) resHeaders.set('Content-Type', contentType);
      resHeaders.set('Cache-Control', 'private, max-age=60');
      return respond(new Response(request.method === 'HEAD' ? null : upstreamRes.body, {
        status: upstreamRes.status,
        headers: mergeCorsHeaders(resHeaders, javdbCorsHeaders),
      }));
    }

    const playlistText = await upstreamRes.text();
    const isM3u8 = maybeM3u8 || isLikelyM3u8(contentType, upstreamPath, playlistText);
    if (!isM3u8) {
      // 极少数情况下 header/扩展名误判：按透传处理
      const resHeaders = new Headers(filterReplayableHeaders(upstreamRes.headers));
      if (contentType) resHeaders.set('Content-Type', contentType);
      resHeaders.set('Cache-Control', 'private, max-age=60');
      return respond(new Response(request.method === 'HEAD' ? null : playlistText, {
        status: upstreamRes.status,
        headers: mergeCorsHeaders(resHeaders, javdbCorsHeaders),
      }));
    }

    const rewritten = rewriteM3u8Text(playlistText, origin, path);
    const replayHeaders = filterReplayableHeaders(upstreamRes.headers);
    const stored: JavDbProxyUpsert = {
      cacheKey,
      upstreamUrl: canonicalUpstreamUrl,
      upstreamHost: JAVDB_PREVIEW_HOST,
      path: upstreamPath,
      query: upstreamUrl.searchParams.toString(),
      method: 'GET',
      status: upstreamRes.status,
      contentType: contentType ?? 'application/vnd.apple.mpegurl; charset=utf-8',
      headersJson: JSON.stringify(replayHeaders),
      bodyText: null,
      r2Key: null,
      bytes: rewritten.length,
      bodySha256: null,
    };
    if (upstreamRes.ok) storeText(stored, rewritten);

    const resHeaders = new Headers(replayHeaders);
    resHeaders.set('Content-Type', contentType ?? 'application/vnd.apple.mpegurl; charset=utf-8');
    resHeaders.set('Cache-Control', 'private, max-age=60');
    return respond(new Response(request.method === 'HEAD' ? null : rewritten, {
      status: upstreamRes.status,
      headers: mergeCorsHeaders(resHeaders, javdbCorsHeaders),
    }));
  }

  return respond(jsonResponse({ error: 'Not Found' }, { status: 404, headers: javdbCorsHeaders }));
}

