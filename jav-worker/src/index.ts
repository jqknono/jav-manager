import { FAVICON_ICO_BYTES } from './favicon';
import { PageLang, PAGE_LANGS, TEXT } from './i18n';
import { getAdminLoginPage, getHomePage, getJavPage, getUserPage } from './pages';

export interface Env {
  DB: D1Database;
  ADMIN_USERNAME?: string;
  ADMIN_PASSWORD?: string;
  // Optional build identifier (set via wrangler vars or dashboard).
  // Suggested value: git SHA or YYYYMMDD-HHMM.
  WORKER_VERSION?: string;
  // Cloudflare version metadata binding (recommended).
  WORKER_VERSION_METADATA?: {
    id: string;
    tag: string;
    timestamp: string;
  };
}

interface TelemetryPayload {
  machine_name: string;
  user_name: string;
  app_version?: string;
  os_info?: string;
  event_type?: string;
  event_data?: string;
}

interface UserRecord {
  id: number;
  user_id: string | null;
  machine_name: string;
  user_name: string;
  app_version: string | null;
  os_info: string | null;
  event_type: string;
  event_data: string | null;
  ip_address: string | null;
  user_agent: string | null;
  country: string | null;
  region: string | null;
  city: string | null;
  created_at: string;
}

interface JavInfoRecord {
  jav_id: string;
  title: string | null;
  title_zh: string | null;
  cover_url: string | null;
  release_date: string | null;
  duration: number | null;
  director: string | null;
  maker: string | null;
  publisher: string | null;
  series: string | null;
  actors_json: string | null;
  categories_json: string | null;
  torrents_json: string | null;
  detail_url: string | null;
  search_count: number | null;
  created_at: string;
  updated_at: string;
}

const ADMIN_SESSION_COOKIE = 'jm_admin_session';
const ADMIN_SESSION_MAX_AGE = 60 * 60 * 12;
const LANG_COOKIE = 'jm_lang';
const LOCAL_DEV_ADMIN_USERNAME = 'test';
const LOCAL_DEV_ADMIN_PASSWORD = 'test';

const SUPPORTED_LANGS = new Set<string>(PAGE_LANGS as unknown as string[]);

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

type TelemetryWriteGate = { t: number; sig: string };
const TELEMETRY_WRITE_GATE = new Map<string, TelemetryWriteGate>();
const TELEMETRY_WRITE_GATE_MAX = 10000;
const TELEMETRY_MIN_INTERVAL_MS = 60_000; // allow at most 1 write/min/user per isolate
const TELEMETRY_DUP_INTERVAL_MS = 10 * 60_000; // suppress identical event payloads for longer
const TELEMETRY_PRUNE_EVERY_N_INSERTS = 50; // reduce DELETE frequency
let telemetryInsertCount = 0;

function shouldWriteTelemetry(userId: string, sig: string): boolean {
  const now = Date.now();
  const prev = TELEMETRY_WRITE_GATE.get(userId);
  if (!prev) {
    if (TELEMETRY_WRITE_GATE.size >= TELEMETRY_WRITE_GATE_MAX) TELEMETRY_WRITE_GATE.clear();
    TELEMETRY_WRITE_GATE.set(userId, { t: now, sig });
    return true;
  }

  if (sig === prev.sig && now - prev.t < TELEMETRY_DUP_INTERVAL_MS) return false;
  if (now - prev.t < TELEMETRY_MIN_INTERVAL_MS) return false;

  TELEMETRY_WRITE_GATE.set(userId, { t: now, sig });
  return true;
}

let schemaInit: Promise<void> | null = null;
let userIdBackfill: Promise<void> | null = null;

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

function isAdminRequest(request: Request, env: Env): boolean {
  const token = createAdminSessionToken(env, request);
  if (!token) return false;
  const cookies = parseCookies(request);
  return cookies[ADMIN_SESSION_COOKIE] === token;
}

function buildCookieSecuritySuffix(request: Request): string {
  const url = new URL(request.url);
  return url.protocol === 'https:' ? '; Secure' : '';
}

function buildAdminSessionCookie(env: Env, request: Request): string | null {
  const token = createAdminSessionToken(env, request);
  if (!token) return null;
  return `${ADMIN_SESSION_COOKIE}=${encodeURIComponent(token)}; Path=/; HttpOnly${buildCookieSecuritySuffix(request)}; SameSite=Strict; Max-Age=${ADMIN_SESSION_MAX_AGE}`;
}

function buildClearAdminSessionCookie(request: Request): string {
  return `${ADMIN_SESSION_COOKIE}=; Path=/; HttpOnly${buildCookieSecuritySuffix(request)}; SameSite=Strict; Max-Age=0`;
}

function htmlRedirect(url: string, setCookie?: string): Response {
  const headers = new Headers({ Location: url });
  if (setCookie) {
    headers.append('Set-Cookie', setCookie);
  }
  return new Response(null, { status: 302, headers });
}

function normalizeVersionLabel(raw: unknown): string | null {
  if (typeof raw !== 'string') return null;
  const value = raw.trim();
  if (!value) return null;
  const lower = value.toLowerCase();
  if (lower === 'dev' || lower === 'unknown') return null;
  return value;
}

