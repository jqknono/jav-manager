import { JAVDB_IMG_HOST, JAVDB_PREVIEW_HOST, JAVDB_PROXY_IMG_PREFIX, JAVDB_PROXY_PREVIEW_PREFIX } from './config';

// 代理 URL、响应头、字节范围与播放列表重写。

function canonicalizeUrl(url: URL): string {
  const entries = Array.from(url.searchParams.entries());
  entries.sort((a, b) => a[0].localeCompare(b[0]) || a[1].localeCompare(b[1]));
  const usp = new URLSearchParams();
  for (const [k, v] of entries) usp.append(k, v);
  const q = usp.toString();
  return q ? `${url.origin}${url.pathname}?${q}` : `${url.origin}${url.pathname}`;
}

type ParsedByteRange =
  | { type: 'none' }
  | { type: 'offset'; offset: number }
  | { type: 'offset_length'; offset: number; length: number }
  | { type: 'suffix'; suffix: number };

function parseBytesRangeHeader(value: string | null): ParsedByteRange {
  if (!value) return { type: 'none' };
  const raw = value.trim().toLowerCase();
  if (!raw.startsWith('bytes=')) return { type: 'none' };
  const range = raw.slice('bytes='.length).trim();
  const parts = range.split(',')[0]?.trim() ?? '';
  if (!parts) return { type: 'none' };

  // bytes=START-END
  const m = parts.match(/^(\d+)-(\d+)?$/);
  if (m) {
    const start = Number(m[1]);
    const end = m[2] !== undefined && m[2] !== '' ? Number(m[2]) : null;
    if (!Number.isFinite(start) || start < 0) return { type: 'none' };
    if (end === null) return { type: 'offset', offset: start };
    if (!Number.isFinite(end) || end < start) return { type: 'none' };
    return { type: 'offset_length', offset: start, length: (end - start + 1) };
  }

  // bytes=-SUFFIX
  const s = parts.match(/^-(\d+)$/);
  if (s) {
    const suffix = Number(s[1]);
    if (!Number.isFinite(suffix) || suffix <= 0) return { type: 'none' };
    return { type: 'suffix', suffix };
  }

  return { type: 'none' };
}

function filterReplayableHeaders(headers: Headers): Record<string, string> {
  // 只保留少量可回放的头部，避免 Set-Cookie / hop-by-hop / 压缩编码等问题
  const out: Record<string, string> = {};
  const keep = new Set([
    'content-type',
    'etag',
    'last-modified',
    'cache-control',
  ]);
  for (const [k, v] of headers.entries()) {
    const key = k.toLowerCase();
    if (!keep.has(key)) continue;
    if (key === 'cache-control') continue; // 统一由 Worker 控制
    out[key] = v;
  }
  return out;
}

function mergeCorsHeaders(headers: Headers, cors: Record<string, string>): Headers {
  const out = new Headers(headers);
  for (const [k, v] of Object.entries(cors)) out.set(k, v);
  return out;
}

function rewriteJavDbResourceUrl(input: string, origin: string): string {
  let url: URL | null = null;
  try {
    url = new URL(input);
  } catch {
    return input;
  }

  if (url.protocol !== 'https:' && url.protocol !== 'http:') return input;
  const host = url.host.toLowerCase();

  if (host === JAVDB_IMG_HOST) {
    return `${origin}${JAVDB_PROXY_IMG_PREFIX}${url.pathname}${url.search}`;
  }
  if (host === JAVDB_PREVIEW_HOST) {
    return `${origin}${JAVDB_PROXY_PREVIEW_PREFIX}${url.pathname}${url.search}`;
  }
  return input;
}

function rewriteUrlsDeep(value: unknown, origin: string, depth = 0): unknown {
  if (depth > 10) return value;
  if (typeof value === 'string') return rewriteJavDbResourceUrl(value, origin);
  if (Array.isArray(value)) return value.map(v => rewriteUrlsDeep(v, origin, depth + 1));
  if (value && typeof value === 'object') {
    const obj = value as Record<string, unknown>;
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(obj)) {
      out[k] = rewriteUrlsDeep(v, origin, depth + 1);
    }
    return out;
  }
  return value;
}

function rewriteJavDbJsonText(text: string, origin: string): string {
  try {
    const parsed = JSON.parse(text) as unknown;
    const rewritten = rewriteUrlsDeep(parsed, origin);
    return JSON.stringify(rewritten);
  } catch {
    // 容错：不解析则不重写，避免破坏上游数据
    return text;
  }
}

function joinUrlPath(base: string, part: string): string {
  if (!base.endsWith('/')) base += '/';
  if (part.startsWith('/')) part = part.slice(1);
  return base + part;
}

function rewriteM3u8Text(text: string, origin: string, currentProxyPath: string): string {
  // currentProxyPath 形如 /api/javdb/preview/<upstream_path>
  const dir = currentProxyPath.includes('/') ? currentProxyPath.slice(0, currentProxyPath.lastIndexOf('/') + 1) : currentProxyPath;

  const rewriteUri = (uri: string): string => {
    const raw = uri.trim();
    if (!raw) return uri;
    if (raw.startsWith('http://') || raw.startsWith('https://')) {
      return rewriteJavDbResourceUrl(raw, origin);
    }
    if (raw.startsWith('/')) {
      return `${origin}${JAVDB_PROXY_PREVIEW_PREFIX}${raw}`;
    }
    return `${origin}${joinUrlPath(dir, raw)}`;
  };

  const lines = text.split(/\r?\n/);
  const out: string[] = [];
  for (const line of lines) {
    if (line.startsWith('#EXT-X-KEY:')) {
      out.push(line.replace(/URI="([^"]+)"/g, (_m, uri) => `URI="${rewriteUri(String(uri))}"`));
      continue;
    }
    if (!line || line.startsWith('#')) {
      out.push(line);
      continue;
    }
    out.push(rewriteUri(line));
  }
  return out.join('\n');
}

function isLikelyM3u8(contentType: string | null, path: string, textSample?: string): boolean {
  const ct = (contentType ?? '').toLowerCase();
  if (ct.includes('application/vnd.apple.mpegurl')) return true;
  if (ct.includes('application/x-mpegurl')) return true;
  if (ct.includes('audio/mpegurl')) return true;
  if (path.toLowerCase().endsWith('.m3u8')) return true;
  if (textSample && textSample.trimStart().startsWith('#EXTM3U')) return true;
  return false;
}

export { canonicalizeUrl, filterReplayableHeaders, isLikelyM3u8, mergeCorsHeaders, parseBytesRangeHeader, rewriteJavDbJsonText, rewriteM3u8Text };
