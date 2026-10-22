const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { webcrypto, createHash } = require('node:crypto');
const ts = require('typescript');

const sourceRoot = path.resolve(__dirname, '../apps/backend-worker/src');
const compiled = new Map();

// 每个用例使用独立模块缓存，模拟独立 isolate；fetch 只走本地 stub。
// 在内存中转译 Worker，复用现有 TypeScript 依赖，保持仓库构建配置不变。
function loadWorker(fetchStub = async () => { throw new Error('请为当前用例提供上游响应'); }) {
  const modules = new Map();
  const context = vm.createContext({
    Request, Response, Headers, URL, URLSearchParams, TextEncoder, Uint8Array,
    AbortSignal, crypto: webcrypto, btoa, atob, console, fetch: fetchStub,
  });
  function load(file) {
    if (file.endsWith('.json')) return JSON.parse(fs.readFileSync(file, 'utf8'));
    if (modules.has(file)) return modules.get(file).exports;
    if (!compiled.has(file)) {
      const source = fs.readFileSync(file, 'utf8');
      compiled.set(file, ts.transpileModule(source, {
        compilerOptions: { target: ts.ScriptTarget.ES2021, module: ts.ModuleKind.CommonJS, esModuleInterop: true },
        fileName: file,
      }).outputText);
    }
    const module = { exports: {} };
    modules.set(file, module);
    const run = vm.runInContext(`(function(require, module, exports) {${compiled.get(file)}\n})`, context, { filename: file });
    run(specifier => load(path.resolve(path.dirname(file), specifier.endsWith('.json') ? specifier : `${specifier}.ts`)), module, module.exports);
    return module.exports;
  }
  return load(path.join(sourceRoot, 'index.ts')).default;
}

// 仅模拟本次契约所需的 D1 接口，保留 SQL 与绑定参数以检查可观察存储结果。
function createEnv({ first = () => null, all = () => [], run = () => ({ meta: { changes: 1, last_row_id: 1 } }) } = {}) {
  const calls = [];
  const kv = new Map();
  const columns = ['user_id', 'region', 'title_zh', 'torrents_json', 'search_count', 'headers_json', 'body_text', 'r2_key', 'bytes', 'body_sha256', 'updated_at', 'hit_count', 'last_access_at'];
  const env = {
    ADMIN_USERNAME: 'admin', ADMIN_PASSWORD: 'password', JAVDB_PROXY_KEY: 'proxy-key',
    DB: {
      prepare(sql) {
        let args = [];
        return {
          bind(...values) { args = values; return this; },
          async first() {
            calls.push({ sql, args, kind: 'first' });
            return sql.includes('sqlite_master') ? { name: args[0] } : first(sql, args);
          },
          async all() {
            calls.push({ sql, args, kind: 'all' });
            return { results: sql.startsWith('PRAGMA') ? columns.map(name => ({ name })) : all(sql, args) };
          },
          async run() {
            calls.push({ sql, args, kind: 'run' });
            return run(sql, args);
          },
        };
      },
    },
    JAVDB_KV: {
      async get(key) { return kv.get(key) ?? null; },
      async put(key, value) { kv.set(key, JSON.parse(value)); },
    },
    JAVDB_R2: { async get() { return null; }, async put() {} },
  };
  return { env, calls, kv };
}

const adminCookie = `jm_admin_session=${encodeURIComponent(btoa('admin:password'))}`;
const proxyHeaders = { 'X-Proxy-Key': 'proxy-key' };
async function send(worker, env, pathname, init = {}) {
  const pending = [];
  const request = new Request(`https://worker.example${pathname}`, init);
  const response = await worker.fetch(request, env, { waitUntil(promise) { pending.push(promise); } });
  await Promise.all(pending);
  return response;
}

