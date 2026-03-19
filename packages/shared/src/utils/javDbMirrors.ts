import { getBaseEndpoint } from "./backendEndpoints";

export type JavDbDomainApiResponse = {
  success?: boolean;
  domains?: string[];
  error?: string;
  message?: string;
};

export function normalizeDomainOrUrlToHttpsUrl(input: string): string | null {
  const raw = (input ?? "").trim();
  if (!raw) return null;

  if (/^https?:\/\//i.test(raw)) {
    return raw.replace(/\/+$/, "");
  }

  // Treat as domain.
  const domain = raw.replace(/^\/*/, "").replace(/\/+$/, "");
  if (!domain) return null;
  return `https://${domain}`;
}

export function mergeMirrorUrls(existing: string[], domainsOrUrls: string[]): string[] {
  const normalizedNew = domainsOrUrls
    .map((d) => normalizeDomainOrUrlToHttpsUrl(d))
    .filter((d): d is string => !!d);

  const normalizedExisting = (existing ?? [])
    .map((u) => normalizeDomainOrUrlToHttpsUrl(u))
    .filter((u): u is string => !!u);

  const seen = new Set<string>();
  const out: string[] = [];
  for (const u of normalizedNew) {
    const key = u.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(u);
  }
  for (const u of normalizedExisting) {
    const key = u.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(u);
  }
  return out;
}

export async function fetchLatestJavDbDomains(
  telemetryEndpoint: string,
  fetchImpl: typeof fetch = fetch
): Promise<{ apiUrl: string; domains: string[] }> {
  const base = getBaseEndpoint(telemetryEndpoint);
  const apiUrl = `${base}/api/javdb-domain`;

  const resp = await fetchImpl(apiUrl, {
    headers: {
      "User-Agent": "jav-manager",
      Accept: "application/json",
    },
    signal: typeof AbortSignal !== "undefined" && "timeout" in AbortSignal
      ? (AbortSignal as unknown as { timeout(ms: number): AbortSignal }).timeout(10000)
      : undefined,
  });

  if (!resp.ok) {
    throw new Error(`HTTP ${resp.status}`);
  }

  const json = (await resp.json()) as JavDbDomainApiResponse;
  if (!json || json.success !== true) {
    const msg = (json && (json.message || json.error)) ? String(json.message || json.error) : "Unknown error";
    throw new Error(msg);
  }

  const domains = Array.isArray(json.domains) ? json.domains.map(String) : [];
  if (domains.length === 0) {
    throw new Error("Empty domains");
  }

  return { apiUrl, domains };
}

