import { PAGE_LANGS } from './i18n';
import type { PageLang } from './i18n';

// HTTP 响应、语言选择与通用 Cookie 操作。

const LANG_COOKIE = 'jm_lang';

const SUPPORTED_LANGS = new Set<string>(PAGE_LANGS as unknown as string[]);

function jsonResponse(body: unknown, init?: ResponseInit): Response {
  const headers = new Headers(init?.headers);
  if (!headers.has('Content-Type')) headers.set('Content-Type', 'application/json');
  // Default to no-store unless the caller explicitly opts into caching.
  // This avoids stale admin/public data when sitting behind CDN/browser caches.
  if (!headers.has('Cache-Control')) headers.set('Cache-Control', 'no-store');
  return new Response(JSON.stringify(body), { ...init, headers });
}

function htmlResponse(body: string, init?: ResponseInit): Response {
  const headers = new Headers(init?.headers);
  if (!headers.has('Content-Type')) headers.set('Content-Type', 'text/html; charset=utf-8');
  // Pages are dynamic (admin/public variants, language cookies, data tables).
  // Prevent serving an old HTML shell due to intermediary caches.
  if (!headers.has('Cache-Control')) headers.set('Cache-Control', 'private, no-store, max-age=0');
  return new Response(body, { ...init, headers });
}

function normalizePageLang(value: unknown): PageLang | null {
  if (typeof value !== 'string') return null;
  const raw = value.trim().toLowerCase();
  if (!raw) return null;

  // Exact match first (e.g. "pt-br" if you have pt-br.json)
  if (SUPPORTED_LANGS.has(raw)) return raw as PageLang;

  // Fallback to primary tag (e.g. "zh-Hans" => "zh")
  const primary = raw.split(/[,;]/)[0].trim().split(/[_-]/)[0];
  if (SUPPORTED_LANGS.has(primary)) return primary as PageLang;

  return null;
}

function buildLangCookie(request: Request, lang: PageLang): string {
  // Session cookie: no Max-Age/Expires, so it persists only for the current browser session.
  return `${LANG_COOKIE}=${encodeURIComponent(lang)}; Path=/; SameSite=Lax${buildCookieSecuritySuffix(request)}`;
}

function getLangInfo(request: Request): { lang: PageLang; setCookie: string | null } {
  const url = new URL(request.url);
  const fromQuery = normalizePageLang(url.searchParams.get('lang'));
  const cookies = parseCookies(request);
  const fromCookie = normalizePageLang(cookies[LANG_COOKIE]);

  // Requirement: first visit defaults to English (ignore Accept-Language).
  const lang = fromQuery ?? fromCookie ?? 'en';

  // If the user explicitly set a lang in the URL, remember it for this session.
  const setCookie = fromQuery && fromQuery !== fromCookie ? buildLangCookie(request, fromQuery) : null;
  return { lang, setCookie };
}

function withSetCookie(response: Response, cookie: string | null): Response {
  if (!cookie) return response;
  const headers = new Headers(response.headers);
  headers.append('Set-Cookie', cookie);
  return new Response(response.body, { status: response.status, statusText: response.statusText, headers });
}

function parseCookies(request: Request): Record<string, string> {
  const raw = request.headers.get('Cookie') || '';
  const cookies: Record<string, string> = {};
  for (const part of raw.split(';')) {
    const [name, ...rest] = part.trim().split('=');
    if (!name) continue;
    cookies[name] = decodeURIComponent(rest.join('=') || '');
  }
  return cookies;
}

function buildCookieSecuritySuffix(request: Request): string {
  const url = new URL(request.url);
  return url.protocol === 'https:' ? '; Secure' : '';
}

function htmlRedirect(url: string, setCookie?: string): Response {
  const headers = new Headers({ Location: url });
  if (setCookie) {
    headers.append('Set-Cookie', setCookie);
  }
  return new Response(null, { status: 302, headers });
}

function normalizeText(value: unknown, maxLen = 256): string | null {
  if (value === null || value === undefined) return null;
  const str = String(value).trim();
  if (!str) return null;
  return str.length > maxLen ? str.slice(0, maxLen) : str;
}

export { buildCookieSecuritySuffix, getLangInfo, htmlRedirect, htmlResponse, jsonResponse, normalizeText, parseCookies, withSetCookie };
