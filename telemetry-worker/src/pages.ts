import { PageLang, TEXT } from './i18n';

const PAGE_SIZE_OPTIONS = [20, 50, 100];
const LATEST_RELEASE_URL = 'https://github.com/jqknono/jav-manager/releases/latest';

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
  const langs: { code: PageLang; label: string }[] = [
    { code: 'en', label: t.langEnglish },
    { code: 'zh', label: t.langChinese },
    { code: 'ja', label: t.langJapanese },
    { code: 'ko', label: t.langKorean },
  ];
  const links = langs.map(({ code, label }) => {
    const u = new URL(url.toString());
    u.searchParams.set('lang', code);
    return `<a class="${lang === code ? 'active' : ''}" href="${u.pathname + u.search}">${label}</a>`;
  }).join('');
  return `<div class="lang-switch">${links}</div>`;
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
  :root { 
    color-scheme: light dark;
    --bg-primary: #f8fafc;
    --bg-secondary: #ffffff;
    --bg-tertiary: #f1f5f9;
    --text-primary: #0f172a;
    --text-secondary: #475569;
    --text-muted: #94a3b8;
    --accent: #6366f1;
    --accent-hover: #4f46e5;
    --border: #e2e8f0;
    --border-hover: #cbd5e1;
    --shadow: 0 1px 3px rgba(0,0,0,0.05), 0 1px 2px rgba(0,0,0,0.1);
    --shadow-lg: 0 4px 6px rgba(0,0,0,0.05), 0 10px 15px rgba(0,0,0,0.1);
    --radius: 0.75rem;
    --radius-lg: 1rem;
  }
  @media (prefers-color-scheme: dark) {
    :root {
      --bg-primary: #0f172a;
      --bg-secondary: #1e293b;
      --bg-tertiary: #334155;
      --text-primary: #f1f5f9;
      --text-secondary: #cbd5e1;
      --text-muted: #64748b;
      --accent: #818cf8;
      --accent-hover: #a5b4fc;
      --border: #334155;
      --border-hover: #475569;
      --shadow: 0 1px 3px rgba(0,0,0,0.3);
      --shadow-lg: 0 4px 6px rgba(0,0,0,0.3);
    }
  }
  body { 
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Noto Sans', 'Noto Sans CJK SC', 'Noto Sans CJK JP', 'Noto Sans CJK KR', Roboto, sans-serif; 
    background: var(--bg-primary); 
    color: var(--text-primary); 
    line-height: 1.6; 
  }
  a { color: var(--accent); text-decoration: none; transition: color 0.15s; }
  a:hover { color: var(--accent-hover); }
  .page { min-height: 100vh; }
  .container { max-width: 76rem; margin: 0 auto; padding: 2rem 1.5rem; }
  .container.wide { max-width: 128rem; }
  .header { 
    display: flex; 
    justify-content: space-between; 
    align-items: center; 
    gap: 1.5rem; 
    margin-bottom: 2rem; 
    flex-wrap: wrap;
    padding-bottom: 1.5rem;
    border-bottom: 1px solid var(--border);
  }
  .app-title { 
    font-size: 1.875rem; 
    font-weight: 800; 
    color: var(--text-primary);
    letter-spacing: -0.025em;
  }
  .app-subtitle { color: var(--text-secondary); font-size: 0.9375rem; margin-top: 0.25rem; }
  .nav { display: flex; gap: 0.5rem; margin-bottom: 2rem; flex-wrap: wrap; }
  .nav a { 
    padding: 0.625rem 1rem; 
    border-radius: var(--radius); 
    background: var(--bg-secondary); 
    border: 1px solid var(--border);
    color: var(--text-secondary);
    font-weight: 500;
    font-size: 0.875rem;
    transition: all 0.15s;
  }
  .nav a:hover { border-color: var(--border-hover); color: var(--text-primary); }
  .nav a.active { 
    background: var(--accent); 
    color: #fff; 
    border-color: var(--accent);
  }
  .lang-switch { 
    display: flex; 
    gap: 0.25rem; 
    font-size: 0.8125rem;
    background: var(--bg-tertiary);
    padding: 0.25rem;
    border-radius: var(--radius);
  }
  .lang-switch a { 
    color: var(--text-muted); 
    padding: 0.375rem 0.625rem;
    border-radius: calc(var(--radius) - 0.125rem);
    transition: all 0.15s;
  }
  .lang-switch a:hover { color: var(--text-primary); background: var(--bg-secondary); }
  .lang-switch a.active { 
    font-weight: 600; 
    color: var(--text-primary);
    background: var(--bg-secondary);
    box-shadow: var(--shadow);
  }
  .admin-actions { display: flex; justify-content: flex-end; margin-bottom: 0.5rem; gap: 0.5rem; }
  .admin-badge {
    display: inline-flex;
    align-items: center;
    padding: 0.25rem 0.5rem;
    font-size: 0.75rem;
    font-weight: 700;
    color: #fff;
    background: #16a34a;
    border-radius: 999px;
  }
  .inline-form { display: inline; }
  .hero { 
    display: flex; 
    flex-direction: column; 
    gap: 1.5rem; 
    margin-bottom: 2.5rem;
    padding: 2rem;
    background: linear-gradient(135deg, var(--bg-secondary) 0%, var(--bg-tertiary) 100%);
    border-radius: var(--radius-lg);
    border: 1px solid var(--border);
  }
  .hero .section-title { font-size: 1.5rem; }
  .button-row { display: flex; gap: 0.75rem; flex-wrap: wrap; }
  .button { 
    display: inline-flex; 
    align-items: center; 
    justify-content: center; 
    padding: 0.75rem 1.5rem; 
    border-radius: var(--radius); 
    border: none;
    background: var(--accent); 
    color: #fff; 
    font-weight: 600;
    font-size: 0.9375rem;
    cursor: pointer;
    transition: all 0.15s;
    box-shadow: var(--shadow);
  }
  .button:hover { background: var(--accent-hover); transform: translateY(-1px); box-shadow: var(--shadow-lg); }
  .button.secondary { 
    background: var(--bg-secondary); 
    color: var(--text-primary);
    border: 1px solid var(--border);
  }
  .button.secondary:hover { border-color: var(--border-hover); }
  .section { margin-bottom: 2rem; }
  .section-title { 
    font-size: 1.125rem; 
    font-weight: 700; 
    margin-bottom: 0.75rem; 
    color: var(--text-primary);
    letter-spacing: -0.01em;
  }
  .cards { display: grid; grid-template-columns: repeat(auto-fit, minmax(18rem, 1fr)); gap: 1.25rem; }
  .card { 
    background: var(--bg-secondary); 
    padding: 1.5rem; 
    border-radius: var(--radius-lg); 
    border: 1px solid var(--border); 
    box-shadow: var(--shadow);
    transition: all 0.15s;
  }
  .card:hover { box-shadow: var(--shadow-lg); }
  .stats-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(10rem, 1fr)); gap: 1rem; margin-bottom: 1.5rem; }
  .stats-grid .card { text-align: center; padding: 1.25rem; }
  .stat-title { 
    font-size: 0.75rem; 
    text-transform: uppercase; 
    color: var(--text-muted); 
    letter-spacing: 0.05em;
    font-weight: 600;
  }
  .stat-value { 
    font-size: 2rem; 
    font-weight: 800; 
    color: var(--accent); 
    margin-top: 0.5rem;
    letter-spacing: -0.025em;
  }
  .table-card { padding: 0; overflow: hidden; }
  .table-wrapper { width: 100%; overflow-x: auto; }
  table { width: 100%; border-collapse: collapse; }
  th, td { 
    padding: 0.875rem 1rem; 
    text-align: left; 
    border-bottom: 1px solid var(--border); 
    vertical-align: top; 
  }
  th { 
    background: var(--bg-tertiary); 
    font-weight: 600; 
    color: var(--text-secondary); 
    font-size: 0.8125rem;
    text-transform: uppercase;
    letter-spacing: 0.03em;
  }
  td { font-size: 0.875rem; color: var(--text-secondary); }
  tr:hover td { background: var(--bg-tertiary); }
  .jav-table { width: 100%; min-width: 100%; table-layout: auto; }
  .jav-table .col-time { white-space: nowrap; min-width: 9.5rem; width: 9.5rem; }
  .jav-table .col-cover { white-space: nowrap; min-width: 10rem; width: 10rem; }
  .jav-table .col-jav-id { white-space: nowrap; min-width: 10rem; width: 10rem; max-width: 10rem; }
  .jav-table th.col-jav-id,
  .jav-table td.col-jav-id { font-variant-numeric: tabular-nums; }
  .jav-table .col-title { min-width: 10rem; width: 10rem; }
  .jav-table td.col-title,
  .jav-table td.col-actors,
  .jav-table td.col-categories { overflow-wrap: anywhere; }
  .jav-table td.col-title { white-space: normal; word-break: break-word; }
  .jav-table td.col-jav-id .link { word-break: normal; }
  /* Hide the last 4 columns progressively when width is constrained. */
  .jav-table.compact-1 .hide-priority-1 { display: none; }
  .jav-table.compact-2 .hide-priority-2 { display: none; }
  .jav-table.compact-3 .hide-priority-3 { display: none; }
  .jav-table.compact-4 .hide-priority-4 { display: none; }
  .loading, .empty { text-align: center; padding: 3rem 1rem; color: var(--text-muted); }
  .toolbar { 
    display: flex; 
    justify-content: space-between; 
    align-items: center; 
    gap: 1rem; 
    margin: 1.25rem 0; 
    flex-wrap: wrap;
    padding: 1rem;
    background: var(--bg-secondary);
    border-radius: var(--radius);
    border: 1px solid var(--border);
  }
  .filters { display: flex; align-items: center; gap: 0.5rem; color: var(--text-secondary); font-size: 0.875rem; }
  .filters button { 
    padding: 0.5rem 0.875rem; 
    border-radius: var(--radius); 
    border: 1px solid var(--border); 
    background: var(--bg-secondary); 
    color: var(--text-secondary);
    cursor: pointer;
    font-size: 0.8125rem;
    transition: all 0.15s;
  }
  .filters button:hover { background: var(--bg-tertiary); border-color: var(--border-hover); }
  .page-size { display: flex; align-items: center; gap: 0.5rem; color: var(--text-secondary); font-size: 0.875rem; }
  select { 
    padding: 0.5rem 0.75rem; 
    border-radius: var(--radius); 
    border: 1px solid var(--border); 
    background: var(--bg-secondary);
    color: var(--text-primary);
    font-size: 0.875rem;
  }
  .pagination { 
    display: flex; 
    justify-content: center; 
    align-items: center; 
    gap: 0.375rem; 
    flex-wrap: wrap; 
    margin-top: 1rem;
    padding: 1rem;
    background: var(--bg-secondary);
    border-radius: var(--radius);
    border: 1px solid var(--border);
  }
  .pagination button { 
    padding: 0.5rem 0.875rem; 
    border-radius: var(--radius); 
    border: 1px solid var(--border); 
    background: var(--bg-secondary); 
    color: var(--text-secondary);
    cursor: pointer;
    font-size: 0.8125rem;
    transition: all 0.15s;
  }
  .pagination button:hover:not(:disabled) { 
    background: var(--accent); 
    border-color: var(--accent); 
    color: #fff; 
  }
  .pagination button:disabled { opacity: 0.4; cursor: not-allowed; }
  .page-info { color: var(--text-muted); font-size: 0.8125rem; padding: 0 0.5rem; }
  .list { padding-left: 1.25rem; display: grid; gap: 0.625rem; color: var(--text-secondary); font-size: 0.9375rem; }
  .list li::marker { color: var(--accent); }
  .muted { color: var(--text-muted); }
  .link { color: var(--accent); word-break: break-all; }
  .link:hover { color: var(--accent-hover); }
  .cover-thumb {
    display: block;
    width: 100%;
    aspect-ratio: 2 / 3;
    object-fit: contain;
    border: none;
    border-radius: 0;
    background: transparent;
  }
  .full-json {
    margin-top: 0.5rem;
    max-width: 36rem;
    max-height: 22rem;
    overflow: auto;
    font-size: 0.75rem;
    line-height: 1.4;
    padding: 0.625rem;
    border-radius: 0.5rem;
    background: var(--bg-tertiary);
    border: 1px solid var(--border);
    white-space: pre-wrap;
    word-break: break-word;
  }
  .modal-mask {
    position: fixed;
    inset: 0;
    background: rgba(15, 23, 42, 0.55);
    display: none;
    align-items: center;
    justify-content: center;
    padding: 1rem;
    z-index: 1000;
  }
  .modal-mask.show { display: flex; }
  .modal-card {
    width: min(52rem, 100%);
    background: var(--bg-secondary);
    border: 1px solid var(--border);
    border-radius: var(--radius-lg);
    box-shadow: var(--shadow-lg);
    padding: 1rem;
  }
  .modal-title {
    font-size: 1rem;
    font-weight: 700;
    margin-bottom: 0.75rem;
  }
  .mono-input {
    width: 100%;
    border: 1px solid var(--border);
    border-radius: 0.5rem;
    background: var(--bg-tertiary);
    color: var(--text-primary);
    font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
    font-size: 0.75rem;
    line-height: 1.4;
    padding: 0.625rem 0.75rem;
    resize: vertical;
    min-height: 6rem;
  }
  .modal-actions {
    margin-top: 0.75rem;
    display: flex;
    gap: 0.5rem;
    justify-content: flex-end;
  }
  @media (max-width: 48rem) {
    .header { flex-direction: column; align-items: flex-start; }
    .container { padding: 1.25rem; }
    .hero { padding: 1.5rem; }
    .jav-table th, .jav-table td { padding: 0.75rem 0.625rem; }
    .jav-table .col-time { min-width: 7.25rem; width: 7.25rem; }
    .jav-table .col-cover { min-width: 7rem; width: 7rem; }
    .jav-table .col-jav-id { min-width: 9.75rem; width: 9.75rem; max-width: 9.75rem; }
    .jav-table .col-title { min-width: 7rem; width: 7rem; }
    .cover-thumb { width: 100%; }
  }
