import { htmlRedirect, htmlResponse, normalizeText } from '../http';
import { TEXT } from '../i18n';
import { getAdminLoginPage, getHomePage, getJavPage, getUserPage } from '../pages';
import type { RouteContext } from '../types';
import { buildAdminSessionCookie, buildClearAdminSessionCookie, getAdminCredentials } from './auth';

// 页面、管理员登录与退出路由。

export async function handlePageRoutes(context: RouteContext): Promise<Response | null> {
  const { request, env, url, path, lang, admin, respond } = context;

  // GET / - Home page
  if (path === '/' && request.method === 'GET') {
    return respond(htmlResponse(getHomePage(url, lang)));
  }

  // GET /user - Telemetry page
  if (path === '/user' && request.method === 'GET') {
    if (!admin) {
      const redirectUrl = new URL(url.toString());
      redirectUrl.pathname = '/admin';
      redirectUrl.searchParams.set('lang', lang);
      return respond(htmlRedirect(redirectUrl.toString()));
    }
    return respond(htmlResponse(getUserPage(url, lang, true)));
  }

  // GET /jav - JavInfo page
  if (path === '/jav' && request.method === 'GET') {
    return respond(htmlResponse(getJavPage(url, lang, { adminMode: admin })));
  }

  // GET /admin - Hidden admin portal
  if (path === '/admin' && request.method === 'GET') {
    if (admin) {
      return respond(htmlResponse(getJavPage(url, lang, { adminMode: true })));
    }
    return respond(htmlResponse(getAdminLoginPage(url, lang)));
  }

  // POST /admin/login - Admin login
  if (path === '/admin/login' && request.method === 'POST') {
    const credentials = getAdminCredentials(env, request);
    if (!credentials) {
      return respond(htmlResponse(getAdminLoginPage(url, lang, TEXT[lang].adminNotConfigured), { status: 503 }));
    }
    const form = await request.formData();
    const username = normalizeText(form.get('username'), 128) ?? '';
    const password = normalizeText(form.get('password'), 256) ?? '';
    if (username === credentials.username && password === credentials.password) {
      const cookie = buildAdminSessionCookie(env, request);
      if (!cookie) {
        return respond(htmlResponse(getAdminLoginPage(url, lang, TEXT[lang].adminNotConfigured), { status: 503 }));
      }
      const redirectUrl = new URL(url.toString());
      redirectUrl.pathname = '/admin';
      redirectUrl.searchParams.set('lang', lang);
      return respond(htmlRedirect(redirectUrl.toString(), cookie));
    }
    return respond(htmlResponse(getAdminLoginPage(url, lang, TEXT[lang].adminInvalidCreds), { status: 401 }));
  }

  // POST /admin/logout - Clear admin session
  if (path === '/admin/logout' && request.method === 'POST') {
    const redirectUrl = new URL(url.toString());
    redirectUrl.pathname = '/admin';
    redirectUrl.searchParams.set('lang', lang);
    return respond(htmlRedirect(redirectUrl.toString(), buildClearAdminSessionCookie(request)));
  }
  return null;
}

