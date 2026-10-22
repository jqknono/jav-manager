// Worker 绑定与部署版本信息。

export interface Env {
  DB: D1Database;
  ADMIN_USERNAME?: string;
  ADMIN_PASSWORD?: string;
  // JavDB proxy storage
  JAVDB_KV: KVNamespace;
  JAVDB_R2: R2Bucket;
  // 请求 /api/javdb/* 时必须携带 X-Proxy-Key 并与该值一致
  JAVDB_PROXY_KEY?: string;
  // 可选：覆盖 doc/javdb-app-api/README.md 中的默认值
  JAVDB_APP_SECRET?: string;
  JAVDB_APP_SALT?: string;
  // Optional build identifier (set via wrangler vars or dashboard).
  // Suggested value: git SHA or YYYYMMDD-HHMM.
  WORKER_VERSION?: string;
  // Cloudflare version metadata binding (recommended).
  WORKER_VERSION_METADATA?: {
    id: string;
    tag: string;
    timestamp: string;
  };
}

function normalizeVersionLabel(raw: unknown): string | null {
  if (typeof raw !== 'string') return null;
  const value = raw.trim();
  if (!value) return null;
  const lower = value.toLowerCase();
  if (lower === 'dev' || lower === 'unknown') return null;
  return value;
}

function getWorkerVersion(env: Env): string | null {
  // Prefer Cloudflare's actual deployed version metadata.
  const metadata = env.WORKER_VERSION_METADATA;
  if (metadata && typeof metadata.id === 'string' && metadata.id.trim()) {
    const id = metadata.id.trim();
    const tag = normalizeVersionLabel(metadata.tag);
    if (tag) return `${tag} (${id.slice(0, 8)})`;
    return id.slice(0, 8);
  }

  // Fallback to manually configured version variable.
  return normalizeVersionLabel(env.WORKER_VERSION);
}

export { getWorkerVersion };
