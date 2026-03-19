-- User data schema for Cloudflare D1
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

-- Index for pagination queries
CREATE INDEX IF NOT EXISTS idx_user_created_at ON user(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_user_user_id ON user(user_id);
CREATE INDEX IF NOT EXISTS idx_user_user_id_created_at ON user(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_user_machine_name ON user(machine_name);
CREATE INDEX IF NOT EXISTS idx_user_user_name ON user(user_name);

-- JavInfo cache schema (non-torrent metadata only)
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
    search_count INTEGER NOT NULL DEFAULT 0,
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_javinfo_updated_at ON javinfo(updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_javinfo_release_date ON javinfo(release_date);

-- JavDB App API / CDN proxy cache (latest snapshot per cache_key)
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

CREATE INDEX IF NOT EXISTS idx_javdb_proxy_cache_updated_at ON javdb_proxy_cache(updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_javdb_proxy_cache_upstream_host ON javdb_proxy_cache(upstream_host);