`;

function renderPage(params: {
  lang: PageLang;
  title: string;
  description?: string;
  active: 'home' | 'user' | 'jav';
  hideUserNav?: boolean;
  adminActions?: string;
  wideContainer?: boolean;
  body: string;
  script?: string;
  requestUrl: URL;
}): string {
  const { lang, title, description, active, hideUserNav, adminActions, wideContainer, body, script, requestUrl } = params;
  const t = TEXT[lang];
  const htmlLangMap: Record<PageLang, string> = { en: 'en', zh: 'zh-Hans', ja: 'ja', ko: 'ko' };
  const htmlLang = htmlLangMap[lang] ?? 'en';
  const pageTitle = title ? `${title} - ${t.appName}` : t.appName;
  return `<!DOCTYPE html>
<html lang="${htmlLang}">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${pageTitle}</title>
  <link rel="icon" type="image/x-icon" href="/favicon.ico">
  <style>${BASE_STYLES}</style>
</head>
<body>
  <div class="page">
    <div class="container${wideContainer ? ' wide' : ''}">
      <header class="header">
        <div>
          <div class="app-title">${t.appName}</div>
          <div class="app-subtitle">${description ?? t.appTagline}</div>
        </div>
        <div>
          ${adminActions ?? ''}
          ${buildLangSwitch(requestUrl, lang)}
        </div>
      </header>
      ${renderNav(lang, active, { hideUser: hideUserNav })}
      ${body}
    </div>
  </div>
  ${script ? `<script>${script}</script>` : ''}
