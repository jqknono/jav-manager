import { isAdminRequest } from './admin/auth';
import { handlePageRoutes } from './admin/routes';
import { getWorkerVersion } from './env';
import type { Env } from './env';
import { FAVICON_ICO_BYTES } from './favicon';
import { getLangInfo, jsonResponse, withSetCookie } from './http';
import { JAVDB_PROXY_PREFIX, buildJavDbCorsHeaders } from './javdb/config';
import { getJavDbDomain } from './javdb/domain';
import { handleJavDbProxy } from './javdb/routes';
import { handleJavInfoRoutes } from './javinfo';
import { ensureUserIdBackfill, handleTelemetryRoutes } from './telemetry';
import type { RouteContext } from './types';

// Worker 薄入口：公共上下文、预检和按职责分派。

export type { Env } from './env';

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const url = new URL(request.url);

    const path = url.pathname;
    // 代理命名空间按路径段匹配，让 /api/javdb-domain 等同级接口独立分派。
    const isJavDbProxyPath = path === JAVDB_PROXY_PREFIX || path.startsWith(`${JAVDB_PROXY_PREFIX}/`);

    const { lang, setCookie: langCookie } = getLangInfo(request);

    const respond = (res: Response) => withSetCookie(res, langCookie);

    const admin = isAdminRequest(request, env);

    // CORS headers
    const corsHeaders = {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, HEAD, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, X-Proxy-Key',
    };

    const javdbCorsHeaders = buildJavDbCorsHeaders();

    if (request.method === 'OPTIONS') {
      if (isJavDbProxyPath) {
        return respond(new Response(null, { headers: javdbCorsHeaders }));
      }
      return respond(new Response(null, { headers: corsHeaders }));
    }

    const context: RouteContext = { request, env, ctx, url, path, lang, admin, corsHeaders, javdbCorsHeaders, respond };
    if (isJavDbProxyPath) {
      return handleJavDbProxy(context);
    }

    // GET /favicon.ico - Site icon
    if (path === '/favicon.ico' && (request.method === 'GET' || request.method === 'HEAD')) {
      const headers = new Headers({
        'Content-Type': 'image/x-icon',
        'Cache-Control': 'public, max-age=31536000, immutable',
      });
      return respond(new Response(request.method === 'HEAD' ? null : FAVICON_ICO_BYTES, { headers }));
    }

    // Best-effort background migration for existing deployments.
    if (path === '/api/user' || path === '/api/data' || path === '/api/stats' || path === '/api/users') {
      ctx.waitUntil(ensureUserIdBackfill(env));
    }

    const dataResponse = await handleTelemetryRoutes(context) ?? await handleJavInfoRoutes(context);
    if (dataResponse) return dataResponse;

    // GET /api/javdb-domain - Get latest JavDB domain
    if (path === '/api/javdb-domain' && request.method === 'GET') {
      return respond(await getJavDbDomain(corsHeaders));
    }

    // GET /api/version - Get current deployed worker version (for debugging deployments)
    if (path === '/api/version' && request.method === 'GET') {
      return respond(jsonResponse({ version: getWorkerVersion(env) }, { headers: corsHeaders }));
    }

    const pageResponse = await handlePageRoutes(context);
    if (pageResponse) return pageResponse;

    return respond(new Response('Not Found', { status: 404 }));
  },
};
