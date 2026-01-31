import { FAVICON_ICO_BYTES } from './favicon';

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

type PageLang = 'en' | 'zh' | 'ja' | 'ko';

const PAGE_SIZE_OPTIONS = [20, 50, 100];
const LATEST_RELEASE_URL = 'https://github.com/jqknono/jav-manager/releases/latest';

const TEXT = {
  en: {
    appName: 'JavManager',
    appTagline: 'Automation for JAV content management.',
    navHome: 'Home',
    navUser: 'Users',
    navJav: 'Trends',
    langEnglish: 'EN',
    langChinese: '中',
    langJapanese: '日',
    langKorean: '한',
    homeTitle: 'JavManager',
    homeIntro: 'A powerful tool for managing your JAV collection efficiently.',
    homeUsageTitle: 'How to use',
    homeUsageItems: [
      'Run JavManager and input a JAV ID (e.g. IPZZ-408).',
      'The app checks local cache, then fetches from JavDB if needed.',
      'Pick a torrent and send it to your downloader.',
    ],
    homeOverviewTitle: 'Features',
    homeOverviewItems: [
      'Smart local cache with remote JavDB fallback.',
      'Intelligent torrent sorting by markers and weights.',
      'Cross-platform desktop application.',
    ],
    homePagesTitle: 'Explore',
    homePagesItems: ['Browse popular trends'],
    viewUsers: 'View Users',
    viewJav: 'Browse Trends',
    downloadLatest: 'Download',
    userTitle: 'User Telemetry',
    userSubtitle: 'Anonymous usage events from clients.',
    javTitle: 'Trends',
    javSubtitle: 'Popular searches from the community.',
    statsTotal: 'Total Records',
    statsMachines: 'Unique Machines',
    statsUsers: 'Unique Users',
    statsToday: 'Today',
    statsJavTotal: 'Total Entries',
    statsJavToday: 'New Today',
    tableTime: 'Time',
    tableMachine: 'Machine',
    tableUser: 'User',
    tableUserId: 'User ID',
    tableVersion: 'Version',
    tableOs: 'OS',
    tableEvent: 'Event',
    tableLocation: 'Location',
    tableJavId: 'ID',
    tableTitle: 'Title',
    tableRelease: 'Release',
    tableActors: 'Actors',
    tableCategories: 'Categories',
    tableTorrents: 'Sources',
    tableSearchCount: 'Popularity',
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
    filterUserLabel: 'User',
    filterAllUsers: 'All users',
    filterClear: 'Clear',
  },
  zh: {
    appName: 'JavManager',
    appTagline: 'JAV 内容管理的自动化工具。',
    navHome: '首页',
    navUser: '用户',
    navJav: '趋势',
    langEnglish: 'EN',
    langChinese: '中',
    langJapanese: '日',
    langKorean: '한',
    homeTitle: 'JavManager',
    homeIntro: '高效管理您的 JAV 收藏的强大工具。',
    homeUsageTitle: '使用方式',
    homeUsageItems: [
      '启动 JavManager 后输入番号（例如 IPZZ-408）。',
      '先查本地缓存，未命中则查询 JavDB。',
      '选择种子并发送到下载器。',
    ],
    homeOverviewTitle: '功能特性',
    homeOverviewItems: [
      '智能本地缓存，支持远程 JavDB 回退。',
      '基于标记和权重的智能种子排序。',
      '跨平台桌面应用程序。',
    ],
    homePagesTitle: '探索',
    homePagesItems: ['浏览热门趋势'],
    viewUsers: '查看用户',
    viewJav: '浏览趋势',
    downloadLatest: '下载',
    userTitle: '用户遥测',
    userSubtitle: '匿名使用事件与统计。',
    javTitle: '趋势',
    javSubtitle: '社区热门搜索。',
    statsTotal: '总记录数',
    statsMachines: '唯一机器',
    statsUsers: '唯一用户',
    statsToday: '今日',
    statsJavTotal: '总条目',
    statsJavToday: '今日新增',
    tableTime: '时间',
    tableMachine: '机器',
    tableUser: '用户',
    tableUserId: '识别码',
    tableVersion: '版本',
    tableOs: '操作系统',
    tableEvent: '事件',
    tableLocation: '位置',
    tableJavId: '番号',
    tableTitle: '标题',
    tableRelease: '发行日',
    tableActors: '演员',
    tableCategories: '分类',
    tableTorrents: '片源',
    tableSearchCount: '热度',
    tableDetail: '详情',
    pageSizeLabel: '每页',
    paginationFirst: '首页',
    paginationPrev: '上一页',
    paginationNext: '下一页',
    paginationLast: '末页',
    pageInfo: '第 {current} / {total} 页',
    loading: '加载中...',
    empty: '暂无数据',
    loadFailed: '读取失败',
    filterUserLabel: '用户',
    filterAllUsers: '全部用户',
    filterClear: '清除',
  },
  ja: {
    appName: 'JavManager',
    appTagline: 'JAVコンテンツ管理の自動化ツール。',
    navHome: 'ホーム',
    navUser: 'ユーザー',
    navJav: 'トレンド',
    langEnglish: 'EN',
    langChinese: '中',
    langJapanese: '日',
    langKorean: '한',
    homeTitle: 'JavManager',
    homeIntro: 'JAVコレクションを効率的に管理する強力なツール。',
    homeUsageTitle: '使い方',
    homeUsageItems: [
      'JavManagerを起動し、品番を入力（例：IPZZ-408）。',
      'ローカルキャッシュを確認後、必要に応じてJavDBから取得。',
      'トレントを選択してダウンローダーに送信。',
    ],
    homeOverviewTitle: '機能',
    homeOverviewItems: [
      'リモートJavDBフォールバック付きスマートローカルキャッシュ。',
      'マーカーと重みによるインテリジェントなトレントソート。',
      'クロスプラットフォームデスクトップアプリ。',
    ],
    homePagesTitle: '探索',
    homePagesItems: ['人気トレンドを閲覧'],
    viewUsers: 'ユーザーを見る',
    viewJav: 'トレンドを見る',
    downloadLatest: 'ダウンロード',
    userTitle: 'ユーザーテレメトリ',
    userSubtitle: 'クライアントからの匿名使用イベント。',
    javTitle: 'トレンド',
    javSubtitle: 'コミュニティの人気検索。',
    statsTotal: '総レコード',
    statsMachines: 'ユニークマシン',
    statsUsers: 'ユニークユーザー',
    statsToday: '今日',
    statsJavTotal: '総エントリ',
    statsJavToday: '今日の新規',
    tableTime: '時間',
    tableMachine: 'マシン',
    tableUser: 'ユーザー',
    tableUserId: 'ユーザーID',
    tableVersion: 'バージョン',
    tableOs: 'OS',
    tableEvent: 'イベント',
    tableLocation: '場所',
    tableJavId: '品番',
    tableTitle: 'タイトル',
    tableRelease: 'リリース',
    tableActors: '出演者',
    tableCategories: 'カテゴリ',
    tableTorrents: 'ソース',
    tableSearchCount: '人気度',
    tableDetail: '詳細',
    pageSizeLabel: '表示件数',
    paginationFirst: '最初',
    paginationPrev: '前へ',
    paginationNext: '次へ',
    paginationLast: '最後',
    pageInfo: '{current} / {total} ページ',
    loading: '読み込み中...',
    empty: 'データがありません',
    loadFailed: '読み込み失敗',
    filterUserLabel: 'ユーザー',
    filterAllUsers: 'すべてのユーザー',
    filterClear: 'クリア',
  },
  ko: {
    appName: 'JavManager',
    appTagline: 'JAV 콘텐츠 관리 자동화 도구.',
    navHome: '홈',
    navUser: '사용자',
    navJav: '트렌드',
    langEnglish: 'EN',
    langChinese: '中',
    langJapanese: '日',
    langKorean: '한',
    homeTitle: 'JavManager',
    homeIntro: 'JAV 컬렉션을 효율적으로 관리하는 강력한 도구.',
    homeUsageTitle: '사용 방법',
    homeUsageItems: [
      'JavManager를 실행하고 품번 입력 (예: IPZZ-408).',
      '로컬 캐시 확인 후 필요시 JavDB에서 가져오기.',
      '토렌트를 선택하여 다운로더로 전송.',
    ],
    homeOverviewTitle: '기능',
    homeOverviewItems: [
      '원격 JavDB 폴백이 포함된 스마트 로컬 캐시.',
      '마커 및 가중치에 의한 지능형 토렌트 정렬.',
      '크로스 플랫폼 데스크톱 애플리케이션.',
    ],
    homePagesTitle: '탐색',
    homePagesItems: ['인기 트렌드 둘러보기'],
    viewUsers: '사용자 보기',
    viewJav: '트렌드 보기',
    downloadLatest: '다운로드',
    userTitle: '사용자 원격 측정',
    userSubtitle: '클라이언트의 익명 사용 이벤트.',
    javTitle: '트렌드',
    javSubtitle: '커뮤니티 인기 검색.',
    statsTotal: '총 레코드',
    statsMachines: '고유 머신',
    statsUsers: '고유 사용자',
    statsToday: '오늘',
    statsJavTotal: '총 항목',
    statsJavToday: '오늘 신규',
    tableTime: '시간',
    tableMachine: '머신',
    tableUser: '사용자',
    tableUserId: '사용자 ID',
    tableVersion: '버전',
    tableOs: 'OS',
    tableEvent: '이벤트',
    tableLocation: '위치',
    tableJavId: '품번',
    tableTitle: '제목',
    tableRelease: '출시일',
    tableActors: '출연자',
    tableCategories: '카테고리',
    tableTorrents: '소스',
    tableSearchCount: '인기도',
    tableDetail: '상세',
    pageSizeLabel: '페이지당',
    paginationFirst: '처음',
    paginationPrev: '이전',
    paginationNext: '다음',
    paginationLast: '마지막',
    pageInfo: '{current} / {total} 페이지',
    loading: '로딩 중...',
    empty: '데이터 없음',
    loadFailed: '로드 실패',
    filterUserLabel: '사용자',
    filterAllUsers: '모든 사용자',
    filterClear: '지우기',
  },
};

