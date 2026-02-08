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
  return `<ul class="feat-list">${items.map(item => `<li>${item}</li>`).join('')}</ul>`;
}

function escapeHtml(value: string): string {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
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

/* ------------------------------------------------------------------ */
/*  Design System — Cinematic dark theme with warm amber accents      */
/* ------------------------------------------------------------------ */
const BASE_STYLES = `
  @keyframes fadeUp {
    from { opacity: 0; transform: translateY(1.25rem); }
    to   { opacity: 1; transform: translateY(0); }
  }
  @keyframes fadeIn {
    from { opacity: 0; }
    to   { opacity: 1; }
  }
  @keyframes shimmer {
    0%   { background-position: 200% 0; }
    100% { background-position: -200% 0; }
  }

  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

  :root {
    color-scheme: dark;
    --bg-deep:      #0b0b10;
    --bg-primary:   #111117;
    --bg-secondary: #1a1a23;
    --bg-elevated:  #23232f;
    --bg-hover:     #2b2b38;
    --bg-glass:     rgba(26,26,35,0.72);
    --text-primary:   #ece9e6;
    --text-secondary: #9d99a3;
    --text-muted:     #5d5963;
    --accent:       #d4942a;
    --accent-hover: #e5a840;
    --accent-faint: rgba(212,148,42,0.08);
    --accent-glow:  rgba(212,148,42,0.18);
    --border:       rgba(255,255,255,0.07);
    --border-subtle:rgba(255,255,255,0.04);
    --border-hover: rgba(255,255,255,0.14);
    --danger:       #e5534b;
    --success:      #3fb950;
    --shadow-sm:    0 1px 4px rgba(0,0,0,0.3);
    --shadow:       0 4px 12px rgba(0,0,0,0.35);
    --shadow-lg:    0 12px 40px rgba(0,0,0,0.5);
    --radius:       0.625rem;
    --radius-lg:    0.875rem;
    --font-display: 'Outfit', system-ui, sans-serif;
    --font-body:    -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Noto Sans', 'Noto Sans CJK SC', 'Noto Sans CJK JP', 'Noto Sans CJK KR', Roboto, sans-serif;
  }

  @media (prefers-color-scheme: light) {
    :root {
      color-scheme: light;
      --bg-deep:      #f4f2ef;
      --bg-primary:   #faf8f6;
      --bg-secondary: #ffffff;
      --bg-elevated:  #f0ede8;
      --bg-hover:     #e8e4df;
      --bg-glass:     rgba(255,255,255,0.72);
      --text-primary:   #1c1917;
      --text-secondary: #57534e;
      --text-muted:     #a19d99;
      --accent:       #b5791a;
      --accent-hover: #9a6616;
      --accent-faint: rgba(181,121,26,0.06);
      --accent-glow:  rgba(181,121,26,0.12);
      --border:       rgba(0,0,0,0.07);
      --border-subtle:rgba(0,0,0,0.04);
      --border-hover: rgba(0,0,0,0.13);
      --shadow-sm:    0 1px 4px rgba(0,0,0,0.05);
      --shadow:       0 4px 12px rgba(0,0,0,0.07);
      --shadow-lg:    0 12px 40px rgba(0,0,0,0.1);
    }
  }

  body {
    font-family: var(--font-body);
    background: var(--bg-deep);
    color: var(--text-primary);
    line-height: 1.6;
    -webkit-font-smoothing: antialiased;
    -moz-osx-font-smoothing: grayscale;
  }
  /* Film-grain noise overlay */
  body::after {
    content: '';
    position: fixed;
    inset: 0;
    pointer-events: none;
    z-index: 9999;
    opacity: 0.025;
    background-image: url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E");
  }

  a { color: var(--accent); text-decoration: none; transition: color 0.2s; }
  a:hover { color: var(--accent-hover); }

  .page { min-height: 100vh; position: relative; }
  .container { max-width: 72rem; margin: 0 auto; padding: 2.5rem 1.5rem; }
  .container.wide { max-width: 128rem; }

  /* ---- Header ---- */
  .header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 1.5rem;
    margin-bottom: 2rem;
    padding-bottom: 1.5rem;
    border-bottom: 1px solid var(--border);
    flex-wrap: wrap;
    animation: fadeUp 0.5s ease both;
  }
  .app-title {
    font-family: var(--font-display);
    font-size: 1.75rem;
    font-weight: 800;
    letter-spacing: -0.04em;
    color: var(--text-primary);
  }
  .app-title-accent { color: var(--accent); }
  .app-subtitle {
    color: var(--text-secondary);
    font-size: 0.875rem;
    margin-top: 0.125rem;
  }

  /* ---- Navigation ---- */
  .nav {
    display: flex;
    gap: 0.375rem;
    margin-bottom: 2rem;
    flex-wrap: wrap;
    animation: fadeUp 0.5s ease 0.05s both;
  }
  .nav a {
    padding: 0.5rem 1rem;
    border-radius: var(--radius);
    background: var(--bg-secondary);
    border: 1px solid var(--border);
    color: var(--text-secondary);
    font-weight: 500;
    font-size: 0.8125rem;
    transition: all 0.2s;
  }
  .nav a:hover {
    border-color: var(--border-hover);
    color: var(--text-primary);
    background: var(--bg-elevated);
  }
  .nav a.active {
    background: var(--accent);
    color: #fff;
    border-color: var(--accent);
    box-shadow: 0 2px 12px var(--accent-glow);
  }

  /* ---- Language switch ---- */
  .lang-switch {
    display: flex;
    gap: 0.125rem;
    font-size: 0.75rem;
    background: var(--bg-elevated);
    padding: 0.1875rem;
    border-radius: var(--radius);
    border: 1px solid var(--border-subtle);
  }
  .lang-switch a {
    color: var(--text-muted);
    padding: 0.3125rem 0.5rem;
    border-radius: calc(var(--radius) - 0.125rem);
    transition: all 0.2s;
  }
  .lang-switch a:hover {
    color: var(--text-primary);
    background: var(--bg-hover);
  }
  .lang-switch a.active {
    font-weight: 600;
    color: var(--text-primary);
    background: var(--bg-secondary);
    box-shadow: var(--shadow-sm);
  }

  /* ---- Admin ---- */
  .admin-actions {
    display: flex;
    justify-content: flex-end;
    align-items: center;
    margin-bottom: 0.5rem;
    gap: 0.5rem;
  }
  .admin-badge {
    display: inline-flex;
    align-items: center;
    padding: 0.1875rem 0.5rem;
    font-size: 0.6875rem;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.06em;
    color: #fff;
    background: var(--success);
    border-radius: 999px;
  }
  .inline-form { display: inline; }

  /* ---- Hero ---- */
  .hero {
    position: relative;
    display: flex;
    flex-direction: column;
    gap: 1.5rem;
    margin-bottom: 2.5rem;
    padding: 2.5rem;
    background: var(--bg-secondary);
    border-radius: var(--radius-lg);
    border: 1px solid var(--border);
    overflow: hidden;
    animation: fadeUp 0.5s ease 0.1s both;
  }
  .hero::before {
    content: '';
    position: absolute;
    inset: 0;
    background: radial-gradient(ellipse at 20% 40%, var(--accent-glow) 0%, transparent 55%),
                radial-gradient(ellipse at 80% 70%, rgba(100,60,200,0.06) 0%, transparent 50%);
    pointer-events: none;
  }
  .hero > * { position: relative; z-index: 1; }
  .hero-title {
    font-family: var(--font-display);
    font-size: 2rem;
    font-weight: 800;
    letter-spacing: -0.04em;
    line-height: 1.2;
  }
  .hero-title .accent { color: var(--accent); }
  .hero-desc {
    color: var(--text-secondary);
    font-size: 1rem;
    max-width: 36rem;
    line-height: 1.7;
  }
  .button-row { display: flex; gap: 0.75rem; flex-wrap: wrap; }

  /* ---- Buttons ---- */
  .button {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    padding: 0.6875rem 1.375rem;
    border-radius: var(--radius);
    border: none;
    background: var(--accent);
    color: #fff;
    font-family: var(--font-display);
    font-weight: 600;
    font-size: 0.875rem;
    cursor: pointer;
    transition: all 0.2s;
    box-shadow: 0 2px 10px var(--accent-glow);
  }
  .button:hover {
    background: var(--accent-hover);
    transform: translateY(-1px);
    box-shadow: 0 4px 20px var(--accent-glow);
  }
  .button.secondary {
    background: var(--bg-secondary);
    color: var(--text-primary);
    border: 1px solid var(--border);
    box-shadow: none;
  }
  .button.secondary:hover {
    border-color: var(--border-hover);
    background: var(--bg-elevated);
    transform: translateY(-1px);
  }
  .button.sm {
    padding: 0.375rem 0.75rem;
    font-size: 0.75rem;
  }
  .button.danger { background: var(--danger); box-shadow: none; }
  .button.danger:hover { background: #d4443c; }

  /* ---- Sections & Cards ---- */
  .section { margin-bottom: 2rem; animation: fadeUp 0.5s ease 0.15s both; }
  .section-title {
    font-family: var(--font-display);
    font-size: 1.125rem;
    font-weight: 700;
    margin-bottom: 0.75rem;
    color: var(--text-primary);
    letter-spacing: -0.02em;
  }
  .cards { display: grid; grid-template-columns: repeat(auto-fit, minmax(17rem, 1fr)); gap: 1.25rem; }
  .card {
    background: var(--bg-secondary);
    padding: 1.5rem;
    border-radius: var(--radius-lg);
    border: 1px solid var(--border);
    box-shadow: var(--shadow-sm);
    transition: all 0.2s;
  }
  .card:hover { box-shadow: var(--shadow); border-color: var(--border-hover); }
  .feat-list {
    padding-left: 1.125rem;
    display: grid;
    gap: 0.5rem;
    color: var(--text-secondary);
    font-size: 0.875rem;
    line-height: 1.6;
  }
  .feat-list li::marker { color: var(--accent); }

  /* ---- Stats ---- */
  .stats-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(9rem, 1fr));
    gap: 0.875rem;
    margin-bottom: 1.5rem;
    animation: fadeUp 0.5s ease 0.12s both;
  }
  .stat-card {
    position: relative;
    text-align: center;
    padding: 1.125rem 0.75rem;
    background: var(--bg-secondary);
    border-radius: var(--radius-lg);
    border: 1px solid var(--border);
    overflow: hidden;
    transition: all 0.2s;
  }
  .stat-card::before {
    content: '';
    position: absolute;
    inset: 0;
    background: linear-gradient(135deg, var(--accent-faint) 0%, transparent 60%);
    pointer-events: none;
  }
  .stat-card:hover { border-color: var(--border-hover); }
  .stat-title {
    position: relative;
    font-size: 0.6875rem;
    text-transform: uppercase;
    color: var(--text-muted);
    letter-spacing: 0.06em;
    font-weight: 600;
  }
  .stat-value {
    position: relative;
    font-family: var(--font-display);
    font-size: 1.75rem;
    font-weight: 800;
    color: var(--accent);
    margin-top: 0.375rem;
    letter-spacing: -0.03em;
  }

  /* ---- Tables ---- */
  .table-card { padding: 0; overflow: hidden; }
  .table-wrapper { width: 100%; overflow-x: auto; }
  table { width: 100%; border-collapse: collapse; }
  th, td {
    padding: 0.75rem 0.875rem;
    text-align: left;
    border-bottom: 1px solid var(--border);
    vertical-align: top;
  }
  th {
    background: var(--bg-elevated);
    font-weight: 600;
    color: var(--text-muted);
    font-size: 0.6875rem;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    position: sticky;
    top: 0;
    z-index: 2;
  }
  td { font-size: 0.8125rem; color: var(--text-secondary); }
  tr:hover td { background: var(--bg-hover); }

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
  .jav-table.compact-1 .hide-priority-1 { display: none; }
  .jav-table.compact-2 .hide-priority-2 { display: none; }
  .jav-table.compact-3 .hide-priority-3 { display: none; }
  .jav-table.compact-4 .hide-priority-4 { display: none; }

  .cover-thumb {
    display: block;
    width: 100%;
    aspect-ratio: 2 / 3;
    object-fit: contain;
    border: none;
    border-radius: 0;
    background: transparent;
  }

  /* ---- Jav Card Grid (public) ---- */
  .jav-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(12.5rem, 1fr));
    gap: 1rem;
    animation: fadeUp 0.5s ease 0.18s both;
  }
  .jav-card {
    background: var(--bg-secondary);
    border: 1px solid var(--border);
    border-radius: var(--radius-lg);
    overflow: hidden;
    transition: transform 0.25s, box-shadow 0.25s, border-color 0.25s;
    animation: fadeUp 0.4s ease both;
    cursor: default;
  }
  .jav-card:hover {
    transform: translateY(-3px);
    box-shadow: var(--shadow-lg);
    border-color: var(--border-hover);
  }
  .jav-card-cover {
    overflow: hidden;
    background: var(--bg-elevated);
    position: relative;
  }
  .jav-card-cover img {
    display: block;
    width: 100%;
    height: auto;
    transition: transform 0.35s ease;
  }
  .jav-card:hover .jav-card-cover img {
    transform: scale(1.04);
  }
  .no-cover {
    width: 100%;
    aspect-ratio: 2 / 3;
    display: flex;
    align-items: center;
    justify-content: center;
    color: var(--text-muted);
    font-family: var(--font-display);
    font-size: 1.25rem;
    font-weight: 700;
    letter-spacing: 0.04em;
    background: linear-gradient(135deg, var(--bg-elevated), var(--bg-secondary));
  }
  .jav-card-body { padding: 0.75rem; }
  .jav-card-id {
    font-family: var(--font-display);
    font-weight: 700;
    font-size: 0.875rem;
    margin-bottom: 0.1875rem;
  }
  .jav-card-id a { color: var(--accent); }
  .jav-card-id a:hover { color: var(--accent-hover); }
  .jav-card-title {
    font-size: 0.75rem;
    color: var(--text-secondary);
    display: -webkit-box;
    -webkit-line-clamp: 2;
    -webkit-box-orient: vertical;
    overflow: hidden;
    line-height: 1.5;
    margin-bottom: 0.5rem;
    min-height: 2.25em;
  }
  .jav-card-meta {
    font-size: 0.6875rem;
    color: var(--text-muted);
    margin-bottom: 0.375rem;
    display: flex;
    flex-wrap: wrap;
    gap: 0.125rem 0.25rem;
    line-height: 1.5;
  }
  .jav-card-meta a.actor-link {
    color: var(--text-secondary);
    cursor: pointer;
    transition: color 0.15s;
  }
  .jav-card-meta a.actor-link:hover {
    color: var(--accent);
  }
  .jav-card-tags {
    display: flex;
    flex-wrap: wrap;
    gap: 0.25rem;
    margin-bottom: 0.5rem;
    min-height: 1.375rem;
  }
  .jav-tag {
    display: inline-block;
    padding: 0.0625rem 0.375rem;
    font-size: 0.625rem;
    background: var(--accent-faint);
    color: var(--accent);
    border-radius: 0.25rem;
    border: 1px solid rgba(212,148,42,0.12);
    white-space: nowrap;
  }
  .jav-tag.more {
    background: var(--bg-elevated);
    color: var(--text-muted);
    border-color: var(--border);
  }
  .jav-card-footer {
    display: flex;
    justify-content: space-between;
    align-items: center;
    font-size: 0.6875rem;
    color: var(--text-muted);
  }
  .jav-card-pop {
    display: inline-flex;
    align-items: center;
    gap: 0.25rem;
  }
  .grid-status {
    grid-column: 1 / -1;
    text-align: center;
    padding: 3rem 1rem;
    color: var(--text-muted);
    font-size: 0.875rem;
  }

  /* ---- Loading / Empty ---- */
  .loading, .empty { text-align: center; padding: 3rem 1rem; color: var(--text-muted); }

  /* ---- Toolbar ---- */
  .toolbar {
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 0.75rem;
    margin: 1rem 0;
    flex-wrap: wrap;
    padding: 0.75rem 1rem;
    background: var(--bg-secondary);
    border-radius: var(--radius);
    border: 1px solid var(--border);
    animation: fadeUp 0.5s ease 0.2s both;
  }
  .filters {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    color: var(--text-secondary);
    font-size: 0.8125rem;
    flex-wrap: wrap;
  }
  .filters button {
    padding: 0.375rem 0.75rem;
    border-radius: var(--radius);
    border: 1px solid var(--border);
    background: var(--bg-secondary);
    color: var(--text-secondary);
    cursor: pointer;
    font-size: 0.75rem;
    transition: all 0.2s;
  }
  .filters button:hover { background: var(--bg-elevated); border-color: var(--border-hover); }
  .page-size {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    color: var(--text-secondary);
    font-size: 0.8125rem;
  }
  select {
    padding: 0.375rem 0.625rem;
    border-radius: var(--radius);
    border: 1px solid var(--border);
    background: var(--bg-secondary);
    color: var(--text-primary);
    font-size: 0.8125rem;
  }

  /* ---- Pagination ---- */
  .pagination {
    display: flex;
    justify-content: center;
    align-items: center;
    gap: 0.25rem;
    flex-wrap: wrap;
    margin-top: 1rem;
    padding: 0.75rem;
    background: var(--bg-secondary);
    border-radius: var(--radius);
    border: 1px solid var(--border);
    animation: fadeUp 0.5s ease 0.22s both;
  }
  .pagination button {
    padding: 0.375rem 0.75rem;
    border-radius: var(--radius);
    border: 1px solid var(--border);
    background: var(--bg-secondary);
    color: var(--text-secondary);
    cursor: pointer;
    font-size: 0.75rem;
    transition: all 0.2s;
  }
  .pagination button:hover:not(:disabled) {
    background: var(--accent);
    border-color: var(--accent);
    color: #fff;
  }
  .pagination button:disabled { opacity: 0.35; cursor: not-allowed; }
  .page-info { color: var(--text-muted); font-size: 0.75rem; padding: 0 0.5rem; }

  /* ---- Misc ---- */
  .muted { color: var(--text-muted); }
  .link { color: var(--accent); word-break: break-all; }
  .link:hover { color: var(--accent-hover); }

  .full-json {
    margin-top: 0.5rem;
    max-width: 36rem;
    max-height: 22rem;
    overflow: auto;
    font-size: 0.75rem;
    line-height: 1.4;
    padding: 0.625rem;
    border-radius: 0.5rem;
    background: var(--bg-elevated);
    border: 1px solid var(--border);
    white-space: pre-wrap;
    word-break: break-word;
  }

  /* ---- Modal ---- */
  .modal-mask {
    position: fixed;
    inset: 0;
    background: rgba(0,0,0,0.6);
    backdrop-filter: blur(6px);
    -webkit-backdrop-filter: blur(6px);
    display: none;
    align-items: center;
    justify-content: center;
    padding: 1rem;
    z-index: 1000;
    animation: fadeIn 0.15s ease;
  }
  .modal-mask.show { display: flex; }
  .modal-card {
    width: min(48rem, 100%);
    background: var(--bg-secondary);
    border: 1px solid var(--border);
    border-radius: var(--radius-lg);
    box-shadow: var(--shadow-lg);
    padding: 1.25rem;
    animation: fadeUp 0.25s ease;
  }
  .modal-title {
    font-family: var(--font-display);
    font-size: 1rem;
    font-weight: 700;
    margin-bottom: 0.75rem;
  }
  .mono-input {
    width: 100%;
    border: 1px solid var(--border);
    border-radius: 0.5rem;
    background: var(--bg-elevated);
    color: var(--text-primary);
    font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
    font-size: 0.75rem;
    line-height: 1.4;
    padding: 0.625rem 0.75rem;
    resize: vertical;
    min-height: 5rem;
  }
  .modal-actions {
    margin-top: 0.75rem;
    display: flex;
    gap: 0.5rem;
    justify-content: flex-end;
  }

  /* ---- Login ---- */
  .login-wrapper {
    display: flex;
    align-items: center;
    justify-content: center;
    min-height: 40vh;
    animation: fadeUp 0.5s ease 0.1s both;
  }
  .login-card {
    width: 100%;
    max-width: 24rem;
    background: var(--bg-secondary);
    border: 1px solid var(--border);
    border-radius: var(--radius-lg);
    padding: 2rem;
    box-shadow: var(--shadow-lg);
    position: relative;
    overflow: hidden;
  }
  .login-card::before {
    content: '';
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    height: 3px;
    background: linear-gradient(90deg, var(--accent), var(--accent-hover), var(--accent));
  }
  .login-title {
    font-family: var(--font-display);
    font-size: 1.25rem;
    font-weight: 700;
    margin-bottom: 0.25rem;
  }
  .login-subtitle {
    color: var(--text-muted);
    font-size: 0.8125rem;
    margin-bottom: 1.5rem;
  }
  .login-error {
    color: var(--danger);
    font-size: 0.8125rem;
    margin-bottom: 0.75rem;
    padding: 0.5rem 0.75rem;
    background: rgba(229,83,75,0.08);
    border-radius: var(--radius);
    border: 1px solid rgba(229,83,75,0.2);
  }
  .form-label {
    display: block;
    font-size: 0.75rem;
    font-weight: 600;
    color: var(--text-secondary);
    margin-bottom: 0.25rem;
    text-transform: uppercase;
    letter-spacing: 0.04em;
  }
  .form-input {
    width: 100%;
    padding: 0.625rem 0.75rem;
    border-radius: var(--radius);
    border: 1px solid var(--border);
    background: var(--bg-elevated);
    color: var(--text-primary);
    font-size: 0.875rem;
    margin-bottom: 1rem;
    transition: border-color 0.2s;
    outline: none;
  }
  .form-input:focus { border-color: var(--accent); }

  /* ---- Responsive ---- */
  @media (max-width: 48rem) {
    .header { flex-direction: column; align-items: flex-start; }
    .container { padding: 1.5rem 1rem; }
    .hero { padding: 1.75rem; }
    .hero-title { font-size: 1.5rem; }
    .stats-grid { grid-template-columns: repeat(2, 1fr); }
    .jav-grid { grid-template-columns: repeat(auto-fill, minmax(10rem, 1fr)); gap: 0.75rem; }
    .jav-card-body { padding: 0.625rem; }
    .jav-table th, .jav-table td { padding: 0.625rem 0.5rem; }
    .jav-table .col-time { min-width: 7.25rem; width: 7.25rem; }
    .jav-table .col-cover { min-width: 7rem; width: 7rem; }
    .jav-table .col-jav-id { min-width: 9.75rem; width: 9.75rem; max-width: 9.75rem; }
    .jav-table .col-title { min-width: 7rem; width: 7rem; }
    .cover-thumb { width: 100%; }
    .filters { gap: 0.375rem; }
  }
  @media (max-width: 30rem) {
    .jav-grid { grid-template-columns: repeat(2, 1fr); gap: 0.625rem; }
    .jav-card-title { font-size: 0.6875rem; -webkit-line-clamp: 1; min-height: 1em; }
    .jav-card-tags { display: none; }
    .stats-grid { grid-template-columns: 1fr 1fr; gap: 0.625rem; }
    .stat-value { font-size: 1.375rem; }
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
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Outfit:wght@400;500;600;700;800&display=swap">
  <style>${BASE_STYLES}</style>
</head>
<body>
  <div class="page">
    <div class="container${wideContainer ? ' wide' : ''}">
      <header class="header">
        <div>
          <div class="app-title"><span class="app-title-accent">Jav</span>Manager</div>
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

/* ================================================================== */
/*  Page: Home                                                        */
/* ================================================================== */
export function getHomePage(url: URL, lang: PageLang): string {
  const t = TEXT[lang];
  const runCommands = Array.isArray(t.homePagesItems) ? t.homePagesItems.join("\n") : "";
  const body = `
    <section class="hero">
      <div>
        <div class="hero-title">${t.homeTitle}</div>
        <p class="hero-desc">${t.homeIntro}</p>
      </div>
      <div>
        <div class="section-title">${t.homePagesTitle}</div>
        <div class="full-json">${escapeHtml(runCommands)}</div>
      </div>
      <div class="button-row">
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

/* ================================================================== */
/*  Page: Admin Login                                                 */
/* ================================================================== */
export function getAdminLoginPage(url: URL, lang: PageLang, errorMessage = ''): string {
  const t = TEXT[lang];
  const body = `
    <div class="login-wrapper">
      <div class="login-card">
        <div class="login-title">${t.adminLoginTitle}</div>
        <div class="login-subtitle">${t.adminLoginSubtitle}</div>
        ${errorMessage ? `<div class="login-error">${errorMessage}</div>` : ''}
        <form method="post" action="/admin/login?lang=${lang}">
          <label class="form-label" for="username">${t.adminUsername}</label>
          <input class="form-input" id="username" name="username" type="text" autocomplete="username" />
          <label class="form-label" for="password">${t.adminPassword}</label>
          <input class="form-input" id="password" name="password" type="password" autocomplete="current-password" />
          <button class="button" type="submit" style="width:100%; margin-top:0.25rem;">${t.adminSignIn}</button>
        </form>
      </div>
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

/* ================================================================== */
/*  Shared: Admin Actions bar                                         */
/* ================================================================== */
function getAdminActions(lang: PageLang): string {
  const t = TEXT[lang];
  return `
    <div class="admin-actions">
      <span class="admin-badge">${t.adminMode}</span>
      <a class="button secondary sm" href="/user?lang=${lang}">${t.navUser}</a>
      <form class="inline-form" method="post" action="/admin/logout?lang=${lang}">
        <button class="button secondary sm" type="submit">${t.adminLogout}</button>
      </form>
    </div>
  `;
}

/* ================================================================== */
/*  Page: User Telemetry (admin only)                                 */
/* ================================================================== */
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
      <div class="stat-card">
        <div class="stat-title">${t.statsTotal}</div>
        <div class="stat-value" id="stat-total">-</div>
      </div>
      <div class="stat-card">
        <div class="stat-title">${t.statsMachines}</div>
        <div class="stat-value" id="stat-machines">-</div>
      </div>
      <div class="stat-card">
        <div class="stat-title">${t.statsUsers}</div>
        <div class="stat-value" id="stat-users">-</div>
      </div>
      <div class="stat-card">
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
      tbody.innerHTML = '<tr><td colspan="8" class="loading">' + text.loading + '</td></tr>';
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

/* ================================================================== */
/*  Page: Jav Info (public card grid / admin table)                   */
/* ================================================================== */
export function getJavPage(url: URL, lang: PageLang, options?: { adminMode?: boolean }): string {
  const t = TEXT[lang];
  const adminMode = options?.adminMode ?? false;
  const { page, pageSize } = getPageParams(url);
  const pageSizeOptions = PAGE_SIZE_OPTIONS
    .map(size => `<option value="${size}" ${size === pageSize ? 'selected' : ''}>${size}</option>`)
    .join('');

  /* ---------- Public: card grid ---------- */
  if (!adminMode) {
    const body = `
      <section class="section">
        <div class="section-title">${t.javTitle}</div>
        <p class="muted">${t.javSubtitle}</p>
      </section>
      <div class="stats-grid">
        <div class="stat-card">
          <div class="stat-title">${t.statsJavTotal}</div>
          <div class="stat-value" id="stat-jav-total">-</div>
        </div>
        <div class="stat-card">
          <div class="stat-title">${t.statsJavToday}</div>
          <div class="stat-value" id="stat-jav-today">-</div>
        </div>
      </div>
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
      <div id="jav-cards" class="jav-grid">
        <div class="grid-status">${t.loading}</div>
      </div>
      <div id="magnet-modal" class="modal-mask" onclick="if (event.target === this) closeMagnetModal()">
        <div class="modal-card">
          <div class="modal-title" id="magnet-title">${t.bestMagnetTitle}</div>
          <textarea id="magnet-text" class="mono-input" readonly></textarea>
          <div class="modal-actions">
            <button class="button secondary sm" type="button" onclick="closeMagnetModal()">${t.filterClear}</button>
            <button class="button sm" type="button" onclick="copyBestMagnet()">${t.copyMagnet}</button>
          </div>
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
        bestMagnetTitle: t.bestMagnetTitle,
        copySuccess: t.copySuccess,
        copyFailed: t.copyFailed,
        tableSearchCount: t.tableSearchCount,
      })};
      const pageSizeOptions = ${JSON.stringify(PAGE_SIZE_OPTIONS)};
      let currentPage = ${page};
      let pageSize = ${pageSize};
      let totalPages = 1;
      let category = '';
      let actor = '';

      const grid = document.getElementById('jav-cards');
      const pageInfo = document.getElementById('page-info');
      const pageSizeSelect = document.getElementById('page-size');
      const categorySelect = document.getElementById('category-filter');
      const clearCategoryBtn = document.getElementById('btn-clear-category');
      const actorSelect = document.getElementById('actor-filter');
      const clearActorBtn = document.getElementById('btn-clear-actor');
      const magnetModal = document.getElementById('magnet-modal');
      const magnetTitle = document.getElementById('magnet-title');
      const magnetText = document.getElementById('magnet-text');

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
        } catch { /* ignore */ }
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
        } catch { /* ignore */ }
        actorSelect.value = actor || '';
      }

      async function loadData(page) {
        grid.innerHTML = '<div class="grid-status">' + text.loading + '</div>';
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
          grid.innerHTML = '<div class="grid-status">' + text.empty + '</div>';
          return;
        }

        grid.innerHTML = rows.map(function(row, idx) {
          var coverUrl = typeof row.cover_url === 'string' && row.cover_url.startsWith('http') ? row.cover_url : '';
          var javId = row.jav_id || '-';
          var title = row.title || '';
          var actors = Array.isArray(row.actors) ? row.actors : [];
          var categories = Array.isArray(row.categories) ? row.categories : [];
          var searchCount = Number(row.search_count) || 0;
          var bestTorrent = row.best_torrent && typeof row.best_torrent === 'object' ? row.best_torrent : null;
          var bestMagnet = bestTorrent && typeof bestTorrent.magnet_link === 'string' ? bestTorrent.magnet_link : '';
          var bestSourceTitle = bestTorrent && typeof bestTorrent.title === 'string' ? bestTorrent.title : title;

          var coverHtml = coverUrl
            ? '<img src="' + escapeAttr(coverUrl) + '" alt="' + escapeAttr(javId) + '" loading="lazy"/>'
            : '<div class="no-cover">' + escapeHtml(javId) + '</div>';

          var idHtml = bestMagnet
            ? '<a href="#" data-jid="' + escapeAttr(javId) + '" data-title="' + escapeAttr(bestSourceTitle) + '" data-mag="' + escapeAttr(bestMagnet) + '" onclick="openBestMagnet(this.dataset.jid, this.dataset.title, this.dataset.mag); return false;">' + escapeHtml(javId) + '</a>'
            : escapeHtml(javId);

          var actorHtml = actors.length > 0
            ? actors.slice(0, 3).map(function(a) {
                return '<a class="actor-link" href="#" data-actor="' + escapeAttr(a) + '" onclick="setActorFilter(this.dataset.actor); return false;">' + escapeHtml(a) + '</a>';
              }).join('<span>,</span> ') + (actors.length > 3 ? ' <span>+' + (actors.length - 3) + '</span>' : '')
            : '';

          var tagHtml = categories.slice(0, 3).map(function(c) {
            return '<span class="jav-tag">' + escapeHtml(c) + '</span>';
          }).join('');
          if (categories.length > 3) tagHtml += '<span class="jav-tag more">+' + (categories.length - 3) + '</span>';

          return '<div class="jav-card" style="animation-delay:' + (idx * 0.025) + 's">'
            + '<div class="jav-card-cover">' + coverHtml + '</div>'
            + '<div class="jav-card-body">'
            + '<div class="jav-card-id">' + idHtml + '</div>'
            + '<div class="jav-card-title">' + escapeHtml(title || '-') + '</div>'
            + (actorHtml ? '<div class="jav-card-meta">' + actorHtml + '</div>' : '')
            + '<div class="jav-card-tags">' + tagHtml + '</div>'
            + '<div class="jav-card-footer"><span class="jav-card-pop">' + escapeHtml(searchCount.toLocaleString(locale)) + '</span></div>'
            + '</div></div>';
        }).join('');
      }

      function openBestMagnet(javId, title, magnet) {
        if (!magnet || !magnetText || !magnetTitle || !magnetModal) return;
        var label = (javId || title) ? (text.bestMagnetTitle + ' - ' + (javId || title)) : text.bestMagnetTitle;
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

      function setActorFilter(name) {
        actor = name || '';
        actorSelect.value = actor;
        currentPage = 1;
        loadData(currentPage).catch(function() {});
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
      function escapeAttr(str) { return escapeHtml(str); }

      pageSizeSelect.value = pageSizeOptions.includes(pageSize) ? String(pageSize) : '20';
      pageSizeSelect.addEventListener('change', function(e) {
        var next = parseInt(e.target.value, 10);
        pageSize = pageSizeOptions.includes(next) ? next : 20;
        currentPage = 1;
        loadData(currentPage);
      });

      var initialUrl = new URL(window.location.href);
      category = initialUrl.searchParams.get('category') || '';
      actor = initialUrl.searchParams.get('actor') || '';
      categorySelect.addEventListener('change', function(e) {
        category = e.target.value || '';
        currentPage = 1;
        loadData(currentPage);
      });
      clearCategoryBtn.addEventListener('click', function() {
        category = '';
        categorySelect.value = '';
        currentPage = 1;
        loadData(currentPage);
      });
      actorSelect.addEventListener('change', function(e) {
        actor = e.target.value || '';
        currentPage = 1;
        loadData(currentPage);
      });
      clearActorBtn.addEventListener('click', function() {
        actor = '';
        actorSelect.value = '';
        currentPage = 1;
        loadData(currentPage);
      });

      loadCategories().catch(function() {});
      loadActors().catch(function() {});
      loadStats().catch(function() {});
      loadData(currentPage).catch(function() {
        grid.innerHTML = '<div class="grid-status">' + text.loadFailed + '</div>';
      });
    `;
    return renderPage({
      lang,
      title: t.javTitle,
      active: 'jav',
      hideUserNav: true,
      wideContainer: true,
      body,
      script,
      requestUrl: url,
    });
  }

  /* ---------- Admin: dense data table ---------- */
  const colSpan = 15;
  const body = `
    <section class="section">
      <div class="section-title">${t.javTitle}</div>
      <p class="muted">${t.javSubtitle}</p>
    </section>
    <div class="stats-grid">
      <div class="stat-card">
        <div class="stat-title">${t.statsJavTotal}</div>
        <div class="stat-value" id="stat-jav-total">-</div>
      </div>
      <div class="stat-card">
        <div class="stat-title">${t.statsJavToday}</div>
        <div class="stat-value" id="stat-jav-today">-</div>
      </div>
    </div>
    <div class="card table-card">
      <div class="table-wrapper" id="jav-table-wrapper">
        <table id="jav-table" class="jav-table">
          <thead>
          <tr>
            <th class="col-time">${t.tableTime}</th>
            <th class="col-jav-id">${t.tableJavId}</th>
            <th class="col-title">${t.tableTitle}</th>
            <th class="col-cover">${t.tableCover}</th>
            <th class="col-duration">${t.tableDuration}</th>
            <th class="col-director">${t.tableDirector}</th>
            <th class="col-maker">${t.tableMaker}</th>
            <th class="col-publisher">${t.tablePublisher}</th>
            <th class="col-series">${t.tableSeries}</th>
            <th class="col-actors">${t.tableActors}</th>
            <th class="col-categories">${t.tableCategories}</th>
            <th class="col-torrents hide-priority-4">${t.tableTorrents}</th>
            <th class="col-search hide-priority-3">${t.tableSearchCount}</th>
            <th class="col-detail hide-priority-2">${t.tableDetail}</th>
            <th class="col-actions hide-priority-1">${t.tableActions}</th>
          </tr>
        </thead>
        <tbody id="data-body">
            <tr><td colspan="${colSpan}" class="loading">${t.loading}</td></tr>
        </tbody>
      </table>
      </div>
    </div>
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
      actionDelete: t.actionDelete,
      confirmDelete: t.confirmDelete,
      deleteFailed: t.deleteFailed,
    })};
    const pageSizeOptions = ${JSON.stringify(PAGE_SIZE_OPTIONS)};
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
      } catch { /* ignore */ }
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
      } catch { /* ignore */ }
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
        const detailLink = detailUrl
          ? '<a class="link" href="' + escapeHtml(detailUrl) + '" target="_blank" rel="noopener">' + escapeHtml(detailUrl) + '</a>'
          : '-';
        const actions = '<button class="button danger sm" data-jav-id="' + escapeHtmlAttr(row.jav_id || '') + '" onclick="deleteJavInfo(this.dataset.javId)">' + escapeHtml(text.actionDelete) + '</button>';
        return '<tr>' +
          '<td class="col-time">' + escapeHtml(time) + '</td>' +
          '<td class="col-jav-id">' + escapeHtml(row.jav_id || '-') + '</td>' +
          '<td class="col-title">' + escapeHtml(row.title || '-') + '</td>' +
          '<td class="col-cover">' + coverCell + '</td>' +
          '<td class="col-duration">' + escapeHtml(durationText) + '</td>' +
          '<td class="col-director">' + escapeHtml(director) + '</td>' +
          '<td class="col-maker">' + escapeHtml(maker) + '</td>' +
          '<td class="col-publisher">' + escapeHtml(publisher) + '</td>' +
          '<td class="col-series">' + escapeHtml(series) + '</td>' +
          '<td class="col-actors">' + actors + '</td>' +
          '<td class="col-categories">' + categories + '</td>' +
          '<td class="col-torrents hide-priority-4">' + escapeHtml(String(torrents)) + '</td>' +
          '<td class="col-search hide-priority-3">' + escapeHtml(searchCount.toLocaleString(locale)) + '</td>' +
          '<td class="col-detail hide-priority-2">' + detailLink + '</td>' +
          '<td class="col-actions hide-priority-1">' + actions + '</td>' +
        '</tr>';
      }).join('');
      updateJavTableCompactMode();
    }

    async function deleteJavInfo(javId) {
      if (!javId) return;
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
    hideUserNav: false,
    adminActions: getAdminActions(lang),
    wideContainer: true,
    body,
    script,
    requestUrl: url,
  });
}
