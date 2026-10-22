import type { Env } from '../env';
import { normalizeText } from '../http';

// JavDB 上游配置、代理认证与 CORS 契约。

// JavDB App API / CDN proxy settings
const JAVDB_APP_API_HOST_PRIMARY = 'apidd.spthgb.com';

const JAVDB_APP_API_HOST_FALLBACK = 'apidd.czssdgz.com';

const JAVDB_IMG_HOST = 'tp.cmastd.com';

const JAVDB_PREVIEW_HOST = 'jdforrepam.com';

const JAVDB_PROXY_PREFIX = '/api/javdb';

const JAVDB_PROXY_APP_PREFIX = '/api/javdb/app';

const JAVDB_PROXY_IMG_PREFIX = '/api/javdb/img';

const JAVDB_PROXY_PREVIEW_PREFIX = '/api/javdb/preview';

const JAVDB_RECENT_SEARCH_KEY = 'javdb:recent:search';

const JAVDB_RECENT_SORT_KEY = 'javdb:recent:sort';

const JAVDB_RECENT_MAX_ITEMS = 200;

const JAVDB_RECENT_TTL_SECONDS = 7 * 24 * 60 * 60;

// 默认值来自 doc/javdb-app-api/README.md（2026-03-18）
const DEFAULT_JAVDB_APP_SECRET =
  '71cf27bb3c0bcdf207b64abecddc970098c7421ee7203b9cdae54478478a199e7d5a6e1a57691123c1a931c057842fb73ba3b3c83bcd69c17ccf174081e3d8aa';

const DEFAULT_JAVDB_APP_SALT = 'lpw6vgqzsp';

function buildJavDbCorsHeaders(): Record<string, string> {
  return {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, HEAD, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, X-Proxy-Key, Range, If-None-Match, If-Modified-Since, Accept-Language',
    'Access-Control-Expose-Headers': 'Content-Type, Content-Length, Accept-Ranges, Content-Range, ETag, Last-Modified',
  };
}

function isProxyKeyAuthorized(request: Request, env: Env): boolean {
  const expected = normalizeText(env.JAVDB_PROXY_KEY, 256);
  if (!expected) return false;
  const provided = normalizeText(request.headers.get('X-Proxy-Key'), 256);
  return !!provided && provided === expected;
}

function getJavDbAppSecret(env: Env): string {
  return normalizeText(env.JAVDB_APP_SECRET, 512) ?? DEFAULT_JAVDB_APP_SECRET;
}

function getJavDbAppSalt(env: Env): string {
  return normalizeText(env.JAVDB_APP_SALT, 64) ?? DEFAULT_JAVDB_APP_SALT;
}

export { JAVDB_APP_API_HOST_FALLBACK, JAVDB_APP_API_HOST_PRIMARY, JAVDB_IMG_HOST, JAVDB_PREVIEW_HOST, JAVDB_PROXY_APP_PREFIX, JAVDB_PROXY_IMG_PREFIX, JAVDB_PROXY_PREFIX, JAVDB_PROXY_PREVIEW_PREFIX, JAVDB_RECENT_MAX_ITEMS, JAVDB_RECENT_SEARCH_KEY, JAVDB_RECENT_SORT_KEY, JAVDB_RECENT_TTL_SECONDS, buildJavDbCorsHeaders, getJavDbAppSalt, getJavDbAppSecret, isProxyKeyAuthorized };