// 页面路由同时验证语言会话、管理员登录/退出以及 favicon 的 HEAD 契约。
test('Worker 页面、语言 Cookie、版本与管理员会话保持现有响应', async () => {
  const worker = loadWorker();
  const { env } = createEnv();
  env.WORKER_VERSION_METADATA = { id: '12345678-abcd', tag: 'release', timestamp: '2026-10-23' };
  for (const route of ['/', '/jav', '/admin']) {
    const response = await send(worker, env, `${route}?lang=zh`);
    assert.equal(response.status, 200);
    assert.equal(response.headers.get('cache-control'), 'private, no-store, max-age=0');
    assert.match(response.headers.get('set-cookie'), /jm_lang=zh; Path=\/; SameSite=Lax; Secure/);
    assert.match(await response.text(), /<html/);
  }
  const redirect = await send(worker, env, '/user');
  assert.equal(redirect.status, 302);
  assert.equal(redirect.headers.get('location'), 'https://worker.example/admin?lang=en');
  const login = await send(worker, env, '/admin/login?lang=zh', {
    method: 'POST', body: new URLSearchParams({ username: 'admin', password: 'password' }),
  });
  assert.equal(login.status, 302);
  assert.equal(login.headers.get('location'), 'https://worker.example/admin?lang=zh');
  assert.match(login.headers.get('set-cookie'), /HttpOnly; Secure; SameSite=Strict; Max-Age=43200/);
  assert.ok(login.headers.get('set-cookie').includes(adminCookie));
  assert.equal((await send(worker, env, '/user', { headers: { Cookie: adminCookie } })).status, 200);
  const logout = await send(worker, env, '/admin/logout', { method: 'POST' });
  assert.equal(logout.status, 302);
  assert.match(logout.headers.get('set-cookie'), /jm_admin_session=;.*Max-Age=0/);
  const version = await send(worker, env, '/api/version');
  assert.deepEqual(await version.json(), { version: 'release (12345678)' });
  const icon = await send(worker, env, '/favicon.ico', { method: 'HEAD' });
  assert.equal(icon.headers.get('cache-control'), 'public, max-age=31536000, immutable');
  assert.equal(await icon.text(), '');
});

// 认证、方法限制和代理命名空间保持既有接口契约。
test('Worker 预检、代理认证与状态契约保持不变', async () => {
  const worker = loadWorker();
  const { env, kv } = createEnv();
  for (const [route, methods] of [['/api/telemetry', 'GET, POST, HEAD, OPTIONS'], ['/api/javdb/app/api/v1/movies', 'GET, HEAD, OPTIONS']]) {
    const response = await send(worker, env, route, { method: 'OPTIONS' });
    assert.equal(response.status, 200);
    assert.equal(response.headers.get('access-control-allow-methods'), methods);
  }
  const contracts = [
    [env, '/api/javdb/recent/search', {}, 401, 'Unauthorized'],
    [{ ...env, JAVDB_PROXY_KEY: '' }, '/api/javdb/recent/search', {}, 503, 'Proxy not configured'],
    [env, '/api/javdb/recent/search', { method: 'POST', headers: proxyHeaders }, 405, 'Method Not Allowed'],
    [env, '/api/javdb/app/api/v1/users', { headers: proxyHeaders }, 403, 'Forbidden'],
    [env, '/api/javdb/app/other', { headers: proxyHeaders }, 400, 'Invalid upstream path'],
    [env, '/api/user', {}, 401, 'Unauthorized'],
    [env, '/api/javinfo/delete', { method: 'POST' }, 401, 'Unauthorized'],
  ];
  for (const [bindings, route, init, status, error] of contracts) {
    const response = await send(worker, bindings, route, init);
    assert.equal(response.status, status, route);
    assert.deepEqual(await response.json(), { error });
  }
  for (const kind of ['search', 'sort']) {
    kv.set(`javdb:recent:${kind}`, [{ url: kind }]);
    const response = await send(worker, env, `/api/javdb/recent/${kind}`, { headers: { Cookie: adminCookie } });
    assert.deepEqual(await response.json(), { data: [{ url: kind }] });
  }
});

