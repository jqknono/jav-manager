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

interface UserRecord {
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

interface JavInfoRecord {
  jav_id: string;
  title: string | null;
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
  created_at: string;
  updated_at: string;
}

type PageLang = 'en' | 'zh';

const PAGE_SIZE_OPTIONS = [20, 50, 100];
const LATEST_RELEASE_URL = 'https://github.com/jqknono/jav-manager/releases/latest';

const TEXT = {
  en: {
    appName: 'JavManager',
    appTagline: 'Automation for JAV content management.',
    navHome: 'Home',
    navUser: 'Users',
    navJav: 'Jav Info',
    langEnglish: 'English',
    langChinese: '繁體中文',
    homeTitle: 'JavManager Telemetry',
    homeIntro: 'This site summarizes telemetry and JavInfo sync data reported by JavManager clients.',
    homeUsageTitle: 'How to use',
    homeUsageItems: [
      'Run JavManager and input a JAV ID (e.g. IPZZ-408).',
      'The app checks local cache, then fetches from JavDB if needed.',
      'Pick a torrent and send it to your downloader.',
    ],
    homeOverviewTitle: 'Overview',
    homeOverviewItems: [
      'Search local cache first, then JavDB.',
      'Sort torrents by markers and weights.',
      'Optional telemetry and JavInfo sync for statistics.',
    ],
    homeDataTitle: 'Data collected',
    homeDataItems: [
      'Telemetry events: machine/user name, app version, OS, event type, and location (country/city).',
      'JavInfo sync: metadata such as title, actors, categories, release date, and detail link.',
    ],
    homePagesTitle: 'Pages',
    homePagesItems: ['JavInfo data: /jav'],
    viewUsers: 'View Users',
    viewJav: 'View Jav Info',
    downloadLatest: 'Download latest binary',
    userTitle: 'User Telemetry',
    userSubtitle: 'Anonymous usage events from clients.',
    javTitle: 'Jav Info',
    javSubtitle: 'Metadata synced from remote JavDB.',
    statsTotal: 'Total Records',
    statsMachines: 'Unique Machines',
    statsUsers: 'Unique Users',
    statsToday: 'Today',
    statsJavTotal: 'JavInfo Total',
    statsJavToday: 'JavInfo Today',
    tableTime: 'Time',
    tableMachine: 'Machine',
    tableUser: 'User',
    tableVersion: 'Version',
    tableOs: 'OS',
    tableEvent: 'Event',
    tableLocation: 'Location',
    tableJavId: 'Jav ID',
    tableTitle: 'Title',
    tableRelease: 'Release',
    tableActors: 'Actors',
    tableCategories: 'Categories',
    tableTorrents: 'Torrents',
    tableDetail: 'Detail',
    pageSizeLabel: 'Per page',
    paginationFirst: 'First',
    paginationPrev: 'Prev',
    paginationNext: 'Next',
    paginationLast: 'Last',
    pageInfo: 'Page {current} of {total}',
    loading: 'Loading...',
    empty: 'No data available',
    loadFailed: 'Failed to load data',
  },
  zh: {
    appName: 'JavManager',
    appTagline: 'JAV 內容管理的自動化工具。',
    navHome: '首頁',
    navUser: '使用者',
    navJav: 'Jav 資訊',
    langEnglish: 'English',
    langChinese: '繁體中文',
    homeTitle: 'JavManager 遙測',
    homeIntro: '此頁彙整 JavManager 回傳的遙測與 JavInfo 同步資料。',
    homeUsageTitle: '使用方式',
    homeUsageItems: [
      '啟動 JavManager 後輸入番號（例如 IPZZ-408）。',
      '先查本地快取，未命中則查詢 JavDB。',
      '選擇種子並送到下載器。',
    ],
    homeOverviewTitle: '功能概覽',
    homeOverviewItems: [
      '先查本地快取，再查 JavDB。',
      '依標記與權重排序種子。',
      '可選擇啟用遙測與 JavInfo 同步。',
    ],
    homeDataTitle: '收集資料',
    homeDataItems: [
      '遙測事件：機器名稱、使用者名稱、版本、作業系統、事件類型與地理位置（國家/城市）。',
      'JavInfo 同步：標題、演員、分類、發行日期、詳情連結等中繼資料。',
    ],
    homePagesTitle: '頁面',
    homePagesItems: ['Jav 資訊：/jav'],
    viewUsers: '查看使用者',
    viewJav: '查看 Jav 資訊',
    downloadLatest: '下載最新版本',
    userTitle: '使用者遙測',
    userSubtitle: '匿名使用事件與統計。',
    javTitle: 'Jav 資訊',
    javSubtitle: '從 remote JavDB 同步的中繼資料。',
    statsTotal: '總筆數',
    statsMachines: '唯一機器',
    statsUsers: '唯一使用者',
    statsToday: '今日',
    statsJavTotal: 'JavInfo 總數',
    statsJavToday: '今日 JavInfo',
    tableTime: '時間',
    tableMachine: '機器',
    tableUser: '使用者',
    tableVersion: '版本',
    tableOs: '作業系統',
    tableEvent: '事件',
    tableLocation: '位置',
    tableJavId: '番號',
    tableTitle: '標題',
    tableRelease: '發行日',
    tableActors: '演員',
    tableCategories: '分類',
    tableTorrents: '種子',
    tableDetail: '詳情',
    pageSizeLabel: '每頁',
    paginationFirst: '第一頁',
    paginationPrev: '上一頁',
    paginationNext: '下一頁',
    paginationLast: '最後一頁',
    pageInfo: '第 {current} / {total} 頁',
    loading: '載入中...',
    empty: '暫無資料',
    loadFailed: '讀取失敗',
  },
};

let schemaInit: Promise<void> | null = null;

function jsonResponse(body: unknown, init?: ResponseInit): Response {
  const headers = new Headers(init?.headers);
  if (!headers.has('Content-Type')) headers.set('Content-Type', 'application/json');
  return new Response(JSON.stringify(body), { ...init, headers });
}

function htmlResponse(body: string, init?: ResponseInit): Response {
  const headers = new Headers(init?.headers);
  if (!headers.has('Content-Type')) headers.set('Content-Type', 'text/html; charset=utf-8');
  return new Response(body, { ...init, headers });
}

function getLang(request: Request): PageLang {
  const url = new URL(request.url);
  const langParam = (url.searchParams.get('lang') ?? '').toLowerCase();
  if (langParam === 'zh' || langParam === 'zh-tw' || langParam === 'zh-hant' || langParam === 'zh-hk')
    return 'zh';
  if (langParam === 'en') return 'en';
  const accept = (request.headers.get('Accept-Language') ?? '').toLowerCase();
  return accept.includes('zh') ? 'zh' : 'en';
}

function getPageParams(url: URL): { page: number; pageSize: number } {
  const rawPage = parseInt(url.searchParams.get('page') || '1', 10);
  const page = Number.isFinite(rawPage) && rawPage > 0 ? rawPage : 1;
  const rawPageSize = parseInt(url.searchParams.get('pageSize') || '20', 10);
  const pageSize = PAGE_SIZE_OPTIONS.includes(rawPageSize) ? rawPageSize : 20;
  return { page, pageSize };
}

function renderList(items: string[]): string {
  return `<ul class="list">${items.map(item => `<li>${item}</li>`).join('')}</ul>`;
}

function buildLangSwitch(url: URL, lang: PageLang): string {
  const t = TEXT[lang];
  const enUrl = new URL(url.toString());
  enUrl.searchParams.set('lang', 'en');
  const zhUrl = new URL(url.toString());
  zhUrl.searchParams.set('lang', 'zh');
  return `
    <div class="lang-switch">
      <a class="${lang === 'en' ? 'active' : ''}" href="${enUrl.pathname + enUrl.search}">${t.langEnglish}</a>
      <a class="${lang === 'zh' ? 'active' : ''}" href="${zhUrl.pathname + zhUrl.search}">${t.langChinese}</a>
    </div>
  `;
}

function renderNav(
  lang: PageLang,
  active: 'home' | 'user' | 'jav',
  options?: { hideUser?: boolean }
): string {
  const t = TEXT[lang];
  const hideUser = options?.hideUser ?? false;
  return `
    <nav class="nav">
      <a class="${active === 'home' ? 'active' : ''}" href="/?lang=${lang}">${t.navHome}</a>
      ${hideUser ? '' : `<a class="${active === 'user' ? 'active' : ''}" href="/user?lang=${lang}">${t.navUser}</a>`}
      <a class="${active === 'jav' ? 'active' : ''}" href="/jav?lang=${lang}">${t.navJav}</a>
    </nav>
  `;
}

const BASE_STYLES = `
  * { box-sizing: border-box; margin: 0; padding: 0; }
  :root { color-scheme: light; }
  body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: #f5f5f5; color: #333; line-height: 1.6; }
  a { color: #2563eb; text-decoration: none; }
  a:hover { text-decoration: underline; }
  .page { min-height: 100vh; }
  .container { max-width: 72rem; margin: 0 auto; padding: 1.5rem; }
  .header { display: flex; justify-content: space-between; align-items: center; gap: 1rem; margin-bottom: 1.5rem; flex-wrap: wrap; }
  .app-title { font-size: 1.75rem; font-weight: 700; color: #1f2937; }
  .app-subtitle { color: #6b7280; font-size: 1rem; }
  .nav { display: flex; gap: 0.75rem; margin-bottom: 1.5rem; flex-wrap: wrap; }
  .nav a { padding: 0.5rem 0.75rem; border-radius: 0.5rem; background: #fff; border: 0.0625rem solid #e5e7eb; }
  .nav a.active { background: #2563eb; color: #fff; border-color: #2563eb; }
  .lang-switch { display: flex; gap: 0.75rem; font-size: 0.875rem; }
  .lang-switch a { color: #374151; }
  .lang-switch a.active { font-weight: 700; color: #111827; }
  .hero { display: flex; flex-direction: column; gap: 1rem; margin-bottom: 1.5rem; }
  .button-row { display: flex; gap: 0.75rem; flex-wrap: wrap; }
  .button { display: inline-flex; align-items: center; justify-content: center; padding: 0.6rem 1rem; border-radius: 0.5rem; border: 0.0625rem solid #2563eb; background: #2563eb; color: #fff; font-weight: 600; }
  .button.secondary { background: #fff; color: #2563eb; }
  .section { margin-bottom: 1.5rem; }
  .section-title { font-size: 1.25rem; font-weight: 600; margin-bottom: 0.5rem; color: #1f2937; }
  .cards { display: grid; grid-template-columns: repeat(auto-fit, minmax(16rem, 1fr)); gap: 1rem; }
  .card { background: #fff; padding: 1rem; border-radius: 0.75rem; border: 0.0625rem solid #e5e7eb; box-shadow: 0 0.125rem 0.25rem rgba(0,0,0,0.04); }
  .stats-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(12rem, 1fr)); gap: 1rem; margin-bottom: 1rem; }
  .stat-title { font-size: 0.75rem; text-transform: uppercase; color: #6b7280; letter-spacing: 0.04em; }
  .stat-value { font-size: 1.75rem; font-weight: 700; color: #2563eb; margin-top: 0.25rem; }
  .table-card { padding: 0; overflow: hidden; }
  .table-wrapper { width: 100%; overflow-x: auto; }
  table { width: 100%; border-collapse: collapse; }
  th, td { padding: 0.75rem 1rem; text-align: left; border-bottom: 0.0625rem solid #f3f4f6; vertical-align: top; }
  th { background: #f9fafb; font-weight: 600; color: #374151; font-size: 0.875rem; }
  tr:hover { background: #f9fafb; }
  .loading, .empty { text-align: center; padding: 2rem 1rem; color: #6b7280; }
  .toolbar { display: flex; justify-content: space-between; align-items: center; gap: 1rem; margin: 1rem 0; flex-wrap: wrap; }
  .page-size { display: flex; align-items: center; gap: 0.5rem; color: #374151; font-size: 0.875rem; }
  select { padding: 0.4rem 0.6rem; border-radius: 0.5rem; border: 0.0625rem solid #d1d5db; background: #fff; }
  .pagination { display: flex; justify-content: center; align-items: center; gap: 0.5rem; flex-wrap: wrap; margin-top: 0.5rem; }
  .pagination button { padding: 0.5rem 0.8rem; border-radius: 0.5rem; border: 0.0625rem solid #d1d5db; background: #fff; cursor: pointer; }
  .pagination button:hover:not(:disabled) { background: #2563eb; border-color: #2563eb; color: #fff; }
  .pagination button:disabled { opacity: 0.5; cursor: not-allowed; }
  .page-info { color: #4b5563; font-size: 0.875rem; }
  .list { padding-left: 1.25rem; display: grid; gap: 0.5rem; }
  .muted { color: #6b7280; }
  .link { color: #2563eb; word-break: break-all; }
  @media (max-width: 48rem) {
    .header { flex-direction: column; align-items: flex-start; }
  }
`;

function renderPage(params: {
  lang: PageLang;
  title: string;
  description?: string;
  active: 'home' | 'user' | 'jav';
  hideUserNav?: boolean;
  body: string;
  script?: string;
  requestUrl: URL;
}): string {
  const { lang, title, description, active, hideUserNav, body, script, requestUrl } = params;
  const t = TEXT[lang];
  const htmlLang = lang === 'zh' ? 'zh-Hant' : 'en';
  const pageTitle = title ? `${title} - ${t.appName}` : t.appName;
  return `<!DOCTYPE html>
<html lang="${htmlLang}">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${pageTitle}</title>
  <style>${BASE_STYLES}</style>
</head>
<body>
  <div class="page">
    <div class="container">
      <header class="header">
        <div>
          <div class="app-title">${t.appName}</div>
          <div class="app-subtitle">${description ?? t.appTagline}</div>
        </div>
        ${buildLangSwitch(requestUrl, lang)}
      </header>
      ${renderNav(lang, active, { hideUser: hideUserNav })}
      ${body}
    </div>
  </div>
  ${script ? `<script>${script}</script>` : ''}
</body>
</html>`;
}

function getHomePage(url: URL, lang: PageLang): string {
  const t = TEXT[lang];
  const body = `
    <section class="hero">
      <div>
        <div class="section-title">${t.homeTitle}</div>
        <p class="muted">${t.homeIntro}</p>
      </div>
      <div class="button-row">
        <a class="button" href="/jav?lang=${lang}">${t.viewJav}</a>
        <a class="button secondary" href="${LATEST_RELEASE_URL}" target="_blank" rel="noopener">${t.downloadLatest}</a>
      </div>
    </section>
    <section class="section">
      <div class="cards">
        <div class="card">
          <div class="section-title">${t.homeUsageTitle}</div>
          ${renderList(t.homeUsageItems)}
        </div>
        <div class="card">
          <div class="section-title">${t.homeOverviewTitle}</div>
          ${renderList(t.homeOverviewItems)}
        </div>
        <div class="card">
          <div class="section-title">${t.homeDataTitle}</div>
          ${renderList(t.homeDataItems)}
        </div>
        <div class="card">
          <div class="section-title">${t.homePagesTitle}</div>
          ${renderList([
            `${t.navJav}: <a class="link" href="/jav?lang=${lang}">/jav</a>`,
          ])}
        </div>
      </div>
    </section>
  `;
  return renderPage({
    lang,
    title: t.homeTitle,
    active: 'home',
    hideUserNav: true,
    body,
    requestUrl: url,
  });
}

function getUserPage(url: URL, lang: PageLang): string {
  const t = TEXT[lang];
  const { page, pageSize } = getPageParams(url);
  const pageSizeOptions = PAGE_SIZE_OPTIONS
    .map(size => `<option value="${size}" ${size === pageSize ? 'selected' : ''}>${size}</option>`)
    .join('');
  const body = `
    <section class="section">
      <div class="section-title">${t.userTitle}</div>
      <p class="muted">${t.userSubtitle}</p>
    </section>
    <div class="stats-grid">
      <div class="card">
        <div class="stat-title">${t.statsTotal}</div>
        <div class="stat-value" id="stat-total">-</div>
      </div>
      <div class="card">
        <div class="stat-title">${t.statsMachines}</div>
        <div class="stat-value" id="stat-machines">-</div>
      </div>
      <div class="card">
        <div class="stat-title">${t.statsUsers}</div>
        <div class="stat-value" id="stat-users">-</div>
      </div>
      <div class="card">
        <div class="stat-title">${t.statsToday}</div>
        <div class="stat-value" id="stat-today">-</div>
      </div>
    </div>
    <div class="card table-card">
      <div class="table-wrapper">
        <table>
          <thead>
            <tr>
              <th>${t.tableTime}</th>
              <th>${t.tableMachine}</th>
              <th>${t.tableUser}</th>
              <th>${t.tableVersion}</th>
              <th>${t.tableOs}</th>
              <th>${t.tableEvent}</th>
              <th>${t.tableLocation}</th>
            </tr>
          </thead>
          <tbody id="data-body">
            <tr><td colspan="7" class="loading">${t.loading}</td></tr>
          </tbody>
        </table>
      </div>
    </div>
    <div class="toolbar">
      <div class="page-size">
        <span>${t.pageSizeLabel}</span>
        <select id="page-size">${pageSizeOptions}</select>
      </div>
    </div>
    <div class="pagination">
      <button id="btn-first" onclick="goToPage(1)">&laquo; ${t.paginationFirst}</button>
      <button id="btn-prev" onclick="goToPage(currentPage - 1)">&lsaquo; ${t.paginationPrev}</button>
      <span id="page-info" class="page-info">${t.pageInfo.replace('{current}', '1').replace('{total}', '1')}</span>
      <button id="btn-next" onclick="goToPage(currentPage + 1)">${t.paginationNext} &rsaquo;</button>
      <button id="btn-last" onclick="goToPage(totalPages)">${t.paginationLast} &raquo;</button>
    </div>
  `;
  const script = `
    const lang = ${JSON.stringify(lang)};
    const locale = lang === 'zh' ? 'zh-Hant' : 'en';
    const text = ${JSON.stringify({
      loading: t.loading,
      empty: t.empty,
      loadFailed: t.loadFailed,
      pageInfo: t.pageInfo,
    })};
    const pageSizeOptions = ${JSON.stringify(PAGE_SIZE_OPTIONS)};
    let currentPage = ${page};
    let pageSize = ${pageSize};
    let totalPages = 1;

    const tbody = document.getElementById('data-body');
    const pageInfo = document.getElementById('page-info');
    const pageSizeSelect = document.getElementById('page-size');

    function updateUrl() {
      const url = new URL(window.location.href);
      url.searchParams.set('page', String(currentPage));
      url.searchParams.set('pageSize', String(pageSize));
      url.searchParams.set('lang', lang);
      history.replaceState(null, '', url.pathname + url.search);
    }

    function updatePagination() {
      pageInfo.textContent = text.pageInfo
        .replace('{current}', String(currentPage))
        .replace('{total}', String(totalPages));
      document.getElementById('btn-first').disabled = currentPage <= 1;
      document.getElementById('btn-prev').disabled = currentPage <= 1;
      document.getElementById('btn-next').disabled = currentPage >= totalPages;
      document.getElementById('btn-last').disabled = currentPage >= totalPages;
    }

    async function loadStats() {
      const res = await fetch('/api/stats');
      const stats = await res.json();
      document.getElementById('stat-total').textContent = Number(stats.total_records || 0).toLocaleString(locale);
      document.getElementById('stat-machines').textContent = Number(stats.unique_machines || 0).toLocaleString(locale);
      document.getElementById('stat-users').textContent = Number(stats.unique_users || 0).toLocaleString(locale);
      document.getElementById('stat-today').textContent = Number(stats.today_count || 0).toLocaleString(locale);
    }

    async function loadData(page) {
      tbody.innerHTML = '<tr><td colspan="7" class="loading">' + text.loading + '</td></tr>';
      const res = await fetch('/api/user?page=' + page + '&pageSize=' + pageSize);
      const result = await res.json();
      const rows = Array.isArray(result.data) ? result.data : [];
      currentPage = Math.max(1, Number(result.pagination?.page || 1));
      totalPages = Math.max(1, Number(result.pagination?.totalPages || 1));
      updatePagination();
      updateUrl();

      if (rows.length === 0) {
        tbody.innerHTML = '<tr><td colspan="7" class="empty">' + text.empty + '</td></tr>';
        return;
      }

      tbody.innerHTML = rows.map(row => {
        const time = row.created_at ? new Date(row.created_at + 'Z').toLocaleString(locale) : '-';
        const location = [row.city, row.country].filter(Boolean).join(', ') || '-';
        return '<tr>' +
          '<td>' + escapeHtml(time) + '</td>' +
          '<td>' + escapeHtml(row.machine_name || '-') + '</td>' +
          '<td>' + escapeHtml(row.user_name || '-') + '</td>' +
          '<td>' + escapeHtml(row.app_version || '-') + '</td>' +
          '<td>' + escapeHtml(row.os_info || '-') + '</td>' +
          '<td>' + escapeHtml(row.event_type || '-') + '</td>' +
          '<td>' + escapeHtml(location) + '</td>' +
        '</tr>';
      }).join('');
    }

    function goToPage(page) {
      if (page < 1 || page > totalPages) return;
      loadData(page);
    }

    function escapeHtml(str) {
      if (str === null || str === undefined) return '';
      return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
    }

    pageSizeSelect.value = pageSizeOptions.includes(pageSize) ? String(pageSize) : '20';
    pageSizeSelect.addEventListener('change', (e) => {
      const next = parseInt(e.target.value, 10);
      pageSize = pageSizeOptions.includes(next) ? next : 20;
      currentPage = 1;
      loadData(currentPage);
    });

    loadStats().catch(() => {});
    loadData(currentPage).catch(() => {
      tbody.innerHTML = '<tr><td colspan="7" class="empty">' + text.loadFailed + '</td></tr>';
    });
  `;
  return renderPage({
    lang,
    title: t.userTitle,
    active: 'user',
    hideUserNav: true,
    body,
    script,
    requestUrl: url,
  });
}

function getJavPage(url: URL, lang: PageLang): string {
  const t = TEXT[lang];
  const { page, pageSize } = getPageParams(url);
  const pageSizeOptions = PAGE_SIZE_OPTIONS
    .map(size => `<option value="${size}" ${size === pageSize ? 'selected' : ''}>${size}</option>`)
    .join('');
  const body = `
    <section class="section">
      <div class="section-title">${t.javTitle}</div>
      <p class="muted">${t.javSubtitle}</p>
    </section>
    <div class="stats-grid">
      <div class="card">
        <div class="stat-title">${t.statsJavTotal}</div>
        <div class="stat-value" id="stat-jav-total">-</div>
      </div>
      <div class="card">
        <div class="stat-title">${t.statsJavToday}</div>
        <div class="stat-value" id="stat-jav-today">-</div>
      </div>
    </div>
    <div class="card table-card">
      <div class="table-wrapper">
        <table>
          <thead>
            <tr>
              <th>${t.tableTime}</th>
              <th>${t.tableJavId}</th>
              <th>${t.tableTitle}</th>
              <th>${t.tableRelease}</th>
              <th>${t.tableActors}</th>
              <th>${t.tableCategories}</th>
              <th>${t.tableTorrents}</th>
              <th>${t.tableDetail}</th>
            </tr>
          </thead>
          <tbody id="data-body">
            <tr><td colspan="8" class="loading">${t.loading}</td></tr>
          </tbody>
        </table>
      </div>
    </div>
    <div class="toolbar">
      <div class="page-size">
        <span>${t.pageSizeLabel}</span>
        <select id="page-size">${pageSizeOptions}</select>
      </div>
    </div>
    <div class="pagination">
      <button id="btn-first" onclick="goToPage(1)">&laquo; ${t.paginationFirst}</button>
      <button id="btn-prev" onclick="goToPage(currentPage - 1)">&lsaquo; ${t.paginationPrev}</button>
      <span id="page-info" class="page-info">${t.pageInfo.replace('{current}', '1').replace('{total}', '1')}</span>
      <button id="btn-next" onclick="goToPage(currentPage + 1)">${t.paginationNext} &rsaquo;</button>
      <button id="btn-last" onclick="goToPage(totalPages)">${t.paginationLast} &raquo;</button>
    </div>
  `;
  const script = `
    const lang = ${JSON.stringify(lang)};
    const locale = lang === 'zh' ? 'zh-Hant' : 'en';
    const text = ${JSON.stringify({
      loading: t.loading,
      empty: t.empty,
      loadFailed: t.loadFailed,
      pageInfo: t.pageInfo,
    })};
    const pageSizeOptions = ${JSON.stringify(PAGE_SIZE_OPTIONS)};
    let currentPage = ${page};
    let pageSize = ${pageSize};
    let totalPages = 1;

    const tbody = document.getElementById('data-body');
    const pageInfo = document.getElementById('page-info');
    const pageSizeSelect = document.getElementById('page-size');

    function updateUrl() {
      const url = new URL(window.location.href);
      url.searchParams.set('page', String(currentPage));
      url.searchParams.set('pageSize', String(pageSize));
      url.searchParams.set('lang', lang);
      history.replaceState(null, '', url.pathname + url.search);
    }

    function updatePagination() {
      pageInfo.textContent = text.pageInfo
        .replace('{current}', String(currentPage))
        .replace('{total}', String(totalPages));
      document.getElementById('btn-first').disabled = currentPage <= 1;
      document.getElementById('btn-prev').disabled = currentPage <= 1;
      document.getElementById('btn-next').disabled = currentPage >= totalPages;
      document.getElementById('btn-last').disabled = currentPage >= totalPages;
    }

    async function loadStats() {
      const res = await fetch('/api/stats');
      const stats = await res.json();
      document.getElementById('stat-jav-total').textContent = Number(stats.javinfo_total || 0).toLocaleString(locale);
      document.getElementById('stat-jav-today').textContent = Number(stats.javinfo_today || 0).toLocaleString(locale);
    }

    async function loadData(page) {
      tbody.innerHTML = '<tr><td colspan="8" class="loading">' + text.loading + '</td></tr>';
      const res = await fetch('/api/javinfo?page=' + page + '&pageSize=' + pageSize);
      const result = await res.json();
      const rows = Array.isArray(result.data) ? result.data : [];
      currentPage = Math.max(1, Number(result.pagination?.page || 1));
      totalPages = Math.max(1, Number(result.pagination?.totalPages || 1));
      updatePagination();
      updateUrl();

      if (rows.length === 0) {
        tbody.innerHTML = '<tr><td colspan="8" class="empty">' + text.empty + '</td></tr>';
        return;
      }

      tbody.innerHTML = rows.map(row => {
        const timeSource = row.updated_at || row.created_at;
        const time = timeSource ? new Date(timeSource + 'Z').toLocaleString(locale) : '-';
        const actors = formatList(row.actors);
        const categories = formatList(row.categories);
        const torrents = Number(row.torrents_count || 0);
        const detailUrl = typeof row.detail_url === 'string' && row.detail_url.startsWith('http') ? row.detail_url : '';
        const detailLink = detailUrl
          ? '<a class="link" href="' + escapeHtml(detailUrl) + '" target="_blank" rel="noopener">' + escapeHtml(detailUrl) + '</a>'
          : '-';
        return '<tr>' +
          '<td>' + escapeHtml(time) + '</td>' +
          '<td>' + escapeHtml(row.jav_id || '-') + '</td>' +
          '<td>' + escapeHtml(row.title || '-') + '</td>' +
          '<td>' + escapeHtml(row.release_date || '-') + '</td>' +
          '<td>' + actors + '</td>' +
          '<td>' + categories + '</td>' +
          '<td>' + escapeHtml(torrents) + '</td>' +
          '<td>' + detailLink + '</td>' +
        '</tr>';
      }).join('');
    }

    function formatList(items) {
      if (!Array.isArray(items) || items.length === 0) return '-';
      const max = 3;
      const shown = items.slice(0, max).map(item => escapeHtml(item)).join(', ');
      if (items.length <= max) return shown;
      return shown + ' (+' + (items.length - max) + ')';
    }

    function goToPage(page) {
      if (page < 1 || page > totalPages) return;
      loadData(page);
    }

    function escapeHtml(str) {
      if (str === null || str === undefined) return '';
      return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
    }

    pageSizeSelect.value = pageSizeOptions.includes(pageSize) ? String(pageSize) : '20';
    pageSizeSelect.addEventListener('change', (e) => {
      const next = parseInt(e.target.value, 10);
      pageSize = pageSizeOptions.includes(next) ? next : 20;
      currentPage = 1;
      loadData(currentPage);
    });

    loadStats().catch(() => {});
    loadData(currentPage).catch(() => {
      tbody.innerHTML = '<tr><td colspan="8" class="empty">' + text.loadFailed + '</td></tr>';
    });
  `;
  return renderPage({
    lang,
    title: t.javTitle,
    active: 'jav',
    hideUserNav: true,
    body,
    script,
    requestUrl: url,
  });
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
      }
    }

    await env.DB.prepare(`CREATE INDEX IF NOT EXISTS idx_user_created_at ON user(created_at DESC);`).run();
    await env.DB.prepare(`CREATE INDEX IF NOT EXISTS idx_user_machine_name ON user(machine_name);`).run();
    await env.DB.prepare(`CREATE INDEX IF NOT EXISTS idx_user_user_name ON user(user_name);`).run();

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

