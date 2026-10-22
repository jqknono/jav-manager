import type { Env } from './env';
import { jsonResponse, normalizeText } from './http';
import { memCacheGet, memCacheSet } from './storage/memory';
import { ensureSchema } from './storage/schema';
import type { JavInfoPayload, JavInfoRecord, RouteContext } from './types';

// JavInfo 写入、查询、筛选与管理员删除。

function parseJsonArray(value: string | null): unknown[] {
  if (!value) return [];
  const parsed = JSON.parse(value);
  return Array.isArray(parsed) ? parsed : [];
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

async function saveJavInfo(request: Request, env: Env, corsHeaders: Record<string, string>): Promise<Response> {
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
}

async function getJavInfoData(
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
}

async function getJavCategories(env: Env, corsHeaders: Record<string, string>): Promise<Response> {
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
}

async function getJavActors(env: Env, corsHeaders: Record<string, string>): Promise<Response> {
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
}

async function deleteJavInfo(request: Request, env: Env, corsHeaders: Record<string, string>): Promise<Response> {
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
}

export async function handleJavInfoRoutes(context: RouteContext): Promise<Response | null> {
  const { request, env, url, path, admin, corsHeaders, respond } = context;

  // GET /api/javinfo - Get paginated JavInfo data
  if (path === '/api/javinfo' && request.method === 'GET') {
    const page = parseInt(url.searchParams.get('page') || '1', 10);
    const pageSize = parseInt(url.searchParams.get('pageSize') || '20', 10);
    const category = url.searchParams.get('category');
    const actor = url.searchParams.get('actor');
    return respond(await getJavInfoData(env, page, pageSize, corsHeaders, category, actor, admin));
  }

  // GET /api/javinfo/categories - Category filter options
  if (path === '/api/javinfo/categories' && request.method === 'GET') {
    return respond(await getJavCategories(env, corsHeaders));
  }

  // GET /api/javinfo/actors - Actor filter options
  if (path === '/api/javinfo/actors' && request.method === 'GET') {
    return respond(await getJavActors(env, corsHeaders));
  }

  // POST /api/javinfo/delete - Delete a javinfo record (admin only)
  if (path === '/api/javinfo/delete' && request.method === 'POST') {
    if (!admin) {
      return respond(jsonResponse({ error: 'Unauthorized' }, { status: 401, headers: corsHeaders }));
    }
    return respond(await deleteJavInfo(request, env, corsHeaders));
  }

  // POST /api/javinfo - Store JavInfo (idempotent)
  if (path === '/api/javinfo' && request.method === 'POST') {
    return respond(await saveJavInfo(request, env, corsHeaders));
  }
  return null;
}