// 域名查询为独立公共接口；固定 HTML 验证处理器可达、响应结构及一小时缓存。
test('域名查询独立于代理认证，返回最新域名并复用缓存', async () => {
  const upstreamCalls = [];
  const worker = loadWorker(async (url) => {
    upstreamCalls.push(url);
    return new Response('最新域名: <a href="https://javdb.example">javdb.example</a>');
  });
  const { env } = createEnv();
  // 两种代理配置均支持公共查询，调用者按域名查询契约直接 GET。
  for (const proxyKey of ['', 'proxy-key']) {
    const response = await send(worker, { ...env, JAVDB_PROXY_KEY: proxyKey }, '/api/javdb-domain?lang=en');
    assert.equal(response.status, 200);
    assert.deepEqual(await response.json(), { success: true, domains: ['javdb.example'] });
    assert.equal(response.headers.get('cache-control'), 'private, max-age=3600');
    assert.equal(response.headers.get('access-control-allow-origin'), '*');
    assert.match(response.headers.get('set-cookie'), /jm_lang=en/);
  }
  assert.deepEqual(upstreamCalls, ['https://javdb.com/']);

  // GET 和 OPTIONS 使用同一命名空间判断，查询接口采用通用 CORS。
  const preflight = await send(worker, env, '/api/javdb-domain', { method: 'OPTIONS' });
  assert.equal(preflight.status, 200);
  assert.equal(preflight.headers.get('access-control-allow-methods'), 'GET, POST, HEAD, OPTIONS');
});

// 两次相同事件仍各自确认接收；后台写入按原来的用户标识和重复事件窗口去重。
test('遥测通过 waitUntil 写入并复用原有去重门控', async () => {
  const worker = loadWorker();
  const { env, calls } = createEnv();
  for (let i = 0; i < 2; i++) {
    const response = await send(worker, env, '/api/telemetry', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ machine_name: ' Workstation ', user_name: ' Alice ', event_type: 'Search Complete', event_data: 'ABC-001' }),
    });
    assert.deepEqual(await response.json(), { success: true });
  }
  const writes = calls.filter(call => call.sql.includes('INSERT INTO user'));
  assert.equal(writes.length, 1);
  assert.equal(writes[0].args[0], createHash('sha256').update('workstation|alice|||').digest('hex').slice(0, 32));
  assert.deepEqual(writes[0].args.slice(1, 7), ['Workstation', 'Alice', null, null, 'search_complete', 'ABC-001']);
});

// 用户列表/兼容别名和统计共用原有数据库、15 秒缓存及管理员权限。
test('用户分页别名、列表与统计保留 payload 和缓存命中', async () => {
  const worker = loadWorker();
  const row = { id: 7, user_id: 'u1', machine_name: 'PC', user_name: 'Alice' };
  const { env, calls } = createEnv({
    first: () => ({ total: 1, count: 1 }),
    all: sql => sql.includes('WHERE user_id IS NULL') ? [] : [row],
  });
  for (const route of ['/api/user', '/api/data']) {
    const response = await send(worker, env, `${route}?page=1&pageSize=10&userId=u1`, { headers: { Cookie: adminCookie } });
    assert.deepEqual(await response.json(), {
      data: [row], pagination: { page: 1, pageSize: 10, total: 1, totalPages: 1 }, filter: { user_id: 'u1' },
    });
  }
  for (const route of ['/api/users', '/api/stats?userId=u1']) {
    const response = await send(worker, env, route, { headers: { Cookie: adminCookie } });
    const expected = route === '/api/users' ? { data: [row] } : {
      total_records: 1, unique_machines: 1, unique_users: 1, today_count: 1,
      javinfo_total: 1, javinfo_today: 1, filter: { user_id: 'u1' },
    };
    assert.deepEqual(await response.json(), expected);
    const count = calls.length;
    const cached = await send(worker, env, route, { headers: { Cookie: adminCookie } });
    assert.deepEqual(await cached.json(), expected);
    assert.equal(cached.headers.get('cache-control'), 'private, max-age=15');
    assert.equal(calls.length, count);
  }
});

