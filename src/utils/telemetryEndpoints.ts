const DefaultBaseEndpoint = "https://jav-manager.techfetch.dev";

export function getTelemetryPostUrl(endpoint?: string | null): string {
  return `${getBaseEndpoint(endpoint)}/api/telemetry`;
}

export function getJavInfoPostUrl(endpoint?: string | null): string {
  return `${getBaseEndpoint(endpoint)}/api/javinfo`;
}

export function getBaseEndpoint(endpoint?: string | null): string {
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