</body>
</html>`;
}

export function getHomePage(url: URL, lang: PageLang): string {
  const t = TEXT[lang];
  const body = `
    <section class="hero">
      <div>
        <div class="section-title">${t.homeTitle}</div>
        <p class="muted">${t.homeIntro}</p>
      </div>
      <div class="button-row">
        <a class="button" href="${LATEST_RELEASE_URL}" target="_blank" rel="noopener">${t.downloadLatest}</a>
        <a class="button secondary" href="/jav?lang=${lang}">${t.viewJav}</a>
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

export function getAdminLoginPage(url: URL, lang: PageLang, errorMessage = ''): string {
  const t = TEXT[lang];
  const body = `
    <section class="section">
      <div class="section-title">${t.adminLoginTitle}</div>
      <p class="muted">${t.adminLoginSubtitle}</p>
    </section>
    <div class="card" style="max-width: 28rem;">
      ${errorMessage ? `<p style="color:#dc2626; margin-bottom:0.75rem;">${errorMessage}</p>` : ''}
      <form method="post" action="/admin/login?lang=${lang}">
        <label class="muted" for="username">${t.adminUsername}</label>
        <input id="username" name="username" type="text" autocomplete="username" style="width:100%; margin:0.25rem 0 0.75rem; padding:0.625rem 0.75rem; border-radius:0.5rem; border:1px solid var(--border); background:var(--bg-secondary); color:var(--text-primary);" />
        <label class="muted" for="password">${t.adminPassword}</label>
        <input id="password" name="password" type="password" autocomplete="current-password" style="width:100%; margin:0.25rem 0 1rem; padding:0.625rem 0.75rem; border-radius:0.5rem; border:1px solid var(--border); background:var(--bg-secondary); color:var(--text-primary);" />
        <button class="button" type="submit">${t.adminSignIn}</button>
      </form>
    </div>
  `;
  return renderPage({
    lang,
    title: t.adminLoginTitle,
    active: 'home',
    hideUserNav: true,
    body,
    requestUrl: url,
  });
}

