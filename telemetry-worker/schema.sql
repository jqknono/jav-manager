-- User data schema for Cloudflare D1
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

-- Index for pagination queries
CREATE INDEX IF NOT EXISTS idx_user_created_at ON user(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_user_machine_name ON user(machine_name);
CREATE INDEX IF NOT EXISTS idx_user_user_name ON user(user_name);

-- JavInfo cache schema (non-torrent metadata only)
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

CREATE INDEX IF NOT EXISTS idx_javinfo_updated_at ON javinfo(updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_javinfo_release_date ON javinfo(release_date);
