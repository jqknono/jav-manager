export interface Env {
  DB: D1Database;
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
      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // GET /api/stats - Get statistics
    if (path === '/api/stats' && request.method === 'GET') {
      return this.getStats(env, corsHeaders);
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
      const totalResult = await env.DB.prepare('SELECT COUNT(*) as total FROM telemetry').first<{ total: number }>();
      const uniqueMachinesResult = await env.DB.prepare('SELECT COUNT(DISTINCT machine_name) as count FROM telemetry').first<{ count: number }>();
      const uniqueUsersResult = await env.DB.prepare('SELECT COUNT(DISTINCT user_name) as count FROM telemetry').first<{ count: number }>();
      const todayResult = await env.DB.prepare(`SELECT COUNT(*) as count FROM telemetry WHERE date(created_at) = date('now')`).first<{ count: number }>();

      return new Response(JSON.stringify({
        total_records: totalResult?.total || 0,
        unique_machines: uniqueMachinesResult?.count || 0,
        unique_users: uniqueUsersResult?.count || 0,
        today_count: todayResult?.count || 0,
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    } catch (error) {
      return new Response(JSON.stringify({ error: 'Failed to get stats' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
  },

  async getData(env: Env, page: number, pageSize: number, corsHeaders: Record<string, string>): Promise<Response> {
    try {
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

      return new Response(JSON.stringify({
        data: dataResult.results,
        pagination: {
          page,
          pageSize: safePageSize,
          total,
          totalPages: Math.ceil(total / safePageSize),
        },
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    } catch (error) {
      return new Response(JSON.stringify({ error: 'Failed to get data' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
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