// 用同一条记录验证公开/管理员投影、筛选绑定、写入字段兼容和删除响应。
test('JavInfo 读写、管理员投影与筛选缓存保持现有契约', async () => {
  const worker = loadWorker();
  const torrent = { title: 'HD', magnet_link: 'magnet:?xt=urn:btih:test', size: 100, has_hd: true };
  const record = { jav_id: 'ABC-001', title: 'Example', actors_json: '["Actor"]', categories_json: '["Category"]', torrents_json: JSON.stringify([torrent]), detail_url: 'https://example.test/detail', search_count: 3 };
  const { env, calls } = createEnv({ first: () => ({ total: 1 }), all: () => [record] });
  for (const admin of [false, true]) {
    const response = await send(worker, env, '/api/javinfo?category=Category&actor=Actor', { headers: admin ? { Cookie: adminCookie } : {} });
    const body = await response.json();
    assert.deepEqual(body.filter, { category: 'Category', actor: 'Actor' });
    assert.deepEqual(body.pagination, { page: 1, pageSize: 20, total: 1, totalPages: 1 });
    assert.deepEqual(body.data[0].torrents, admin ? [torrent] : []);
    assert.equal(body.data[0].detail_url, admin ? record.detail_url : null);
    assert.deepEqual(body.data[0].best_torrent, { title: 'HD', magnet_link: torrent.magnet_link, size: 100, score: 1 });
  }
  assert.ok(calls.some(call => JSON.stringify(call.args) === JSON.stringify(['%"Category"%', '%"Actor"%', 20, 0])));
  for (const [route, data] of [['categories', ['Category']], ['actors', ['Actor']]]) {
    const response = await send(worker, env, `/api/javinfo/${route}`);
    assert.deepEqual(await response.json(), { data });
    const count = calls.length;
    const cached = await send(worker, env, `/api/javinfo/${route}`);
    assert.deepEqual(await cached.json(), { data });
    assert.equal(cached.headers.get('cache-control'), 'private, max-age=300');
    assert.equal(calls.length, count);
  }
  const stored = await send(worker, env, '/api/javinfo', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ javId: 'ABC-001', titleZh: '示例', coverUrl: 'https://example.test/cover', torrents: [torrent] }),
  });
  assert.deepEqual(await stored.json(), { jav_id: 'ABC-001', inserted: true, existed: false });
  const payload = JSON.parse(calls.find(call => call.sql.includes('INSERT INTO javinfo')).args[1]);
  assert.equal(payload.title_zh, '示例');
  assert.deepEqual(payload.torrents, [torrent]);
  const deleted = await send(worker, env, '/api/javinfo/delete', {
    method: 'POST', headers: { Cookie: adminCookie }, body: new URLSearchParams({ javId: 'ABC-001' }),
  });
  assert.deepEqual(await deleted.json(), { jav_id: 'ABC-001', deleted: true });
});

// 缓存未命中时验证签名和 URL 重写；再次访问复用 D1 文本缓存与相同语言的缓存键。
test('JavDB App 代理签名、文本缓存、HEAD 与最近搜索保持一致', async () => {
  const requests = [];
  const worker = loadWorker(async (url, init) => {
    requests.push({ url, init });
    return new Response(JSON.stringify({ movies: [{ id: 1, number: 'ABC-001', title: 'Example', cover: 'https://tp.cmastd.com/cover.jpg' }] }), { headers: { 'Content-Type': 'application/json', ETag: 'v1' } });
  });
  let cached = null;
  const { env, kv } = createEnv({
    first: sql => sql.includes('FROM javdb_proxy_cache') ? cached : null,
    run: (sql, args) => {
      if (sql.includes('INSERT INTO javdb_proxy_cache')) {
        cached = { cache_key: args[0], status: args[6], content_type: args[7], headers_json: args[8], body_text: args[9] };
      }
      return { meta: { changes: 1 } };
    },
  });
  env.JAVDB_APP_SECRET = 'secret'; env.JAVDB_APP_SALT = 'salt';
  const headers = { ...proxyHeaders, 'Accept-Language': 'zh', 'If-None-Match': 'old' };
  const route = '/api/javdb/app/api/v2/search?q=ABC-001&type=movie';
  const response = await send(worker, env, route, { headers });
  const body = await response.json();
  assert.equal(body.movies[0].cover, 'https://worker.example/api/javdb/img/cover.jpg');
  assert.equal(response.headers.get('cache-control'), 'private, max-age=60');
  const signature = requests[0].init.headers.get('jdsignature');
  const [timestamp, salt, digest] = signature.split('.');
  assert.equal(salt, 'salt');
  assert.equal(digest, createHash('md5').update(`${timestamp}secret`).digest('hex'));
  assert.equal(requests[0].init.headers.get('If-None-Match'), 'old');
  assert.equal(requests[0].init.headers.get('Accept-Language'), 'zh');
  assert.equal(cached.cache_key, createHash('sha256').update('https://apidd.spthgb.com/api/v2/search?q=ABC-001&type=movie|al=zh').digest('hex'));
  const replay = await send(worker, env, route, { headers });
  assert.deepEqual(await replay.json(), body);
  assert.equal(replay.headers.get('cache-control'), 'private, max-age=300');
  assert.equal(replay.headers.get('etag'), 'v1');
  const head = await send(worker, env, route, { method: 'HEAD', headers });
  assert.equal(head.status, 200);
  assert.equal(await head.text(), '');
  assert.equal(requests.length, 1);
  assert.equal(kv.get('javdb:recent:search')[0].q, 'ABC-001');
});

