import type { Env } from '../env';
import { buildCookieSecuritySuffix, normalizeText, parseCookies } from '../http';

// 管理员凭据与会话 Cookie；保留现有默认凭据和认证规则。

const ADMIN_SESSION_COOKIE = 'jm_admin_session';

const ADMIN_SESSION_MAX_AGE = 60 * 60 * 12;

const LOCAL_DEV_ADMIN_USERNAME = 'test';

const LOCAL_DEV_ADMIN_PASSWORD = 'test';

function getAdminCredentials(env: Env, _request: Request): { username: string; password: string } | null {
  const username = normalizeText(env.ADMIN_USERNAME, 128) ?? '';
  const password = normalizeText(env.ADMIN_PASSWORD, 256) ?? '';
  if (username && password) return { username, password };

  return { username: LOCAL_DEV_ADMIN_USERNAME, password: LOCAL_DEV_ADMIN_PASSWORD };
}

function createAdminSessionToken(env: Env, request: Request): string | null {
  const credentials = getAdminCredentials(env, request);
  if (!credentials) return null;
  return btoa(`${credentials.username}:${credentials.password}`);
}

function isAdminRequest(request: Request, env: Env): boolean {
  const token = createAdminSessionToken(env, request);
  if (!token) return false;
  const cookies = parseCookies(request);
  return cookies[ADMIN_SESSION_COOKIE] === token;
}

function buildAdminSessionCookie(env: Env, request: Request): string | null {
  const token = createAdminSessionToken(env, request);
  if (!token) return null;
  return `${ADMIN_SESSION_COOKIE}=${encodeURIComponent(token)}; Path=/; HttpOnly${buildCookieSecuritySuffix(request)}; SameSite=Strict; Max-Age=${ADMIN_SESSION_MAX_AGE}`;
}

function buildClearAdminSessionCookie(request: Request): string {
  return `${ADMIN_SESSION_COOKIE}=; Path=/; HttpOnly${buildCookieSecuritySuffix(request)}; SameSite=Strict; Max-Age=0`;
}

export { buildAdminSessionCookie, buildClearAdminSessionCookie, getAdminCredentials, isAdminRequest };