function getWorkerVersion(env: Env): string | null {
  // Prefer Cloudflare's actual deployed version metadata.
  const metadata = env.WORKER_VERSION_METADATA;
  if (metadata && typeof metadata.id === 'string' && metadata.id.trim()) {
    const id = metadata.id.trim();
    const tag = normalizeVersionLabel(metadata.tag);
    if (tag) return `${tag} (${id.slice(0, 8)})`;
    return id.slice(0, 8);
  }

  // Fallback to manually configured version variable.
  return normalizeVersionLabel(env.WORKER_VERSION);
}

async function ensureSchema(env: Env): Promise<void> {
  if (schemaInit) return schemaInit;

  schemaInit = (async () => {
    const tableExists = async (table: string): Promise<boolean> => {
      const result = await env.DB.prepare(
        `SELECT name FROM sqlite_master WHERE type = 'table' AND name = ? LIMIT 1;`
      ).bind(table).first<{ name: string }>();
      return !!result?.name;
    };

    // Forward-only migrations for existing tables (safe no-ops if already present).
    const ensureColumn = async (table: string, column: string, columnType: string) => {
      const info = await env.DB.prepare(`PRAGMA table_info('${table}');`).all<{ name: string }>();
      const existing = new Set((info.results ?? []).map(r => r.name));
      if (existing.has(column)) return;
      await env.DB.prepare(`ALTER TABLE ${table} ADD COLUMN ${column} ${columnType};`).run();
    };

    // User table (formerly "telemetry")
    // Keep only two logical tables: user + javinfo.
    // Migrate legacy deployments by renaming telemetry -> user.
    if (!(await tableExists('user'))) {
      if (await tableExists('telemetry')) {
        await env.DB.prepare(`ALTER TABLE telemetry RENAME TO user;`).run();
      } else {
        await env.DB.prepare(`
          CREATE TABLE IF NOT EXISTS user (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id TEXT,
            machine_name TEXT NOT NULL,
            user_name TEXT NOT NULL,
            app_version TEXT,
            os_info TEXT,
            event_type TEXT DEFAULT 'startup',
            event_data TEXT,
            ip_address TEXT,
            user_agent TEXT,
            country TEXT,
            region TEXT,
            city TEXT,
            created_at TEXT DEFAULT (datetime('now'))
          );
        `).run();
      }
    }

    // Ensure newly-added columns exist before creating dependent indices.
    await ensureColumn('user', 'user_id', 'TEXT');
    await ensureColumn('user', 'region', 'TEXT');

    await env.DB.prepare(`CREATE INDEX IF NOT EXISTS idx_user_created_at ON user(created_at DESC);`).run();
    await env.DB.prepare(`CREATE INDEX IF NOT EXISTS idx_user_user_id ON user(user_id);`).run();
    await env.DB.prepare(`CREATE INDEX IF NOT EXISTS idx_user_user_id_created_at ON user(user_id, created_at DESC);`).run();
    await env.DB.prepare(`CREATE INDEX IF NOT EXISTS idx_user_machine_name ON user(machine_name);`).run();
    await env.DB.prepare(`CREATE INDEX IF NOT EXISTS idx_user_user_name ON user(user_name);`).run();

    // JavInfo cache table (intentionally excludes torrent/magnet data)
    await env.DB.prepare(`
      CREATE TABLE IF NOT EXISTS javinfo (
        jav_id TEXT PRIMARY KEY,
        payload_json TEXT NOT NULL,
        title TEXT,
        title_zh TEXT,
        cover_url TEXT,
        release_date TEXT,
        duration INTEGER,
        director TEXT,
        maker TEXT,
        publisher TEXT,
        series TEXT,
        actors_json TEXT,
        categories_json TEXT,
        torrents_json TEXT,
        detail_url TEXT,
        created_at TEXT DEFAULT (datetime('now')),
        updated_at TEXT DEFAULT (datetime('now'))
      );
    `).run();

    await ensureColumn('javinfo', 'title_zh', 'TEXT');
    await ensureColumn('javinfo', 'torrents_json', 'TEXT');
    await ensureColumn('javinfo', 'search_count', 'INTEGER NOT NULL DEFAULT 0');

    await env.DB.prepare(`CREATE INDEX IF NOT EXISTS idx_javinfo_updated_at ON javinfo(updated_at DESC);`).run();
    await env.DB.prepare(`CREATE INDEX IF NOT EXISTS idx_javinfo_release_date ON javinfo(release_date);`).run();
  })();

  return schemaInit;
}

function parseJsonArray(value: string | null): unknown[] {
  if (!value) return [];
  const parsed = JSON.parse(value);
  return Array.isArray(parsed) ? parsed : [];
}

function normalizeText(value: unknown, maxLen = 256): string | null {
  if (value === null || value === undefined) return null;
  const str = String(value).trim();
  if (!str) return null;
  return str.length > maxLen ? str.slice(0, maxLen) : str;
}