// R2 返回已缓存的局部字节；验证客户端可观察到的范围头与 HEAD 响应。
test('图片代理复用 R2 并保持 Range 和 HEAD 语义', async () => {
  const worker = loadWorker();
  const { env } = createEnv({ first: () => ({ r2_key: 'image', content_type: 'image/jpeg' }) });
  const ranges = [];
  env.JAVDB_R2.get = async (key, options) => {
    assert.equal(key, 'image');
    ranges.push(options.range);
    return { body: new Uint8Array([1, 2, 3]), size: 10, range: { offset: 2, length: 3 } };
  };
  for (const method of ['GET', 'HEAD']) {
    const response = await send(worker, env, '/api/javdb/img/cover.jpg', { method, headers: { ...proxyHeaders, Range: 'bytes=2-4' } });
    assert.equal(response.status, 206);
    assert.equal(response.headers.get('content-range'), 'bytes 2-4/10');
    assert.equal(response.headers.get('content-length'), '3');
    assert.equal((await response.arrayBuffer()).byteLength, method === 'GET' ? 3 : 0);
  }
  assert.equal(JSON.stringify(ranges), JSON.stringify([{ offset: 2, length: 3 }, { offset: 2, length: 3 }]));
});

// 播放列表保存重写后的文本，分片继续按原路径透传；所有上游响应来自内存 stub。
test('预览代理重写 m3u8 和密钥 URL，并透传视频分片', async () => {
  const urls = [];
  const worker = loadWorker(async url => {
    urls.push(url);
    return url.endsWith('.m3u8')
      ? new Response('#EXTM3U\n#EXT-X-KEY:METHOD=AES-128,URI="key.bin"\nsegment.ts\n/root.ts', { headers: { 'Content-Type': 'application/vnd.apple.mpegurl' } })
      : new Response(new Uint8Array([4, 5]), { headers: { 'Content-Type': 'video/mp2t' } });
  });
  const { env, calls } = createEnv();
  const playlist = await send(worker, env, '/api/javdb/preview/movie/list.m3u8', { headers: proxyHeaders });
  assert.equal(await playlist.text(), '#EXTM3U\n#EXT-X-KEY:METHOD=AES-128,URI="https://worker.example/api/javdb/preview/movie/key.bin"\nhttps://worker.example/api/javdb/preview/movie/segment.ts\nhttps://worker.example/api/javdb/preview/root.ts');
  const segment = await send(worker, env, '/api/javdb/preview/movie/segment.ts', { headers: proxyHeaders });
  assert.deepEqual([...new Uint8Array(await segment.arrayBuffer())], [4, 5]);
  assert.equal(segment.headers.get('cache-control'), 'private, max-age=60');
  assert.equal(calls.filter(call => call.sql.includes('INSERT INTO javdb_proxy_cache')).length, 1);
  assert.deepEqual(urls, ['https://jdforrepam.com/movie/list.m3u8', 'https://jdforrepam.com/movie/segment.ts']);
});
