const DefaultBaseEndpoint = "https://jav-manager.techfetch.dev";

function getEnvBaseEndpointOrNull(): string | null {
  const direct = normalizeBaseEndpointOrNull(
    process.env.JAVMANAGER_BACKEND_ENDPOINT || process.env.JAVMANAGER_BACKEND_URL
  );
  if (direct) return direct;

  const modeRaw = String(process.env.JAVMANAGER_BACKEND_MODE ?? "").trim().toLowerCase();
  if (modeRaw === "local" || modeRaw === "dev" || modeRaw === "development") {
    const local = normalizeBaseEndpointOrNull(process.env.JAVMANAGER_BACKEND_LOCAL_ENDPOINT);
    return local || "http://127.0.0.1:8788";
  }

  return null;
}

export function getTelemetryPostUrl(endpoint?: string | null): string {
  return `${getBaseEndpoint(endpoint)}/api/telemetry`;
}

export function getJavInfoPostUrl(endpoint?: string | null): string {
  return `${getBaseEndpoint(endpoint)}/api/javinfo`;
}

export function getBaseEndpoint(endpoint?: string | null): string {
  const fromEnv = getEnvBaseEndpointOrNull();
  if (fromEnv) return fromEnv;

  const normalized = normalizeBaseEndpointOrNull(endpoint);
  return normalized || DefaultBaseEndpoint;
}

export function normalizeBaseEndpointOrNull(endpoint?: string | null): string | null {
  if (!endpoint || !String(endpoint).trim()) {
    return null;
  }

  const raw = String(endpoint).trim();
  let parsed: URL;
  try {
    parsed = new URL(raw);
  } catch {
    return raw.replace(/\/+$/, "");
  }

  let path = parsed.pathname.replace(/\/+$/, "");
  if (path.toLowerCase().endsWith("/api/telemetry")) {
    path = path.slice(0, -"/api/telemetry".length);
  } else if (path.toLowerCase().endsWith("/api/javinfo")) {
    path = path.slice(0, -"/api/javinfo".length);
  } else if (path.toLowerCase().endsWith("/api")) {
    path = path.slice(0, -"/api".length);
  }

  parsed.pathname = path.replace(/\/+$/, "") || "/";
  parsed.search = "";
  parsed.hash = "";

  return parsed.toString().replace(/\/+$/, "");
}