function parseJsonArray(value: string | null): unknown[] {
  if (!value) return [];
  const parsed = JSON.parse(value);
  return Array.isArray(parsed) ? parsed : [];
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
    const lang = getLang(request);

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
      ctx.waitUntil(this.saveTelemetry(request.clone(), env));
      return jsonResponse({ success: true }, { headers: corsHeaders });
    }

    // GET /api/stats - Get statistics
    if (path === '/api/stats' && request.method === 'GET') {
      return this.getStats(env, corsHeaders);
    }

    // GET /api/javinfo - Get paginated JavInfo data
    if (path === '/api/javinfo' && request.method === 'GET') {
      const page = parseInt(url.searchParams.get('page') || '1', 10);
      const pageSize = parseInt(url.searchParams.get('pageSize') || '20', 10);
      return this.getJavInfoData(env, page, pageSize, corsHeaders);
    }

    // POST /api/javinfo - Store JavInfo (idempotent)
    if (path === '/api/javinfo' && request.method === 'POST') {
      return this.saveJavInfo(request, env, corsHeaders);
    }

    // GET /api/user - Get paginated user data
    if (path === '/api/user' && request.method === 'GET') {
      const page = parseInt(url.searchParams.get('page') || '1', 10);
      const pageSize = parseInt(url.searchParams.get('pageSize') || '20', 10);
      return this.getData(env, page, pageSize, corsHeaders);
    }

    // GET /api/data - Backward-compatible alias for /api/user
    if (path === '/api/data' && request.method === 'GET') {
      const page = parseInt(url.searchParams.get('page') || '1', 10);
      const pageSize = parseInt(url.searchParams.get('pageSize') || '20', 10);
      return this.getData(env, page, pageSize, corsHeaders);
    }

    // GET / - Home page
    if (path === '/' && request.method === 'GET') {
      return htmlResponse(getHomePage(url, lang));
    }

    // GET /user - Telemetry page
    if (path === '/user' && request.method === 'GET') {
      return htmlResponse(getUserPage(url, lang));
    }

    // GET /jav - JavInfo page
    if (path === '/jav' && request.method === 'GET') {
      return htmlResponse(getJavPage(url, lang));
    }

    // GET /admin - Redirect to /user
    if (path === '/admin' && request.method === 'GET') {
      const redirectUrl = new URL(url.toString());
      redirectUrl.pathname = '/user';
      redirectUrl.searchParams.set('lang', lang);
      return Response.redirect(redirectUrl.toString(), 302);
    }

    return new Response('Not Found', { status: 404 });
  },

  async saveTelemetry(request: Request, env: Env): Promise<void> {
    try {
      await ensureSchema(env);
      const payload: TelemetryPayload = await request.json();
      const cf = request.cf;

      await env.DB.prepare(`
        INSERT INTO user (machine_name, user_name, app_version, os_info, event_type, event_data, ip_address, user_agent, country, city)
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
      const totalResult = await env.DB.prepare('SELECT COUNT(*) as total FROM user').first<{ total: number }>();
      const uniqueMachinesResult = await env.DB.prepare('SELECT COUNT(DISTINCT machine_name) as count FROM user').first<{ count: number }>();
      const uniqueUsersResult = await env.DB.prepare('SELECT COUNT(DISTINCT user_name) as count FROM user').first<{ count: number }>();
      const todayResult = await env.DB.prepare(`SELECT COUNT(*) as count FROM user WHERE date(created_at) = date('now')`).first<{ count: number }>();

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
      const safePage = Number.isFinite(page) && page > 0 ? page : 1;
      const safePageSize = Math.min(Math.max(1, pageSize), 100);
      const safeOffset = (safePage - 1) * safePageSize;

      const countResult = await env.DB.prepare('SELECT COUNT(*) as total FROM user').first<{ total: number }>();
      const total = countResult?.total || 0;

      const dataResult = await env.DB.prepare(`
        SELECT * FROM user 
        ORDER BY created_at DESC 
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
  async getJavInfoData(env: Env, page: number, pageSize: number, corsHeaders: Record<string, string>): Promise<Response> {
    try {
      await ensureSchema(env);
      const safePage = Number.isFinite(page) && page > 0 ? page : 1;
      const safePageSize = Math.min(Math.max(1, pageSize), 100);
      const safeOffset = (safePage - 1) * safePageSize;

      const countResult = await env.DB.prepare('SELECT COUNT(*) as total FROM javinfo').first<{ total: number }>();
      const total = countResult?.total || 0;

      const dataResult = await env.DB.prepare(`
        SELECT
          jav_id, title, cover_url, release_date, duration, director, maker, publisher, series,
          actors_json, categories_json, torrents_json, detail_url, created_at, updated_at
        FROM javinfo
        ORDER BY updated_at DESC
        LIMIT ? OFFSET ?
      `).bind(safePageSize, safeOffset).all<JavInfoRecord>();

      const data = (dataResult.results ?? []).map(record => {
        const actors = parseJsonArray(record.actors_json).filter(item => typeof item === 'string') as string[];
        const categories = parseJsonArray(record.categories_json).filter(item => typeof item === 'string') as string[];
        const torrents = parseJsonArray(record.torrents_json);
        return {
          jav_id: record.jav_id,
          title: record.title,
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
          detail_url: record.detail_url,
          created_at: record.created_at,
          updated_at: record.updated_at,
        };
      });

      return jsonResponse({
        data,
        pagination: {
          page: safePage,
          pageSize: safePageSize,
          total,
          totalPages: Math.ceil(total / safePageSize),
        },
      }, { headers: corsHeaders });
    } catch (error) {
      console.error('Failed to get javinfo data:', error);
      return jsonResponse({
        data: [],
        pagination: { page: 1, pageSize: 20, total: 0, totalPages: 1 },
      }, { headers: corsHeaders });
    }
  },
};
