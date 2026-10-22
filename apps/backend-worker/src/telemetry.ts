import type { Env } from './env';
import { jsonResponse, normalizeText } from './http';
import { memCacheGet, memCacheSet } from './storage/memory';
import { ensureSchema } from './storage/schema';
import type { RouteContext, TelemetryPayload, UserRecord } from './types';

// 遥测收集、用户查询与统计；写入节流和回填状态保持在模块级。

type TelemetryWriteGate = { t: number; sig: string };

const TELEMETRY_WRITE_GATE = new Map<string, TelemetryWriteGate>();

const TELEMETRY_WRITE_GATE_MAX = 10000;

const TELEMETRY_MIN_INTERVAL_MS = 60_000;

// allow at most 1 write/min/user per isolate
const TELEMETRY_DUP_INTERVAL_MS = 10 * 60_000;

// suppress identical event payloads for longer
const TELEMETRY_PRUNE_EVERY_N_INSERTS = 50;

// reduce DELETE frequency
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

let userIdBackfill: Promise<void> | null = null;

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
  userIdBackfill = backfillMissingUserIds(env).catch(() => { });
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

async function saveTelemetry(payloadRaw: unknown, request: Request, env: Env): Promise<void> {
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
}

async function getStats(env: Env, corsHeaders: Record<string, string>, userIdRaw?: string | null): Promise<Response> {
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
}

async function getData(env: Env, page: number, pageSize: number, corsHeaders: Record<string, string>, userIdRaw?: string | null): Promise<Response> {
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
}

async function getUsers(env: Env, corsHeaders: Record<string, string>): Promise<Response> {
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
}

export async function handleTelemetryRoutes(context: RouteContext): Promise<Response | null> {
  const { request, env, ctx, url, path, admin, corsHeaders, respond } = context;

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
    ctx.waitUntil(saveTelemetry(payload, request, env));
    return respond(jsonResponse({ success: true }, { headers: corsHeaders }));
  }

  // GET /api/stats - Get statistics
  if (path === '/api/stats' && request.method === 'GET') {
    const userId = url.searchParams.get('userId');
    return respond(await getStats(env, corsHeaders, userId));
  }

  // GET /api/user - Get paginated user data
  if (path === '/api/user' && request.method === 'GET') {
    if (!admin) {
      return respond(jsonResponse({ error: 'Unauthorized' }, { status: 401, headers: corsHeaders }));
    }
    const page = parseInt(url.searchParams.get('page') || '1', 10);
    const pageSize = parseInt(url.searchParams.get('pageSize') || '20', 10);
    const userId = url.searchParams.get('userId');
    return respond(await getData(env, page, pageSize, corsHeaders, userId));
  }

  // GET /api/data - Backward-compatible alias for /api/user
  if (path === '/api/data' && request.method === 'GET') {
    if (!admin) {
      return respond(jsonResponse({ error: 'Unauthorized' }, { status: 401, headers: corsHeaders }));
    }
    const page = parseInt(url.searchParams.get('page') || '1', 10);
    const pageSize = parseInt(url.searchParams.get('pageSize') || '20', 10);
    const userId = url.searchParams.get('userId');
    return respond(await getData(env, page, pageSize, corsHeaders, userId));
  }

  // GET /api/users - List users for filtering (latest row + event counts)
  if (path === '/api/users' && request.method === 'GET') {
    if (!admin) {
      return respond(jsonResponse({ error: 'Unauthorized' }, { status: 401, headers: corsHeaders }));
    }
    return respond(await getUsers(env, corsHeaders));
  }
  return null;
}

export { ensureUserIdBackfill };
