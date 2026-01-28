export interface Env {
  DB: D1Database;
  API_KEY?: string;
}

interface TelemetryPayload {
  machine_name: string;
  user_name: string;
  app_version?: string;
  os_info?: string;
  event_type?: string;
  event_data?: string;
}

interface TelemetryRecord {
  id: number;
  machine_name: string;
  user_name: string;
  app_version: string | null;
  os_info: string | null;
  event_type: string;
  event_data: string | null;
  ip_address: string | null;
  user_agent: string | null;
  country: string | null;
  city: string | null;
  created_at: string;
}

let schemaInit: Promise<void> | null = null;

function jsonResponse(body: unknown, init?: ResponseInit): Response {
  const headers = new Headers(init?.headers);
  if (!headers.has('Content-Type')) headers.set('Content-Type', 'application/json');
  return new Response(JSON.stringify(body), { ...init, headers });
}

async function ensureSchema(env: Env): Promise<void> {
  if (schemaInit) return schemaInit;

  schemaInit = (async () => {
    // Telemetry table
    await env.DB.prepare(`
      CREATE TABLE IF NOT EXISTS telemetry (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        machine_name TEXT NOT NULL,
        user_name TEXT NOT NULL,
        app_version TEXT,
        os_info TEXT,
        event_type TEXT DEFAULT 'startup',
        event_data TEXT,
        ip_address TEXT,
        user_agent TEXT,
        country TEXT,
        city TEXT,
        created_at TEXT DEFAULT (datetime('now'))
      );
    `).run();

    await env.DB.prepare(`CREATE INDEX IF NOT EXISTS idx_telemetry_created_at ON telemetry(created_at DESC);`).run();
    await env.DB.prepare(`CREATE INDEX IF NOT EXISTS idx_telemetry_machine_name ON telemetry(machine_name);`).run();
    await env.DB.prepare(`CREATE INDEX IF NOT EXISTS idx_telemetry_user_name ON telemetry(user_name);`).run();

    // JavInfo cache table (intentionally excludes torrent/magnet data)
    await env.DB.prepare(`
      CREATE TABLE IF NOT EXISTS javinfo (
        jav_id TEXT PRIMARY KEY,
        payload_json TEXT NOT NULL,
        title TEXT,
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

    // Forward-only migrations for existing tables (safe no-ops if already present).
    const ensureColumn = async (table: string, column: string, columnType: string) => {
      const info = await env.DB.prepare(`PRAGMA table_info('${table}');`).all<{ name: string }>();
      const existing = new Set((info.results ?? []).map(r => r.name));
      if (existing.has(column)) return;
      await env.DB.prepare(`ALTER TABLE ${table} ADD COLUMN ${column} ${columnType};`).run();
    };

    await ensureColumn('javinfo', 'torrents_json', 'TEXT');

    await env.DB.prepare(`CREATE INDEX IF NOT EXISTS idx_javinfo_updated_at ON javinfo(updated_at DESC);`).run();
    await env.DB.prepare(`CREATE INDEX IF NOT EXISTS idx_javinfo_release_date ON javinfo(release_date);`).run();
  })();

  return schemaInit;
}

function requireApiKey(request: Request, env: Env, corsHeaders: Record<string, string>): Response | null {
  const required = (env.API_KEY ?? '').trim();
  if (!required) return null;

  const provided = (request.headers.get('X-API-Key') ?? '').trim();
  if (provided && provided === required) return null;

  return jsonResponse({ error: 'Unauthorized' }, { status: 401, headers: corsHeaders });
}

type JavInfoPayload = {
  jav_id?: string;
  javId?: string;
  title?: string;
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

    // CORS headers
    const corsHeaders = {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    };

    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: corsHeaders });
    }

    // POST /api/telemetry - Collect telemetry data (non-blocking)
    if (path === '/api/telemetry' && request.method === 'POST') {
      // Use waitUntil for non-blocking database write
      ctx.waitUntil(this.saveTelemetry(request, env));
      return jsonResponse({ success: true }, { headers: corsHeaders });
    }

    // GET /api/stats - Get statistics
    if (path === '/api/stats' && request.method === 'GET') {
      return this.getStats(env, corsHeaders);
    }

    // POST /api/javinfo - Store JavInfo (idempotent)
    if (path === '/api/javinfo' && request.method === 'POST') {
      const auth = requireApiKey(request, env, corsHeaders);
      if (auth) return auth;
      return this.saveJavInfo(request, env, corsHeaders);
    }

    // GET /api/data - Get paginated telemetry data
    if (path === '/api/data' && request.method === 'GET') {
      const page = parseInt(url.searchParams.get('page') || '1');
      const pageSize = parseInt(url.searchParams.get('pageSize') || '20');
      return this.getData(env, page, pageSize, corsHeaders);
    }

    // GET / or /admin - Admin page
    if (path === '/' || path === '/admin') {
      return new Response(this.getAdminPage(), {
        headers: { 'Content-Type': 'text/html; charset=utf-8' },
      });
    }

    return new Response('Not Found', { status: 404 });
  },

  async saveTelemetry(request: Request, env: Env): Promise<void> {
    try {
      await ensureSchema(env);
      const payload: TelemetryPayload = await request.json();
      const cf = request.cf;

      await env.DB.prepare(`
        INSERT INTO telemetry (machine_name, user_name, app_version, os_info, event_type, event_data, ip_address, user_agent, country, city)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).bind(
        payload.machine_name || 'unknown',
        payload.user_name || 'unknown',
        payload.app_version || null,
        payload.os_info || null,
        payload.event_type || 'startup',
        payload.event_data || null,
        request.headers.get('CF-Connecting-IP') || null,
        request.headers.get('User-Agent') || null,
        (cf?.country as string) || null,
        (cf?.city as string) || null
      ).run();
    } catch (error) {
      console.error('Failed to save telemetry:', error);
    }
  },

  async getStats(env: Env, corsHeaders: Record<string, string>): Promise<Response> {
    try {
      await ensureSchema(env);
      const totalResult = await env.DB.prepare('SELECT COUNT(*) as total FROM telemetry').first<{ total: number }>();
      const uniqueMachinesResult = await env.DB.prepare('SELECT COUNT(DISTINCT machine_name) as count FROM telemetry').first<{ count: number }>();
      const uniqueUsersResult = await env.DB.prepare('SELECT COUNT(DISTINCT user_name) as count FROM telemetry').first<{ count: number }>();
      const todayResult = await env.DB.prepare(`SELECT COUNT(*) as count FROM telemetry WHERE date(created_at) = date('now')`).first<{ count: number }>();

      const javInfoTotalResult = await env.DB.prepare('SELECT COUNT(*) as total FROM javinfo').first<{ total: number }>();
      const javInfoTodayResult = await env.DB.prepare(`SELECT COUNT(*) as count FROM javinfo WHERE date(created_at) = date('now')`).first<{ count: number }>();

      return jsonResponse({
        total_records: totalResult?.total || 0,
        unique_machines: uniqueMachinesResult?.count || 0,
        unique_users: uniqueUsersResult?.count || 0,
        today_count: todayResult?.count || 0,
        javinfo_total: javInfoTotalResult?.total || 0,
        javinfo_today: javInfoTodayResult?.count || 0,
      }, { headers: corsHeaders });
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
          jav_id, payload_json, title, cover_url, release_date, duration,
          director, maker, publisher, series, actors_json, categories_json, torrents_json, detail_url,
          created_at, updated_at
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))
        ON CONFLICT(jav_id) DO NOTHING;
      `).bind(
        javId,
        payloadJson,
        title,
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

      const inserted = (result.meta?.changes ?? 0) > 0;
      return jsonResponse({ jav_id: javId, inserted, existed: !inserted }, { headers: corsHeaders });
    } catch (error) {
      console.error('Failed to save javinfo:', error);
      return jsonResponse({ error: 'Failed to save javinfo' }, { status: 500, headers: corsHeaders });
    }
  },

  async getData(env: Env, page: number, pageSize: number, corsHeaders: Record<string, string>): Promise<Response> {
    try {
      await ensureSchema(env);
      const offset = (page - 1) * pageSize;
      const safePageSize = Math.min(Math.max(1, pageSize), 100);
      const safeOffset = Math.max(0, offset);

      const countResult = await env.DB.prepare('SELECT COUNT(*) as total FROM telemetry').first<{ total: number }>();
      const total = countResult?.total || 0;

      const dataResult = await env.DB.prepare(`
        SELECT * FROM telemetry 
        ORDER BY created_at DESC 
        LIMIT ? OFFSET ?
      `).bind(safePageSize, safeOffset).all<TelemetryRecord>();

      return jsonResponse({
        data: dataResult.results,
        pagination: {
          page,
          pageSize: safePageSize,
          total,
          totalPages: Math.ceil(total / safePageSize),
        },
      }, { headers: corsHeaders });
    } catch (error) {
      console.error('Failed to get data:', error);
      // Fail soft so the UI can render.
      return jsonResponse({
        data: [],
        pagination: { page, pageSize, total: 0, totalPages: 1 },
      }, { headers: corsHeaders });
    }
  },

  getAdminPage(): string {
    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>JavManager Telemetry</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: #f5f5f5; color: #333; line-height: 1.6; }
    .container { max-width: 1200px; margin: 0 auto; padding: 20px; }
    h1 { margin-bottom: 20px; color: #2c3e50; }
    .stats-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 16px; margin-bottom: 24px; }
    .stat-card { background: #fff; padding: 20px; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1); }
    .stat-card h3 { font-size: 14px; color: #666; margin-bottom: 8px; text-transform: uppercase; }
    .stat-card .value { font-size: 32px; font-weight: 700; color: #3498db; }
    .data-table { width: 100%; background: #fff; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1); overflow: hidden; }
    table { width: 100%; border-collapse: collapse; }
    th, td { padding: 12px 16px; text-align: left; border-bottom: 1px solid #eee; }
    th { background: #f8f9fa; font-weight: 600; color: #555; }
    tr:hover { background: #f8f9fa; }
    .pagination { display: flex; justify-content: center; align-items: center; gap: 8px; margin-top: 20px; flex-wrap: wrap; }
    .pagination button { padding: 8px 16px; border: 1px solid #ddd; background: #fff; border-radius: 4px; cursor: pointer; transition: all 0.2s; }
    .pagination button:hover:not(:disabled) { background: #3498db; color: #fff; border-color: #3498db; }
    .pagination button:disabled { opacity: 0.5; cursor: not-allowed; }
    .pagination span { padding: 8px 16px; }
    .loading { text-align: center; padding: 40px; color: #666; }
    .empty { text-align: center; padding: 40px; color: #999; }
    @media (max-width: 768px) {
      .data-table { overflow-x: auto; }
      table { min-width: 800px; }
    }
  </style>
</head>
<body>
  <div class="container">
    <h1>JavManager Usage Statistics</h1>
    
    <div class="stats-grid">
      <div class="stat-card">
        <h3>Total Records</h3>
        <div class="value" id="stat-total">-</div>
      </div>
      <div class="stat-card">
        <h3>Unique Machines</h3>
        <div class="value" id="stat-machines">-</div>
      </div>
      <div class="stat-card">
        <h3>Unique Users</h3>
        <div class="value" id="stat-users">-</div>
      </div>
      <div class="stat-card">
        <h3>Today</h3>
        <div class="value" id="stat-today">-</div>
      </div>
    </div>

    <div class="data-table">
      <table>
        <thead>
          <tr>
            <th>Time</th>
            <th>Machine</th>
            <th>User</th>
            <th>Version</th>
            <th>OS</th>
            <th>Event</th>
            <th>Location</th>
          </tr>
        </thead>
        <tbody id="data-body">
          <tr><td colspan="7" class="loading">Loading...</td></tr>
        </tbody>
      </table>
    </div>

    <div class="pagination">
      <button id="btn-first" onclick="goToPage(1)">&laquo; First</button>
      <button id="btn-prev" onclick="goToPage(currentPage - 1)">&lsaquo; Prev</button>
      <span id="page-info">Page 1 of 1</span>
      <button id="btn-next" onclick="goToPage(currentPage + 1)">Next &rsaquo;</button>
      <button id="btn-last" onclick="goToPage(totalPages)">Last &raquo;</button>
    </div>
  </div>

  <script>
    let currentPage = 1;
    let totalPages = 1;
    const pageSize = 20;

    async function loadStats() {
      try {
        const res = await fetch('/api/stats');
        const stats = await res.json();
        document.getElementById('stat-total').textContent = stats.total_records.toLocaleString();
        document.getElementById('stat-machines').textContent = stats.unique_machines.toLocaleString();
        document.getElementById('stat-users').textContent = stats.unique_users.toLocaleString();
        document.getElementById('stat-today').textContent = stats.today_count.toLocaleString();
      } catch (e) {
        console.error('Failed to load stats:', e);
      }
    }

    async function loadData(page) {
      const tbody = document.getElementById('data-body');
      tbody.innerHTML = '<tr><td colspan="7" class="loading">Loading...</td></tr>';
      
      try {
        const res = await fetch('/api/data?page=' + page + '&pageSize=' + pageSize);
        const result = await res.json();
        
        currentPage = result.pagination.page;
        totalPages = result.pagination.totalPages || 1;
        
        updatePagination();
        
        if (result.data.length === 0) {
          tbody.innerHTML = '<tr><td colspan="7" class="empty">No data available</td></tr>';
          return;
        }
        
        tbody.innerHTML = result.data.map(row => {
          const time = new Date(row.created_at + 'Z').toLocaleString();
          const location = [row.city, row.country].filter(Boolean).join(', ') || '-';
          return '<tr>' +
            '<td>' + escapeHtml(time) + '</td>' +
            '<td>' + escapeHtml(row.machine_name) + '</td>' +
            '<td>' + escapeHtml(row.user_name) + '</td>' +
            '<td>' + escapeHtml(row.app_version || '-') + '</td>' +
            '<td>' + escapeHtml(row.os_info || '-') + '</td>' +
            '<td>' + escapeHtml(row.event_type || '-') + '</td>' +
            '<td>' + escapeHtml(location) + '</td>' +
          '</tr>';
        }).join('');
      } catch (e) {
        tbody.innerHTML = '<tr><td colspan="7" class="empty">Failed to load data</td></tr>';
        console.error('Failed to load data:', e);
      }
    }

    function updatePagination() {
      document.getElementById('page-info').textContent = 'Page ' + currentPage + ' of ' + totalPages;
      document.getElementById('btn-first').disabled = currentPage <= 1;
      document.getElementById('btn-prev').disabled = currentPage <= 1;
      document.getElementById('btn-next').disabled = currentPage >= totalPages;
      document.getElementById('btn-last').disabled = currentPage >= totalPages;
    }

    function goToPage(page) {
      if (page < 1 || page > totalPages) return;
      loadData(page);
    }

    function escapeHtml(str) {
      if (!str) return '';
      return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
    }

    loadStats();
    loadData(1);
  </script>
</body>
</html>`;
  },
};