function getAdminActions(lang: PageLang): string {
  const t = TEXT[lang];
  return `
    <div class="admin-actions">
      <span class="admin-badge">${t.adminMode}</span>
      <a class="button secondary" href="/user?lang=${lang}">${t.navUser}</a>
      <form class="inline-form" method="post" action="/admin/logout?lang=${lang}">
        <button class="button secondary" type="submit">${t.adminLogout}</button>
      </form>
    </div>
  `;
}

export function getUserPage(url: URL, lang: PageLang, adminMode = false): string {
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
              <th>${t.tableUserId}</th>
              <th>${t.tableVersion}</th>
              <th>${t.tableOs}</th>
              <th>${t.tableEvent}</th>
              <th>${t.tableLocation}</th>
            </tr>
          </thead>
          <tbody id="data-body">
            <tr><td colspan="8" class="loading">${t.loading}</td></tr>
          </tbody>
        </table>
      </div>
    </div>
    <div class="toolbar">
      <div class="filters">
        <span>${t.filterUserLabel}</span>
        <select id="user-filter"></select>
        <button id="btn-clear-filter" type="button">${t.filterClear}</button>
      </div>
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
    const localeMap = { en: 'en', zh: 'zh-Hans', ja: 'ja', ko: 'ko' };
    const locale = localeMap[lang] || 'en';
    const text = ${JSON.stringify({
      loading: t.loading,
      empty: t.empty,
      loadFailed: t.loadFailed,
      pageInfo: t.pageInfo,
      filterAllUsers: t.filterAllUsers,
    })};
    const pageSizeOptions = ${JSON.stringify(PAGE_SIZE_OPTIONS)};
    let currentPage = ${page};
    let pageSize = ${pageSize};
    let totalPages = 1;
    let userId = '';

    const tbody = document.getElementById('data-body');
    const pageInfo = document.getElementById('page-info');
    const pageSizeSelect = document.getElementById('page-size');
    const userFilterSelect = document.getElementById('user-filter');
    const clearFilterBtn = document.getElementById('btn-clear-filter');

    function updateUrl() {
      const url = new URL(window.location.href);
      url.searchParams.set('page', String(currentPage));
      url.searchParams.set('pageSize', String(pageSize));
      url.searchParams.set('lang', lang);
      if (userId) url.searchParams.set('userId', userId);
      else url.searchParams.delete('userId');
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
      const res = await fetch('/api/stats' + (userId ? ('?userId=' + encodeURIComponent(userId)) : ''));
      const stats = await res.json();
      document.getElementById('stat-total').textContent = Number(stats.total_records || 0).toLocaleString(locale);
      document.getElementById('stat-machines').textContent = Number(stats.unique_machines || 0).toLocaleString(locale);
      document.getElementById('stat-users').textContent = Number(stats.unique_users || 0).toLocaleString(locale);
      document.getElementById('stat-today').textContent = Number(stats.today_count || 0).toLocaleString(locale);
    }

    async function loadUsers() {
      userFilterSelect.innerHTML = '<option value="">' + escapeHtml(text.filterAllUsers) + '</option>';
      try {
        const res = await fetch('/api/users');
        const result = await res.json();
        const users = Array.isArray(result.data) ? result.data : [];
        const options = users.map(u => {
          const loc = [u.city, u.region, u.country].filter(Boolean).join(', ');
          const shortId = u.user_id ? String(u.user_id).slice(0, 8) : '';
          const label = [u.user_name, u.machine_name].filter(Boolean).join(' @ ')
            + (loc ? (' (' + loc + ')') : '')
            + (shortId ? (' [' + shortId + ']') : '')
            + (typeof u.event_count === 'number' ? (' (' + u.event_count + ')') : '');
          return '<option value="' + escapeHtml(u.user_id) + '">' + escapeHtml(label) + '</option>';
        }).join('');
        userFilterSelect.innerHTML = '<option value="">' + escapeHtml(text.filterAllUsers) + '</option>' + options;
      } catch {
        // ignore
      }
      userFilterSelect.value = userId || '';
    }

    function setUserFilter(nextUserId) {
      userId = nextUserId || '';
      currentPage = 1;
      userFilterSelect.value = userId;
      loadStats().catch(() => {});
      loadData(currentPage).catch(() => {});
    }

    async function loadData(page) {
      tbody.innerHTML = '<tr><td colspan="9" class="loading">' + text.loading + '</td></tr>';
      const userParam = userId ? ('&userId=' + encodeURIComponent(userId)) : '';
      const res = await fetch('/api/user?page=' + page + '&pageSize=' + pageSize + userParam);
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
        const time = row.created_at ? new Date(row.created_at + 'Z').toLocaleString(locale) : '-';
        const location = [row.city, row.region, row.country].filter(Boolean).join(', ') || '-';
        const uidShort = row.user_id ? String(row.user_id).slice(0, 8) : '-';
        const eventCell = (row.event_type || '-') + (row.event_data ? (': ' + row.event_data) : '');
        return '<tr>' +
          '<td>' + escapeHtml(time) + '</td>' +
          '<td>' + escapeHtml(row.machine_name || '-') + '</td>' +
          '<td>' + escapeHtml(row.user_name || '-') + '</td>' +
          '<td><a class="link" href="#" onclick="setUserFilter(\\'' + escapeHtml(row.user_id || '') + '\\'); return false;">' + escapeHtml(uidShort) + '</a></td>' +
          '<td>' + escapeHtml(row.app_version || '-') + '</td>' +
          '<td>' + escapeHtml(row.os_info || '-') + '</td>' +
          '<td>' + escapeHtml(eventCell) + '</td>' +
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

    const initialUrl = new URL(window.location.href);
    userId = initialUrl.searchParams.get('userId') || '';
    userFilterSelect.addEventListener('change', (e) => {
      setUserFilter(e.target.value);
    });
    clearFilterBtn.addEventListener('click', () => setUserFilter(''));

    loadUsers().catch(() => {});
    loadStats().catch(() => {});
    loadData(currentPage).catch(() => {
      tbody.innerHTML = '<tr><td colspan="8" class="empty">' + text.loadFailed + '</td></tr>';
    });
  `;
  return renderPage({
    lang,
    title: t.userTitle,
    active: 'user',
    hideUserNav: !adminMode,
    adminActions: adminMode ? getAdminActions(lang) : undefined,
    wideContainer: adminMode,
    body,
    script,
    requestUrl: url,
  });
}

export function getJavPage(url: URL, lang: PageLang, options?: { adminMode?: boolean }): string {
  const t = TEXT[lang];
  const adminMode = options?.adminMode ?? false;
  const { page, pageSize } = getPageParams(url);
  const pageSizeOptions = PAGE_SIZE_OPTIONS
    .map(size => `<option value="${size}" ${size === pageSize ? 'selected' : ''}>${size}</option>`)
    .join('');
  const colSpan = adminMode ? 15 : 6;
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
      <div class="table-wrapper" id="jav-table-wrapper">
        <table id="jav-table" class="jav-table">
          <thead>
          <tr>
            ${adminMode ? `<th class="col-time">${t.tableTime}</th>` : `<th class="col-cover">${t.tableCover}</th>`}
            <th class="col-jav-id">${t.tableJavId}</th>
            <th class="col-title">${t.tableTitle}</th>
            ${adminMode ? `<th class="col-cover">${t.tableCover}</th>` : ''}
            ${adminMode ? `<th class="col-duration">${t.tableDuration}</th><th class="col-director">${t.tableDirector}</th><th class="col-maker">${t.tableMaker}</th><th class="col-publisher">${t.tablePublisher}</th><th class="col-series">${t.tableSeries}</th>` : ''}
            <th class="${adminMode ? 'col-actors' : 'col-actors hide-priority-3'}">${t.tableActors}</th>
            <th class="${adminMode ? 'col-categories' : 'col-categories hide-priority-2'}">${t.tableCategories}</th>
            ${adminMode ? `<th class="col-torrents hide-priority-4">${t.tableTorrents}</th>` : ''}
            <th class="${adminMode ? 'col-search hide-priority-3' : 'col-search hide-priority-1'}">${t.tableSearchCount}</th>
            ${adminMode ? `<th class="col-detail hide-priority-2">${t.tableDetail}</th><th class="col-actions hide-priority-1">${t.tableActions}</th>` : ''}
          </tr>
        </thead>
        <tbody id="data-body">
            <tr><td colspan="${colSpan}" class="loading">${t.loading}</td></tr>
        </tbody>
      </table>
      </div>
    </div>
    ${adminMode ? '' : `
      <div id="magnet-modal" class="modal-mask" onclick="if (event.target === this) closeMagnetModal()">
        <div class="modal-card">
          <div class="modal-title" id="magnet-title">${t.bestMagnetTitle}</div>
          <textarea id="magnet-text" class="mono-input" readonly></textarea>
          <div class="modal-actions">
            <button class="button secondary" type="button" onclick="closeMagnetModal()">${t.filterClear}</button>
            <button class="button" type="button" onclick="copyBestMagnet()">${t.copyMagnet}</button>
          </div>
        </div>
      </div>
    `}
    <div class="toolbar">
      <div class="filters">
        <span>${t.filterCategoryLabel}</span>
        <select id="category-filter"></select>
        <button id="btn-clear-category" type="button">${t.filterClear}</button>
        <span>${t.filterActorLabel}</span>
        <select id="actor-filter"></select>
        <button id="btn-clear-actor" type="button">${t.filterClear}</button>
      </div>
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
    const localeMap = { en: 'en', zh: 'zh-Hans', ja: 'ja', ko: 'ko' };
    const locale = localeMap[lang] || 'en';
    const text = ${JSON.stringify({
      loading: t.loading,
      empty: t.empty,
      loadFailed: t.loadFailed,
      pageInfo: t.pageInfo,
      filterAllCategories: t.filterAllCategories,
      filterAllActors: t.filterAllActors,
      actionView: t.actionView,
      actionDelete: t.actionDelete,
      confirmDelete: t.confirmDelete,
      deleteFailed: t.deleteFailed,
      viewBestSource: t.viewBestSource,
      bestMagnetTitle: t.bestMagnetTitle,
      copySuccess: t.copySuccess,
      copyFailed: t.copyFailed,
    })};
    const pageSizeOptions = ${JSON.stringify(PAGE_SIZE_OPTIONS)};
    const adminMode = ${adminMode ? 'true' : 'false'};
    const colSpan = ${colSpan};
    let currentPage = ${page};
    let pageSize = ${pageSize};
    let totalPages = 1;
    let category = '';
    let actor = '';

    const tbody = document.getElementById('data-body');
    const pageInfo = document.getElementById('page-info');
    const pageSizeSelect = document.getElementById('page-size');
    const categorySelect = document.getElementById('category-filter');
    const clearCategoryBtn = document.getElementById('btn-clear-category');
    const actorSelect = document.getElementById('actor-filter');
    const clearActorBtn = document.getElementById('btn-clear-actor');
    const javTable = document.getElementById('jav-table');
    const javTableWrapper = document.getElementById('jav-table-wrapper');
    const magnetModal = document.getElementById('magnet-modal');
    const magnetTitle = document.getElementById('magnet-title');
    const magnetText = document.getElementById('magnet-text');
    const compactClasses = ['compact-1', 'compact-2', 'compact-3', 'compact-4'];

    function updateUrl() {
      const url = new URL(window.location.href);
      url.searchParams.set('page', String(currentPage));
      url.searchParams.set('pageSize', String(pageSize));
      url.searchParams.set('lang', lang);
      if (category) url.searchParams.set('category', category);
      else url.searchParams.delete('category');
      if (actor) url.searchParams.set('actor', actor);
      else url.searchParams.delete('actor');
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

    function updateJavTableCompactMode() {
      if (!javTable || !javTableWrapper) return;
      compactClasses.forEach((name) => javTable.classList.remove(name));
      const availableWidth = javTableWrapper.clientWidth;
      if (!availableWidth || javTable.scrollWidth <= availableWidth) return;
      for (let i = 1; i <= compactClasses.length; i += 1) {
        javTable.classList.add('compact-' + i);
        if (javTable.scrollWidth <= availableWidth) break;
      }
    }

    async function loadStats() {
      const res = await fetch('/api/stats');
      const stats = await res.json();
      document.getElementById('stat-jav-total').textContent = Number(stats.javinfo_total || 0).toLocaleString(locale);
      document.getElementById('stat-jav-today').textContent = Number(stats.javinfo_today || 0).toLocaleString(locale);
    }

    async function loadCategories() {
      categorySelect.innerHTML = '<option value="">' + escapeHtml(text.filterAllCategories) + '</option>';
      try {
        const res = await fetch('/api/javinfo/categories');
        const result = await res.json();
        const items = Array.isArray(result.data) ? result.data : [];
        const options = items.map((name) => '<option value="' + escapeHtml(name) + '">' + escapeHtml(name) + '</option>').join('');
        categorySelect.innerHTML = '<option value="">' + escapeHtml(text.filterAllCategories) + '</option>' + options;
      } catch {
        // ignore
      }
      categorySelect.value = category || '';
    }

    async function loadActors() {
      actorSelect.innerHTML = '<option value="">' + escapeHtml(text.filterAllActors) + '</option>';
      try {
        const res = await fetch('/api/javinfo/actors');
        const result = await res.json();
        const items = Array.isArray(result.data) ? result.data : [];
        const options = items.map((name) => '<option value="' + escapeHtml(name) + '">' + escapeHtml(name) + '</option>').join('');
        actorSelect.innerHTML = '<option value="">' + escapeHtml(text.filterAllActors) + '</option>' + options;
      } catch {
        // ignore
      }
      actorSelect.value = actor || '';
    }

    async function loadData(page) {
      tbody.innerHTML = '<tr><td colspan="' + colSpan + '" class="loading">' + text.loading + '</td></tr>';
      const categoryParam = category ? ('&category=' + encodeURIComponent(category)) : '';
      const actorParam = actor ? ('&actor=' + encodeURIComponent(actor)) : '';
      const res = await fetch('/api/javinfo?page=' + page + '&pageSize=' + pageSize + categoryParam + actorParam);
      const result = await res.json();
      const rows = Array.isArray(result.data) ? result.data : [];
      currentPage = Math.max(1, Number(result.pagination?.page || 1));
      totalPages = Math.max(1, Number(result.pagination?.totalPages || 1));
      updatePagination();
      updateUrl();

      if (rows.length === 0) {
        tbody.innerHTML = '<tr><td colspan="' + colSpan + '" class="empty">' + text.empty + '</td></tr>';
        updateJavTableCompactMode();
        return;
      }

      tbody.innerHTML = rows.map(row => {
        const timeSource = row.updated_at || row.created_at;
        const time = timeSource ? new Date(timeSource + 'Z').toLocaleString(locale) : '-';
        const actors = formatList(row.actors);
        const categories = formatList(row.categories);
        const torrents = Number(row.torrents_count || 0);
        const bestTorrent = row.best_torrent && typeof row.best_torrent === 'object' ? row.best_torrent : null;
        const bestMagnet = bestTorrent && typeof bestTorrent.magnet_link === 'string' ? bestTorrent.magnet_link : '';
        const bestSourceTitle = bestTorrent && typeof bestTorrent.title === 'string' ? bestTorrent.title : (row.title || '');
        const coverUrl = typeof row.cover_url === 'string' && row.cover_url.startsWith('http') ? row.cover_url : '';
        const detailUrl = typeof row.detail_url === 'string' && row.detail_url.startsWith('http') ? row.detail_url : '';
        const durationValue = Number(row.duration);
        const durationText = Number.isFinite(durationValue) && durationValue > 0 ? String(durationValue) : '-';
        const director = row.director || '-';
        const maker = row.maker || '-';
        const publisher = row.publisher || '-';
        const series = row.series || '-';
        const searchCountValue = Number(row.search_count);
        const searchCount = Number.isFinite(searchCountValue) ? searchCountValue : 0;
        const coverCell = coverUrl
          ? '<img class="cover-thumb" src="' + escapeHtmlAttr(coverUrl) + '" alt="' + escapeHtmlAttr(row.jav_id || row.title || "cover") + '" loading="lazy" />'
          : '-';
        const detailLink = (adminMode && detailUrl)
          ? '<a class="link" href="' + escapeHtml(detailUrl) + '" target="_blank" rel="noopener">' + escapeHtml(detailUrl) + '</a>'
          : '-';
        const actorsCellClass = adminMode ? 'col-actors' : 'col-actors hide-priority-3';
        const categoriesCellClass = adminMode ? 'col-categories' : 'col-categories hide-priority-2';
        const searchCellClass = adminMode ? 'col-search hide-priority-3' : 'col-search hide-priority-1';
        const javIdCell = (!adminMode && bestMagnet)
          ? '<a class="link" href="#" data-jav-id="' + escapeHtmlAttr(row.jav_id || '') + '" data-title="' + escapeHtmlAttr(bestSourceTitle) + '" data-magnet="' + escapeHtmlAttr(bestMagnet) + '" onclick="openBestMagnet(this.dataset.javId, this.dataset.title, this.dataset.magnet); return false;">' + escapeHtml(row.jav_id || '-') + '</a>'
          : escapeHtml(row.jav_id || '-');
        const actions = adminMode
          ? '<button class="button secondary" data-jav-id="' + escapeHtmlAttr(row.jav_id || '') + '" onclick="deleteJavInfo(this.dataset.javId)">' + escapeHtml(text.actionDelete) + '</button>'
          : '';
        return '<tr>' +
          (adminMode ? ('<td class="col-time">' + escapeHtml(time) + '</td>') : ('<td class="col-cover">' + coverCell + '</td>')) +
          '<td class="col-jav-id">' + javIdCell + '</td>' +
          '<td class="col-title">' + escapeHtml(row.title || '-') + '</td>' +
          (adminMode ? ('<td class="col-cover">' + coverCell + '</td>') : '') +
          (adminMode ? ('<td class="col-duration">' + escapeHtml(durationText) + '</td><td class="col-director">' + escapeHtml(director) + '</td><td class="col-maker">' + escapeHtml(maker) + '</td><td class="col-publisher">' + escapeHtml(publisher) + '</td><td class="col-series">' + escapeHtml(series) + '</td>') : '') +
          '<td class="' + actorsCellClass + '">' + actors + '</td>' +
          '<td class="' + categoriesCellClass + '">' + categories + '</td>' +
          (adminMode ? ('<td class="col-torrents hide-priority-4">' + escapeHtml(String(torrents)) + '</td>') : '') +
          '<td class="' + searchCellClass + '">' + escapeHtml(searchCount.toLocaleString(locale)) + '</td>' +
          (adminMode ? ('<td class="col-detail hide-priority-2">' + detailLink + '</td><td class="col-actions hide-priority-1">' + actions + '</td>') : '') +
        '</tr>';
      }).join('');
      updateJavTableCompactMode();
    }

    async function deleteJavInfo(javId) {
      if (!adminMode || !javId) return;
      const confirmText = text.confirmDelete.replace('{javId}', javId);
      if (!window.confirm(confirmText)) return;
      try {
        const res = await fetch('/api/javinfo/delete', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ jav_id: javId }),
        });
        if (!res.ok) {
          window.alert(text.deleteFailed);
          return;
        }
        await loadStats();
        await loadData(currentPage);
      } catch {
        window.alert(text.deleteFailed);
      }
    }

    function formatList(items) {
      if (!Array.isArray(items) || items.length === 0) return '-';
      const max = 3;
      const shown = items.slice(0, max).map(item => escapeHtml(item)).join(', ');
      if (items.length <= max) return shown;
      return shown + ' (+' + (items.length - max) + ')';
    }

    function openBestMagnet(javId, title, magnet) {
      if (!magnet || !magnetText || !magnetTitle || !magnetModal) return;
      const label = (javId || title) ? (text.bestMagnetTitle + ' - ' + (javId || title)) : text.bestMagnetTitle;
      magnetTitle.textContent = label;
      magnetText.value = magnet;
      magnetModal.classList.add('show');
      magnetText.focus();
      magnetText.select();
    }

    function closeMagnetModal() {
      if (!magnetModal) return;
      magnetModal.classList.remove('show');
    }

    async function copyBestMagnet() {
      if (!magnetText || !magnetText.value) return;
      try {
        if (navigator.clipboard && navigator.clipboard.writeText) {
          await navigator.clipboard.writeText(magnetText.value);
        } else {
          magnetText.focus();
          magnetText.select();
          document.execCommand('copy');
        }
        window.alert(text.copySuccess);
      } catch {
        window.alert(text.copyFailed);
      }
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

    function escapeHtmlAttr(str) { return escapeHtml(str); }

    pageSizeSelect.value = pageSizeOptions.includes(pageSize) ? String(pageSize) : '20';
    pageSizeSelect.addEventListener('change', (e) => {
      const next = parseInt(e.target.value, 10);
      pageSize = pageSizeOptions.includes(next) ? next : 20;
      currentPage = 1;
      loadData(currentPage);
    });

    const initialUrl = new URL(window.location.href);
    category = initialUrl.searchParams.get('category') || '';
    actor = initialUrl.searchParams.get('actor') || '';
    categorySelect.addEventListener('change', (e) => {
      category = e.target.value || '';
      currentPage = 1;
      loadData(currentPage);
    });
    clearCategoryBtn.addEventListener('click', () => {
      category = '';
      categorySelect.value = '';
      currentPage = 1;
      loadData(currentPage);
    });
    actorSelect.addEventListener('change', (e) => {
      actor = e.target.value || '';
      currentPage = 1;
      loadData(currentPage);
    });
    clearActorBtn.addEventListener('click', () => {
      actor = '';
      actorSelect.value = '';
      currentPage = 1;
      loadData(currentPage);
    });

    if (javTableWrapper && typeof ResizeObserver !== 'undefined') {
      const tableResizeObserver = new ResizeObserver(() => updateJavTableCompactMode());
      tableResizeObserver.observe(javTableWrapper);
    }
    window.addEventListener('resize', updateJavTableCompactMode, { passive: true });

    loadCategories().catch(() => {});
    loadActors().catch(() => {});
    loadStats().catch(() => {});
    loadData(currentPage).catch(() => {
      tbody.innerHTML = '<tr><td colspan="' + colSpan + '" class="empty">' + text.loadFailed + '</td></tr>';
      updateJavTableCompactMode();
    });
  `;
  return renderPage({
    lang,
    title: t.javTitle,
    active: 'jav',
    hideUserNav: !adminMode,
    adminActions: adminMode ? getAdminActions(lang) : undefined,
    wideContainer: true,
    body,
    script,
    requestUrl: url,
  });
}

