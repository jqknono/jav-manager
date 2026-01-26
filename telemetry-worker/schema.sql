-- Telemetry data schema for Cloudflare D1
DROP TABLE IF EXISTS telemetry;

CREATE TABLE telemetry (
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
CREATE INDEX idx_telemetry_created_at ON telemetry(created_at DESC);
CREATE INDEX idx_telemetry_machine_name ON telemetry(machine_name);
CREATE INDEX idx_telemetry_user_name ON telemetry(user_name);
