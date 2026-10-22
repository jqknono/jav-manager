import type { Env } from '../env';

// 每个 isolate 复用同一个数据库初始化 Promise。

let schemaInit: Promise<void> | null = null;

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

    // JavDB App API / CDN proxy cache table
    await env.DB.prepare(`
      CREATE TABLE IF NOT EXISTS javdb_proxy_cache (
        cache_key TEXT PRIMARY KEY,
        upstream_url TEXT NOT NULL,
        upstream_host TEXT NOT NULL,
        path TEXT NOT NULL,
        query TEXT NOT NULL,
        method TEXT NOT NULL,
        status INTEGER NOT NULL,
        content_type TEXT,
        headers_json TEXT,
        body_text TEXT,
        r2_key TEXT,
        bytes INTEGER,
        body_sha256 TEXT,
        updated_at TEXT DEFAULT (datetime('now')),
        hit_count INTEGER NOT NULL DEFAULT 0,
        last_access_at TEXT
      );
    `).run();

    // Forward-only migrations for existing deployments.
    await ensureColumn('javdb_proxy_cache', 'headers_json', 'TEXT');
    await ensureColumn('javdb_proxy_cache', 'body_text', 'TEXT');
    await ensureColumn('javdb_proxy_cache', 'r2_key', 'TEXT');
    await ensureColumn('javdb_proxy_cache', 'bytes', 'INTEGER');
    await ensureColumn('javdb_proxy_cache', 'body_sha256', 'TEXT');
    await ensureColumn('javdb_proxy_cache', 'updated_at', `TEXT DEFAULT (datetime('now'))`);
    await ensureColumn('javdb_proxy_cache', 'hit_count', 'INTEGER NOT NULL DEFAULT 0');
    await ensureColumn('javdb_proxy_cache', 'last_access_at', 'TEXT');

    await env.DB.prepare(`CREATE INDEX IF NOT EXISTS idx_javdb_proxy_cache_updated_at ON javdb_proxy_cache(updated_at DESC);`).run();
    await env.DB.prepare(`CREATE INDEX IF NOT EXISTS idx_javdb_proxy_cache_upstream_host ON javdb_proxy_cache(upstream_host);`).run();
  })();

  return schemaInit;
}

export { ensureSchema };