function toCategoryLike(category: string): string {
  const escaped = category
    .replace(/\\/g, '\\\\')
    .replace(/%/g, '\\%')
    .replace(/_/g, '\\_')
    .replace(/"/g, '\\"');
  return `%"${escaped}"%`;
}

function toActorLike(actor: string): string {
  return toCategoryLike(actor);
}

type PublicBestTorrent = {
  title: string | null;
  magnet_link: string | null;
  size: number;
  score: number;
};

function toFiniteNumber(value: unknown, fallback = 0): number {
  const num = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(num) ? num : fallback;
}

function toBool(value: unknown): boolean {
  if (typeof value === 'boolean') return value;
  if (typeof value === 'number') return value !== 0;
  if (typeof value === 'string') {
    const v = value.trim().toLowerCase();
    return v === '1' || v === 'true' || v === 'yes' || v === 'y';
  }
  return false;
}

function getBestTorrentForPublic(torrents: unknown[]): PublicBestTorrent | null {
  if (!Array.isArray(torrents) || torrents.length === 0) return null;

  let best: PublicBestTorrent | null = null;
  for (const item of torrents) {
    if (!item || typeof item !== 'object') continue;
    const t = item as Record<string, unknown>;
    const magnet = normalizeText(t.magnet_link ?? t.magnetLink, 4096);
    if (!magnet) continue;

    const title = normalizeText(t.title, 512);
    const size = toFiniteNumber(t.size, 0);
    const providedScore = toFiniteNumber(t.weight_score ?? t.weightScore, NaN);
    const uc = toBool(t.has_uncensored_marker ?? t.hasUncensoredMarker);
    const sub = toBool(t.has_subtitle ?? t.hasSubtitle);
    const hd = toBool(t.has_hd ?? t.hasHd);
    const computedScore = (uc ? 5 : 0) + (sub ? 3 : 0) + (hd ? 1 : 0);
    const score = Number.isFinite(providedScore) && providedScore > 0 ? providedScore : computedScore;

    const candidate: PublicBestTorrent = {
      title,
      magnet_link: magnet,
      size,
      score,
    };

    if (!best) {
      best = candidate;
      continue;
    }

    if (candidate.score > best.score || (candidate.score === best.score && candidate.size > best.size)) {
      best = candidate;
    }
  }

  return best;
}

function normalizeEventType(value: unknown): string {
  const raw = normalizeText(value, 64);
  if (!raw) return 'startup';
  // Keep a stable key so clients can add new event types without worker updates.
  return raw
    .toLowerCase()
    .replace(/\s+/g, '_')
    .replace(/[^a-z0-9._-]/g, '_')
    .slice(0, 64);
}

function getCfLocation(cf: unknown): { country: string | null; region: string | null; city: string | null } {
  const anyCf = cf as { country?: unknown; region?: unknown; city?: unknown } | null | undefined;
  return {
    country: normalizeText(anyCf?.country, 64),
    region: normalizeText(anyCf?.region, 64),
    city: normalizeText(anyCf?.city, 64),
  };
}

function hexFromBuffer(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let out = '';
  for (let i = 0; i < bytes.length; i++) {
    out += bytes[i].toString(16).padStart(2, '0');
  }
  return out;
}

async function computeUserId(input: {
  machineName: string;
  userName: string;
  country: string | null;
  region: string | null;
  city: string | null;
}): Promise<string> {
  const key = [
    input.machineName,
    input.userName,
    input.country ?? '',
    input.region ?? '',
    input.city ?? '',
  ].map(v => String(v).trim().toLowerCase()).join('|');

  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(key));
  // 128-bit is plenty and keeps IDs shorter for URLs/UI.
  return hexFromBuffer(digest).slice(0, 32);
}

async function backfillMissingUserIds(env: Env): Promise<void> {
  // Best-effort background migration for existing deployments.
  // Keep it bounded so it doesn't consume too much CPU/time per cold start.
  await ensureSchema(env);

  for (let round = 0; round < 5; round++) {
    const rows = await env.DB.prepare(`
      SELECT id, machine_name, user_name, country, region, city
      FROM user
      WHERE user_id IS NULL OR user_id = ''
      ORDER BY id ASC
      LIMIT 200;
    `).all<Pick<UserRecord, 'id' | 'machine_name' | 'user_name' | 'country' | 'region' | 'city'>>();

    const batch = rows.results ?? [];
    if (batch.length === 0) return;

    for (const row of batch) {
      const userId = await computeUserId({
        machineName: row.machine_name ?? 'unknown',
        userName: row.user_name ?? 'unknown',
        country: row.country ?? null,
        region: row.region ?? null,
        city: row.city ?? null,
      });
      await env.DB.prepare(`UPDATE user SET user_id = ? WHERE id = ? AND (user_id IS NULL OR user_id = '');`)
        .bind(userId, row.id)
        .run();
    }
  }
}

function ensureUserIdBackfill(env: Env): Promise<void> {
  if (userIdBackfill) return userIdBackfill;
  userIdBackfill = backfillMissingUserIds(env).catch(() => {});
  return userIdBackfill;
}