let schemaInit: Promise<void> | null = null;
let userIdBackfill: Promise<void> | null = null;

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
  if (langParam === 'zh' || langParam === 'zh-tw' || langParam === 'zh-hant' || langParam === 'zh-hk' || langParam === 'zh-cn')
    return 'zh';
  if (langParam === 'ja') return 'ja';
  if (langParam === 'ko') return 'ko';
  if (langParam === 'en') return 'en';
  const accept = (request.headers.get('Accept-Language') ?? '').toLowerCase();
  if (accept.includes('ja')) return 'ja';
  if (accept.includes('ko')) return 'ko';
  if (accept.includes('zh')) return 'zh';
  return 'en';
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
  @media (max-width: 48rem) {
    .header { flex-direction: column; align-items: flex-start; }
    .container { padding: 1.25rem; }
    .hero { padding: 1.5rem; }
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
            <th>${t.tableSearchCount}</th>
            <th>${t.tableDetail}</th>
          </tr>
        </thead>
        <tbody id="data-body">
            <tr><td colspan="9" class="loading">${t.loading}</td></tr>
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
    const localeMap = { en: 'en', zh: 'zh-Hans', ja: 'ja', ko: 'ko' };
    const locale = localeMap[lang] || 'en';
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
      tbody.innerHTML = '<tr><td colspan="9" class="loading">' + text.loading + '</td></tr>';
      const res = await fetch('/api/javinfo?page=' + page + '&pageSize=' + pageSize);
      const result = await res.json();
      const rows = Array.isArray(result.data) ? result.data : [];
      currentPage = Math.max(1, Number(result.pagination?.page || 1));
      totalPages = Math.max(1, Number(result.pagination?.totalPages || 1));
      updatePagination();
      updateUrl();

      if (rows.length === 0) {
        tbody.innerHTML = '<tr><td colspan="9" class="empty">' + text.empty + '</td></tr>';
        return;
      }

      tbody.innerHTML = rows.map(row => {
        const timeSource = row.updated_at || row.created_at;
        const time = timeSource ? new Date(timeSource + 'Z').toLocaleString(locale) : '-';
        const actors = formatList(row.actors);
        const categories = formatList(row.categories);
        const torrents = Number(row.torrents_count || 0);
        const detailUrl = typeof row.detail_url === 'string' && row.detail_url.startsWith('http') ? row.detail_url : '';
        const searchCountValue = Number(row.search_count);
        const searchCount = Number.isFinite(searchCountValue) ? searchCountValue : 0;
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
          '<td>' + escapeHtml(searchCount.toLocaleString(locale)) + '</td>' +
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

    // GET /favicon.ico - Site icon
    if (path === '/favicon.ico' && (request.method === 'GET' || request.method === 'HEAD')) {
      const headers = new Headers({
        'Content-Type': 'image/x-icon',
        'Cache-Control': 'public, max-age=31536000, immutable',
      });
      return new Response(request.method === 'HEAD' ? null : FAVICON_ICO_BYTES, { headers });
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
      return jsonResponse({ success: true }, { headers: corsHeaders });
    }

    // GET /api/stats - Get statistics
    if (path === '/api/stats' && request.method === 'GET') {
      const userId = url.searchParams.get('userId');
      return this.getStats(env, corsHeaders, userId);
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
      const userId = url.searchParams.get('userId');
      return this.getData(env, page, pageSize, corsHeaders, userId);
    }

    // GET /api/data - Backward-compatible alias for /api/user
    if (path === '/api/data' && request.method === 'GET') {
      const page = parseInt(url.searchParams.get('page') || '1', 10);
      const pageSize = parseInt(url.searchParams.get('pageSize') || '20', 10);
      const userId = url.searchParams.get('userId');
      return this.getData(env, page, pageSize, corsHeaders, userId);
    }

    // GET /api/users - List users for filtering (latest row + event counts)
    if (path === '/api/users' && request.method === 'GET') {
      return this.getUsers(env, corsHeaders);
    }

    // GET /api/javdb-domain - Get latest JavDB domain
    if (path === '/api/javdb-domain' && request.method === 'GET') {
      return this.getJavDbDomain(corsHeaders);
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

      await env.DB.prepare(`
        INSERT INTO user (user_id, machine_name, user_name, app_version, os_info, event_type, event_data, ip_address, user_agent, country, region, city)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).bind(
        userId,
        machineName,
        userName,
        normalizeText(payload.app_version, 64),
        normalizeText(payload.os_info, 128),
        normalizeEventType(payload.event_type),
        normalizeText(payload.event_data, 512),
        request.headers.get('CF-Connecting-IP') || null,
        request.headers.get('User-Agent') || null,
        location.country,
        location.region,
        location.city
      ).run();

      await pruneOldUserEvents(env, userId, 999);
    } catch (error) {
      console.error('Failed to save telemetry:', error);
    }
  },

  async getStats(env: Env, corsHeaders: Record<string, string>, userIdRaw?: string | null): Promise<Response> {
    try {
      await ensureSchema(env);
      const userId = normalizeText(userIdRaw, 128);
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

      return jsonResponse({
        total_records: totalResult?.total || 0,
        unique_machines: uniqueMachinesResult?.count || 0,
        unique_users: uniqueUsersResult?.count || 0,
        today_count: todayResult?.count || 0,
        javinfo_total: javInfoTotalResult?.total || 0,
        javinfo_today: javInfoTodayResult?.count || 0,
        filter: userId ? { user_id: userId } : null,
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
          director, maker, publisher, series, actors_json, categories_json,
          torrents_json, detail_url, search_count, created_at, updated_at
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, datetime('now'), datetime('now'))
        ON CONFLICT(jav_id) DO UPDATE SET
          payload_json = excluded.payload_json,
          title = excluded.title,
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

      return jsonResponse({ data: result.results ?? [] }, { headers: corsHeaders });
    } catch (error) {
      console.error('Failed to get users:', error);
      return jsonResponse({ data: [] }, { headers: corsHeaders });
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
          actors_json, categories_json, torrents_json, detail_url, search_count, created_at, updated_at
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
          search_count: record.search_count ?? 0,
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

  async getJavDbDomain(corsHeaders: Record<string, string>): Promise<Response> {
    try {
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

      return jsonResponse({
        success: true,
        domains: [latestDomain],
      }, { headers: corsHeaders });
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