async function pruneOldUserEvents(env: Env, userId: string, keep: number): Promise<void> {
  // Delete events older than the newest `keep` records for this user.
  // The ORDER BY includes id to avoid ties on second-resolution timestamps.
  await env.DB.prepare(`
    DELETE FROM user
    WHERE id IN (
      SELECT id
      FROM user
      WHERE user_id = ?
      ORDER BY created_at DESC, id DESC
      LIMIT -1 OFFSET ?
    );
  `).bind(userId, keep).run();
}

type JavInfoPayload = {
  jav_id?: string;
  javId?: string;
  title?: string;
  title_zh?: string;
  titleZh?: string;
  cover_url?: string;
  coverUrl?: string;
  release_date?: string;
  releaseDate?: string;
  duration?: number;
  director?: string;
  maker?: string;
  publisher?: string;
  series?: string;
  actors?: string[];
  categories?: string[];
  torrents?: unknown[];
  detail_url?: string;
  detailUrl?: string;
};

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const url = new URL(request.url);
    const path = url.pathname;
    const { lang, setCookie: langCookie } = getLangInfo(request);
    const respond = (res: Response) => withSetCookie(res, langCookie);
    const admin = isAdminRequest(request, env);

    // CORS headers
    const corsHeaders = {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    };

    if (request.method === 'OPTIONS') {
      return respond(new Response(null, { headers: corsHeaders }));
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

    // POST /api/telemetry - Collect telemetry data (non-blocking)
    if (path === '/api/telemetry' && request.method === 'POST') {
      // IMPORTANT: read request body before returning a response.
      // In production, trying to read the request stream inside waitUntil after the response is sent
      // can throw: "Can't read from request stream after response has been sent."
      let payload: unknown = null;
      try {
        payload = await request.json();
      } catch {
        payload = null;
      }

      // Use waitUntil for non-blocking database write
      ctx.waitUntil(this.saveTelemetry(payload, request, env));
      return respond(jsonResponse({ success: true }, { headers: corsHeaders }));
    }

    // GET /api/stats - Get statistics
    if (path === '/api/stats' && request.method === 'GET') {
      const userId = url.searchParams.get('userId');
      return respond(await this.getStats(env, corsHeaders, userId));
    }

    // GET /api/javinfo - Get paginated JavInfo data
    if (path === '/api/javinfo' && request.method === 'GET') {
      const page = parseInt(url.searchParams.get('page') || '1', 10);
      const pageSize = parseInt(url.searchParams.get('pageSize') || '20', 10);
      const category = url.searchParams.get('category');
      const actor = url.searchParams.get('actor');
      return respond(await this.getJavInfoData(env, page, pageSize, corsHeaders, category, actor, admin));
    }

    // GET /api/javinfo/categories - Category filter options
    if (path === '/api/javinfo/categories' && request.method === 'GET') {
      return respond(await this.getJavCategories(env, corsHeaders));
    }

    // GET /api/javinfo/actors - Actor filter options
    if (path === '/api/javinfo/actors' && request.method === 'GET') {
      return respond(await this.getJavActors(env, corsHeaders));
    }

    // POST /api/javinfo/delete - Delete a javinfo record (admin only)
    if (path === '/api/javinfo/delete' && request.method === 'POST') {
      if (!admin) {
        return respond(jsonResponse({ error: 'Unauthorized' }, { status: 401, headers: corsHeaders }));
      }
      return respond(await this.deleteJavInfo(request, env, corsHeaders));
    }

    // POST /api/javinfo - Store JavInfo (idempotent)
    if (path === '/api/javinfo' && request.method === 'POST') {
      return respond(await this.saveJavInfo(request, env, corsHeaders));
    }

    // GET /api/user - Get paginated user data
    if (path === '/api/user' && request.method === 'GET') {
      if (!admin) {
        return respond(jsonResponse({ error: 'Unauthorized' }, { status: 401, headers: corsHeaders }));
      }
      const page = parseInt(url.searchParams.get('page') || '1', 10);
      const pageSize = parseInt(url.searchParams.get('pageSize') || '20', 10);
      const userId = url.searchParams.get('userId');
      return respond(await this.getData(env, page, pageSize, corsHeaders, userId));
    }

    // GET /api/data - Backward-compatible alias for /api/user
    if (path === '/api/data' && request.method === 'GET') {
      if (!admin) {
        return respond(jsonResponse({ error: 'Unauthorized' }, { status: 401, headers: corsHeaders }));
      }
      const page = parseInt(url.searchParams.get('page') || '1', 10);
      const pageSize = parseInt(url.searchParams.get('pageSize') || '20', 10);
      const userId = url.searchParams.get('userId');
      return respond(await this.getData(env, page, pageSize, corsHeaders, userId));
    }

    // GET /api/users - List users for filtering (latest row + event counts)
    if (path === '/api/users' && request.method === 'GET') {
      if (!admin) {
        return respond(jsonResponse({ error: 'Unauthorized' }, { status: 401, headers: corsHeaders }));
      }
      return respond(await this.getUsers(env, corsHeaders));
    }

    // GET /api/javdb-domain - Get latest JavDB domain
    if (path === '/api/javdb-domain' && request.method === 'GET') {
      return respond(await this.getJavDbDomain(corsHeaders));
    }

    // GET /api/version - Get current deployed worker version (for debugging deployments)
    if (path === '/api/version' && request.method === 'GET') {
      return respond(jsonResponse({ version: getWorkerVersion(env) }, { headers: corsHeaders }));
    }

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

    return respond(new Response('Not Found', { status: 404 }));
  },

  async saveTelemetry(payloadRaw: unknown, request: Request, env: Env): Promise<void> {
    try {
      await ensureSchema(env);
      const cf = request.cf;
      const location = getCfLocation(cf);
      const payload = (payloadRaw ?? {}) as Partial<TelemetryPayload>;
      const machineName = normalizeText(payload.machine_name, 128) ?? 'unknown';
      const userName = normalizeText(payload.user_name, 128) ?? 'unknown';
      const userId = await computeUserId({
        machineName,
        userName,
        country: location.country,
        region: location.region,
        city: location.city,
      });

      const eventType = normalizeEventType(payload.event_type);
      const eventData = normalizeText(payload.event_data, 512);
      const sig = `${eventType}|${eventData ?? ''}`;
      if (!shouldWriteTelemetry(userId, sig)) return;

      await env.DB.prepare(`
        INSERT INTO user (user_id, machine_name, user_name, app_version, os_info, event_type, event_data, ip_address, user_agent, country, region, city)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).bind(
        userId,
        machineName,
        userName,
        normalizeText(payload.app_version, 64),
        normalizeText(payload.os_info, 128),
        eventType,
        eventData,
        request.headers.get('CF-Connecting-IP') || null,
        request.headers.get('User-Agent') || null,
        location.country,
        location.region,
        location.city
      ).run();

      telemetryInsertCount += 1;
      if (telemetryInsertCount % TELEMETRY_PRUNE_EVERY_N_INSERTS === 0) {
        await pruneOldUserEvents(env, userId, 999);
      }
    } catch (error) {
      console.error('Failed to save telemetry:', error);
    }
  },

  async getStats(env: Env, corsHeaders: Record<string, string>, userIdRaw?: string | null): Promise<Response> {
    try {
      await ensureSchema(env);
      const userId = normalizeText(userIdRaw, 128);
      const cacheKey = `stats:${userId ?? ''}`;
      const cached = memCacheGet<unknown>(cacheKey, 15_000);
      if (cached) {
        return jsonResponse(cached, { headers: { ...corsHeaders, 'Cache-Control': 'private, max-age=15' } });
      }
      const totalResult = userId
        ? await env.DB.prepare('SELECT COUNT(*) as total FROM user WHERE user_id = ?').bind(userId).first<{ total: number }>()
        : await env.DB.prepare('SELECT COUNT(*) as total FROM user').first<{ total: number }>();

      const uniqueMachinesResult = userId
        ? await env.DB.prepare('SELECT COUNT(DISTINCT machine_name) as count FROM user WHERE user_id = ?').bind(userId).first<{ count: number }>()
        : await env.DB.prepare('SELECT COUNT(DISTINCT machine_name) as count FROM user').first<{ count: number }>();

      const uniqueUsersResult = userId
        ? await env.DB.prepare('SELECT COUNT(DISTINCT user_id) as count FROM user WHERE user_id = ?').bind(userId).first<{ count: number }>()
        : await env.DB.prepare(`SELECT COUNT(DISTINCT user_id) as count FROM user WHERE user_id IS NOT NULL AND user_id != ''`).first<{ count: number }>();

      const todayResult = userId
        ? await env.DB.prepare(`SELECT COUNT(*) as count FROM user WHERE user_id = ? AND date(created_at) = date('now')`).bind(userId).first<{ count: number }>()
        : await env.DB.prepare(`SELECT COUNT(*) as count FROM user WHERE date(created_at) = date('now')`).first<{ count: number }>();

      const javInfoTotalResult = await env.DB.prepare('SELECT COUNT(*) as total FROM javinfo').first<{ total: number }>();
      const javInfoTodayResult = await env.DB.prepare(`SELECT COUNT(*) as count FROM javinfo WHERE date(created_at) = date('now')`).first<{ count: number }>();

      const payload = {
        total_records: totalResult?.total || 0,
        unique_machines: uniqueMachinesResult?.count || 0,
        unique_users: uniqueUsersResult?.count || 0,
        today_count: todayResult?.count || 0,
        javinfo_total: javInfoTotalResult?.total || 0,
        javinfo_today: javInfoTodayResult?.count || 0,
        filter: userId ? { user_id: userId } : null,
      };
      memCacheSet(cacheKey, payload);
      return jsonResponse(payload, { headers: { ...corsHeaders, 'Cache-Control': 'private, max-age=15' } });
    } catch (error) {
      console.error('Failed to get stats:', error);
      // Fail soft so the UI can still render something.
      return jsonResponse({
        total_records: 0,
        unique_machines: 0,
        unique_users: 0,
        today_count: 0,
        javinfo_total: 0,
        javinfo_today: 0,
      }, { headers: corsHeaders });
    }
  },

  async saveJavInfo(request: Request, env: Env, corsHeaders: Record<string, string>): Promise<Response> {
    try {
      await ensureSchema(env);
      const payload: JavInfoPayload = await request.json();
      const javId = (payload.jav_id ?? payload.javId ?? '').trim();
      if (!javId) {
        return jsonResponse({ error: 'Missing jav_id' }, { status: 400, headers: corsHeaders });
      }

      // Idempotent insert: store only non-torrent metadata (avoid magnet distribution).
      const title = payload.title ?? null;
      const titleZh = payload.title_zh ?? payload.titleZh ?? null;
      const coverUrl = payload.cover_url ?? payload.coverUrl ?? null;
      const releaseDate = payload.release_date ?? payload.releaseDate ?? null;
      const duration = typeof payload.duration === 'number' ? payload.duration : null;
      const director = payload.director ?? null;
      const maker = payload.maker ?? null;
      const publisher = payload.publisher ?? null;
      const series = payload.series ?? null;
      const actorsJson = payload.actors ? JSON.stringify(payload.actors) : null;
      const categoriesJson = payload.categories ? JSON.stringify(payload.categories) : null;
      const torrentsJson = Array.isArray(payload.torrents) ? JSON.stringify(payload.torrents) : null;
      const detailUrl = payload.detail_url ?? payload.detailUrl ?? null;

      const payloadJson = JSON.stringify({
        jav_id: javId,
        title,
        title_zh: titleZh,
        cover_url: coverUrl,
        release_date: releaseDate,
        duration,
        director,
        maker,
        publisher,
        series,
        actors: payload.actors ?? [],
        categories: payload.categories ?? [],
        torrents: payload.torrents ?? [],
        detail_url: detailUrl,
      });

      const result = await env.DB.prepare(`
        INSERT INTO javinfo (
          jav_id, payload_json, title, title_zh, cover_url, release_date, duration,
          director, maker, publisher, series, actors_json, categories_json,
          torrents_json, detail_url, search_count, created_at, updated_at
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, datetime('now'), datetime('now'))
        ON CONFLICT(jav_id) DO UPDATE SET
          payload_json = excluded.payload_json,
          title = excluded.title,
          title_zh = excluded.title_zh,
          cover_url = excluded.cover_url,
          release_date = excluded.release_date,
          duration = excluded.duration,
          director = excluded.director,
          maker = excluded.maker,
          publisher = excluded.publisher,
          series = excluded.series,
          actors_json = excluded.actors_json,
          categories_json = excluded.categories_json,
          torrents_json = excluded.torrents_json,
          detail_url = excluded.detail_url,
          search_count = javinfo.search_count + 1,
          updated_at = datetime('now');
      `).bind(
        javId,
        payloadJson,
        title,
        titleZh,
        coverUrl,
        releaseDate,
        duration,
        director,
        maker,
        publisher,
        series,
        actorsJson,
        categoriesJson,
        torrentsJson,
        detailUrl
      ).run();

      const inserted = (result.meta?.last_row_id ?? 0) > 0;
      return jsonResponse({ jav_id: javId, inserted, existed: !inserted }, { headers: corsHeaders });
    } catch (error) {
      console.error('Failed to save javinfo:', error);
      return jsonResponse({ error: 'Failed to save javinfo' }, { status: 500, headers: corsHeaders });
    }
  },

  async getData(env: Env, page: number, pageSize: number, corsHeaders: Record<string, string>, userIdRaw?: string | null): Promise<Response> {
    try {
      await ensureSchema(env);
      const safePage = Number.isFinite(page) && page > 0 ? page : 1;
      const safePageSize = Math.min(Math.max(1, pageSize), 100);
      const safeOffset = (safePage - 1) * safePageSize;
      const userId = normalizeText(userIdRaw, 128);

      const countResult = userId
        ? await env.DB.prepare('SELECT COUNT(*) as total FROM user WHERE user_id = ?').bind(userId).first<{ total: number }>()
        : await env.DB.prepare('SELECT COUNT(*) as total FROM user').first<{ total: number }>();
      const total = countResult?.total ?? 0;

      const dataResult = userId
        ? await env.DB.prepare(`
            SELECT * FROM user
            WHERE user_id = ?
            ORDER BY created_at DESC, id DESC
            LIMIT ? OFFSET ?
          `).bind(userId, safePageSize, safeOffset).all<UserRecord>()
        : await env.DB.prepare(`
            SELECT * FROM user 
            ORDER BY created_at DESC, id DESC
            LIMIT ? OFFSET ?
          `).bind(safePageSize, safeOffset).all<UserRecord>();

      return jsonResponse({
        data: dataResult.results,
        pagination: {
          page: safePage,
          pageSize: safePageSize,
          total,
          totalPages: Math.ceil(total / safePageSize),
        },
        filter: userId ? { user_id: userId } : null,
      }, { headers: corsHeaders });
    } catch (error) {
      console.error('Failed to get data:', error);
      // Fail soft so the UI can render.
      return jsonResponse({
        data: [],
        pagination: { page: 1, pageSize: 20, total: 0, totalPages: 1 },
      }, { headers: corsHeaders });
    }
  },
  async getUsers(env: Env, corsHeaders: Record<string, string>): Promise<Response> {
    try {
      await ensureSchema(env);
      const cacheKey = 'users';
      const cached = memCacheGet<unknown>(cacheKey, 15_000);
      if (cached) {
        return jsonResponse(cached, { headers: { ...corsHeaders, 'Cache-Control': 'private, max-age=15' } });
      }

      const result = await env.DB.prepare(`
        SELECT
          u.user_id,
          u.machine_name,
          u.user_name,
          u.country,
          u.region,
          u.city,
          u.created_at as last_seen,
          stats.event_count
        FROM user u
        JOIN (
          SELECT user_id, MAX(id) as last_id, COUNT(*) as event_count
          FROM user
          WHERE user_id IS NOT NULL AND user_id != ''
          GROUP BY user_id
        ) stats
        ON u.id = stats.last_id
        ORDER BY u.id DESC
        LIMIT 500;
      `).all<{
        user_id: string;
        machine_name: string;
        user_name: string;
        country: string | null;
        region: string | null;
        city: string | null;
        last_seen: string;
        event_count: number;
      }>();

      const payload = { data: result.results ?? [] };
      memCacheSet(cacheKey, payload);
      return jsonResponse(payload, { headers: { ...corsHeaders, 'Cache-Control': 'private, max-age=15' } });
    } catch (error) {
      console.error('Failed to get users:', error);
      return jsonResponse({ data: [] }, { headers: corsHeaders });
    }
  },
  async getJavInfoData(
    env: Env,
    page: number,
    pageSize: number,
    corsHeaders: Record<string, string>,
    categoryRaw?: string | null,
    actorRaw?: string | null,
    admin = false,
  ): Promise<Response> {
    try {
      await ensureSchema(env);
      const safePage = Number.isFinite(page) && page > 0 ? page : 1;
      const safePageSize = Math.min(Math.max(1, pageSize), 100);
      const safeOffset = (safePage - 1) * safePageSize;
      const category = normalizeText(categoryRaw, 128);
      const actor = normalizeText(actorRaw, 128);
      const categoryLike = category ? toCategoryLike(category) : null;
      const actorLike = actor ? toActorLike(actor) : null;

      const whereClauses: string[] = [];
      const whereBinds: string[] = [];
      if (categoryLike) {
        whereClauses.push(`categories_json LIKE ? ESCAPE '\\'`);
        whereBinds.push(categoryLike);
      }
      if (actorLike) {
        whereClauses.push(`actors_json LIKE ? ESCAPE '\\'`);
        whereBinds.push(actorLike);
      }
      const whereClause = whereClauses.length > 0 ? `WHERE ${whereClauses.join(' AND ')}` : '';

      const countStatement = env.DB.prepare(`SELECT COUNT(*) as total FROM javinfo ${whereClause}`);
      const countResult = whereBinds.length > 0
        ? await countStatement.bind(...whereBinds).first<{ total: number }>()
        : await countStatement.first<{ total: number }>();
      const total = countResult?.total || 0;

      const dataResult = await env.DB.prepare(`
          SELECT
            jav_id, title, title_zh, cover_url, release_date, duration, director, maker, publisher, series,
            actors_json, categories_json, torrents_json, detail_url, search_count, created_at, updated_at
          FROM javinfo
          ${whereClause}
          ORDER BY updated_at DESC
          LIMIT ? OFFSET ?
        `).bind(...whereBinds, safePageSize, safeOffset).all<JavInfoRecord>();

      const data = (dataResult.results ?? []).map(record => {
        const actors = parseJsonArray(record.actors_json).filter(item => typeof item === 'string') as string[];
        const categories = parseJsonArray(record.categories_json).filter(item => typeof item === 'string') as string[];
        const torrents = parseJsonArray(record.torrents_json);
        const bestTorrent = getBestTorrentForPublic(torrents);
        return {
          jav_id: record.jav_id,
          title: record.title,
          title_zh: record.title_zh,
          cover_url: record.cover_url,
          release_date: record.release_date,
          duration: record.duration,
          director: record.director,
          maker: record.maker,
          publisher: record.publisher,
          series: record.series,
          actors,
          categories,
          torrents_count: Array.isArray(torrents) ? torrents.length : 0,
          torrents: admin ? torrents : [],
          best_torrent: bestTorrent,
          detail_url: admin ? record.detail_url : null,
          search_count: record.search_count ?? 0,
          created_at: record.created_at,
          updated_at: record.updated_at,
        };
      });

      const filter: { category?: string; actor?: string } = {};
      if (category) filter.category = category;
      if (actor) filter.actor = actor;

      return jsonResponse({
        data,
        pagination: {
          page: safePage,
          pageSize: safePageSize,
          total,
          totalPages: Math.ceil(total / safePageSize),
        },
        filter: Object.keys(filter).length > 0 ? filter : null,
      }, { headers: corsHeaders });
    } catch (error) {
      console.error('Failed to get javinfo data:', error);
      return jsonResponse({
        data: [],
        pagination: { page: 1, pageSize: 20, total: 0, totalPages: 1 },
      }, { headers: corsHeaders });
    }
  },

  async getJavCategories(env: Env, corsHeaders: Record<string, string>): Promise<Response> {
    try {
      await ensureSchema(env);
      const cacheKey = 'jav:categories';
      const cached = memCacheGet<unknown>(cacheKey, 5 * 60_000);
      if (cached) {
        return jsonResponse(cached, { headers: { ...corsHeaders, 'Cache-Control': 'private, max-age=300' } });
      }
      const rows = await env.DB.prepare(`
        SELECT categories_json
        FROM javinfo
        WHERE categories_json IS NOT NULL AND categories_json != ''
        ORDER BY updated_at DESC
        LIMIT 5000
      `).all<{ categories_json: string | null }>();

      const set = new Set<string>();
      for (const row of rows.results ?? []) {
        for (const item of parseJsonArray(row.categories_json)) {
          if (typeof item === 'string') {
            const value = item.trim();
            if (value) {
              set.add(value);
            }
          }
        }
      }

      const data = Array.from(set).sort((a, b) => a.localeCompare(b));
      const payload = { data };
      memCacheSet(cacheKey, payload);
      return jsonResponse(payload, { headers: { ...corsHeaders, 'Cache-Control': 'private, max-age=300' } });
    } catch (error) {
      console.error('Failed to get jav categories:', error);
      return jsonResponse({ data: [] }, { headers: corsHeaders });
    }
  },

  async getJavActors(env: Env, corsHeaders: Record<string, string>): Promise<Response> {
    try {
      await ensureSchema(env);
      const cacheKey = 'jav:actors';
      const cached = memCacheGet<unknown>(cacheKey, 5 * 60_000);
      if (cached) {
        return jsonResponse(cached, { headers: { ...corsHeaders, 'Cache-Control': 'private, max-age=300' } });
      }
      const rows = await env.DB.prepare(`
        SELECT actors_json
        FROM javinfo
        WHERE actors_json IS NOT NULL AND actors_json != ''
        ORDER BY updated_at DESC
        LIMIT 5000
      `).all<{ actors_json: string | null }>();

      const set = new Set<string>();
      for (const row of rows.results ?? []) {
        for (const item of parseJsonArray(row.actors_json)) {
          if (typeof item === 'string') {
            const value = item.trim();
            if (value) {
              set.add(value);
            }
          }
        }
      }

      const data = Array.from(set).sort((a, b) => a.localeCompare(b));
      const payload = { data };
      memCacheSet(cacheKey, payload);
      return jsonResponse(payload, { headers: { ...corsHeaders, 'Cache-Control': 'private, max-age=300' } });
    } catch (error) {
      console.error('Failed to get jav actors:', error);
      return jsonResponse({ data: [] }, { headers: corsHeaders });
    }
  },

  async deleteJavInfo(request: Request, env: Env, corsHeaders: Record<string, string>): Promise<Response> {
    try {
      await ensureSchema(env);
      let javId = '';

      const contentType = (request.headers.get('Content-Type') || '').toLowerCase();
      if (contentType.includes('application/json')) {
        const payload = await request.json() as { jav_id?: unknown; javId?: unknown };
        javId = normalizeText(payload.jav_id ?? payload.javId, 64) ?? '';
      } else {
        const form = await request.formData();
        javId = normalizeText(form.get('jav_id') ?? form.get('javId'), 64) ?? '';
      }

      if (!javId) {
        return jsonResponse({ error: 'Missing jav_id' }, { status: 400, headers: corsHeaders });
      }

      const result = await env.DB.prepare(`DELETE FROM javinfo WHERE jav_id = ?`).bind(javId).run();
      const affected = Number(result.meta?.changes ?? 0);
      return jsonResponse({ jav_id: javId, deleted: affected > 0 }, { headers: corsHeaders });
    } catch (error) {
      console.error('Failed to delete javinfo:', error);
      return jsonResponse({ error: 'Failed to delete javinfo' }, { status: 500, headers: corsHeaders });
    }
  },

  async getJavDbDomain(corsHeaders: Record<string, string>): Promise<Response> {
    try {
      const cacheKey = 'javdb:domain';
      const cached = memCacheGet<unknown>(cacheKey, 60 * 60_000);
      if (cached) {
        return jsonResponse(cached, { headers: { ...corsHeaders, 'Cache-Control': 'private, max-age=3600' } });
      }
      // 从 javdb.com 获取 HTML
      const response = await fetch('https://javdb.com/', {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        },
        signal: AbortSignal.timeout(10000), // 10秒超时
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const html = await response.text();

      // 只提取"最新域名"
      const latestDomainMatch = html.match(/最新域名:\s*<a[^>]+href="https:\/\/([^"]+)"[^>]*>([^<]+)<\/a>/);

      if (!latestDomainMatch) {
        throw new Error('Could not extract latest domain from javdb.com');
      }

      const latestDomain = latestDomainMatch[2];

      const payload = {
        success: true,
        domains: [latestDomain],
      };
      memCacheSet(cacheKey, payload);
      return jsonResponse(payload, { headers: { ...corsHeaders, 'Cache-Control': 'private, max-age=3600' } });
    } catch (error) {
      console.error('Failed to get JavDB domain:', error);
      return jsonResponse({
        success: false,
        error: 'Failed to fetch domains from javdb.com',
        message: error instanceof Error ? error.message : 'Unknown error',
      }, { status: 500, headers: corsHeaders });
    }
  },
};
