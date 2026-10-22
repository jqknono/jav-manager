import crypto from "node:crypto";
import { JavDbConfig } from "../config";
import { IJavDbDataProvider, IHealthChecker } from "@jav-manager/domain";
import { JavSearchResult, TorrentInfo, UncensoredMarkerType } from "@jav-manager/domain";
import { normalizeJavId, parseTorrentName, isValidJavId } from "@jav-manager/shared-utils";
import { splitTitleVariants } from "@jav-manager/shared-utils";

const DefaultAppApiBaseUrl = "https://apidd.spthgb.com";
const FallbackAppApiBaseUrl = "https://apidd.czssdgz.com";
const DefaultUserAgent = "JavDB-App/1.0";
const DefaultAppSecret =
  "71cf27bb3c0bcdf207b64abecddc970098c7421ee7203b9cdae54478478a199e7d5a6e1a57691123c1a931c057842fb73ba3b3c83bcd69c17ccf174081e3d8aa";
const DefaultAppSalt = "lpw6vgqzsp";

type FetchLike = typeof fetch;

type AppApiEnvelope<T> = {
  success?: number;
  action?: string | null;
  message?: string | null;
  data?: T;
};

type SearchMovie = {
  id?: string;
  number?: string;
  title?: string;
  origin_title?: string;
  thumb_url?: string;
  cover_url?: string;
  duration?: number;
  release_date?: string;
};

type SearchResponse = {
  movies?: SearchMovie[];
};

type DetailMovie = {
  id?: string;
  number?: string;
  title?: string;
  origin_title?: string;
  thumb_url?: string;
  cover_url?: string;
  duration?: number;
  release_date?: string;
  director_name?: string | null;
  maker_name?: string | null;
  publisher_name?: string | null;
  series_name?: string | null;
  tags?: Array<{ name?: string | null }>;
  actors?: Array<{ name?: string | null }>;
};

type DetailResponse = {
  movie?: DetailMovie;
};

type MagnetRecord = {
  name?: string;
  hash?: string;
  size?: number;
  cnsub?: boolean;
  hd?: boolean;
};

type MagnetsResponse = {
  magnets?: MagnetRecord[];
};

export class JavDbApiClient implements IJavDbDataProvider, IHealthChecker {
  private config: JavDbConfig;
  private fetchImpl: FetchLike;

  constructor(config: JavDbConfig, fetchImpl: FetchLike = fetch) {
    this.config = config;
    this.fetchImpl = fetchImpl;
  }

  get serviceName(): string {
    return "JavDB App API";
  }

  async search(javId: string): Promise<JavSearchResult> {
    const candidates = await this.searchCandidates(javId);
    if (candidates.length === 0) {
      return emptySearchResult(javId);
    }
    const selected = chooseBestCandidate(candidates, javId);
    const detail = await this.getDetail(selected.detailUrl);
    if (!detail.javId) {
      detail.javId = javId;
    }
    return detail;
  }

  async searchCandidates(javId: string): Promise<JavSearchResult[]> {
    const normalizedJavId = normalizeJavId(javId);
    const path = `/api/v2/search?q=${encodeURIComponent(normalizedJavId)}&type=movie`;
    let lastError = "";

    for (const baseUrl of buildApiBaseUrls(this.config)) {
      try {
        const payload = await this.requestJson<SearchResponse>(baseUrl, path);
        const results = (payload.data?.movies ?? [])
          .map((movie) => toSearchCandidate(movie, baseUrl))
          .filter((item) => !!item.detailUrl);
        return dedupeResults(results);
      } catch (error) {
        lastError = error instanceof Error ? error.message : String(error);
      }
    }

    throw new Error(`JavDB App API request failed: ${lastError || "No available endpoint"}`);
  }

  async getDetail(detailUrl: string): Promise<JavSearchResult> {
    const target = parseMovieReference(detailUrl, this.config);
    let lastError = "";

    for (const baseUrl of buildDetailBaseUrls(this.config, target.baseUrl)) {
      try {
        const [detailPayload, magnetsPayload] = await Promise.all([
          this.requestJson<DetailResponse>(baseUrl, `/api/v4/movies/${encodeURIComponent(target.movieId)}`),
          this.requestJson<MagnetsResponse>(baseUrl, `/api/v1/movies/${encodeURIComponent(target.movieId)}/magnets`).catch(() => null),
        ]);

        const movie = detailPayload.data?.movie;
        if (!movie?.id) {
          throw new Error("Movie detail payload is empty");
        }

        const result = toDetailResult(movie, baseUrl);
        result.detailUrl = buildMovieDetailUrl(baseUrl, movie.id);
        result.torrents = dedupeTorrents((magnetsPayload?.data?.magnets ?? []).map(toTorrentInfo));
        return result;
      } catch (error) {
        lastError = error instanceof Error ? error.message : String(error);
      }
    }

    throw new Error(`JavDB App API detail request failed: ${lastError || "No available endpoint"}`);
  }

  async checkHealth(): Promise<{ serviceName: string; isHealthy: boolean; message: string; url?: string }> {
    let lastError = "";

    for (const baseUrl of buildApiBaseUrls(this.config)) {
      try {
        await this.requestJson<SearchResponse>(baseUrl, "/api/v1/movies/latest", 5000);
        return { serviceName: this.serviceName, isHealthy: true, message: "OK", url: baseUrl };
      } catch (error) {
        lastError = error instanceof Error ? error.message : String(error);
      }
    }

    return {
      serviceName: this.serviceName,
      isHealthy: false,
      message: lastError || "JavDB App API unreachable",
      url: normalizeApiBaseUrl(this.config.baseUrl) ?? DefaultAppApiBaseUrl,
    };
  }

  private async requestJson<T>(baseUrl: string, path: string, timeoutMs?: number): Promise<AppApiEnvelope<T>> {
    const url = new URL(buildApiPath(baseUrl, path), `${baseUrl}/`).toString();
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), Math.max(1, timeoutMs ?? this.config.requestTimeout));

    try {
      const res = await this.fetchImpl(url, {
        method: "GET",
        headers: {
          Accept: "application/json",
          "User-Agent": normalizeUserAgent(this.config.userAgent),
          jdsignature: generateJdSignature(),
        },
        signal: controller.signal,
      });

      const text = await res.text();
      if (!res.ok) {
        throw new Error(`HTTP ${res.status}${text ? `: ${truncateText(text, 160)}` : ""}`);
      }

      const payload = JSON.parse(text) as AppApiEnvelope<T>;
      if (payload.success !== 1) {
        throw new Error(payload.message || payload.action || "Unknown API error");
      }
      return payload;
    } catch (error) {
      if (error instanceof Error && error.name === "AbortError") {
        throw new Error(`Request timeout after ${timeoutMs ?? this.config.requestTimeout}ms`);
      }
      throw error;
    } finally {
      clearTimeout(timer);
    }
  }
}

function normalizeUserAgent(value: string): string {
  const trimmed = String(value ?? "").trim();
  return trimmed || DefaultUserAgent;
}

function truncateText(value: string, maxLen: number): string {
  const normalized = value.replace(/\s+/g, " ").trim();
  return normalized.length > maxLen ? `${normalized.slice(0, maxLen)}...` : normalized;
}

function buildApiBaseUrls(config: JavDbConfig): string[] {
  const candidates = [
    normalizeApiBaseUrl(config.baseUrl),
    ...config.mirrorUrls.map((item) => normalizeApiBaseUrl(item)),
    DefaultAppApiBaseUrl,
    FallbackAppApiBaseUrl,
  ].filter((item): item is string => !!item);

  return Array.from(new Set(candidates));
}

function isDirectAppApiBase(baseUrl: string): boolean {
  try {
    const { host } = new URL(baseUrl);
    return (
      host === "apidd.spthgb.com"
      || host === "apidd.czssdgz.com"
      || host === "apidd.btyjscl.com"
      || host === "api.btyjscl.com"
    );
  } catch {
    return false;
  }
}

function buildApiPath(baseUrl: string, path: string): string {
  return isDirectAppApiBase(baseUrl) ? path : `/api/javdb/app${path}`;
}

function buildDetailBaseUrls(config: JavDbConfig, preferredBaseUrl: string | null): string[] {
  const bases = [
    normalizeApiBaseUrl(preferredBaseUrl ?? ""),
    ...buildApiBaseUrls(config),
  ].filter((item): item is string => !!item);

  return Array.from(new Set(bases));
}

function normalizeApiBaseUrl(value: string): string | null {
  const trimmed = String(value ?? "").trim();
  if (!trimmed) {
    return null;
  }

  try {
    const url = new URL(trimmed);
    if (isLegacyJavDbWebHost(url.host)) {
      return null;
    }
    url.pathname = url.pathname.replace(/\/api\/?$/i, "/").replace(/\/+$/, "");
    url.search = "";
    url.hash = "";
    return url.toString().replace(/\/+$/, "");
  } catch {
    return null;
  }
}

function isLegacyJavDbWebHost(host: string): boolean {
  return /(^|\.)(javdb\d*\.com)$/i.test(host);
}

function generateJdSignature(): string {
  const ts = Math.floor(Date.now() / 1000);
  const hash = crypto.createHash("md5").update(`${ts}${DefaultAppSecret}`).digest("hex");
  return `${ts}.${DefaultAppSalt}.${hash}`;
}

function parseMovieReference(detailUrl: string, config: JavDbConfig): { movieId: string; baseUrl: string | null } {
  const raw = String(detailUrl ?? "").trim();
  if (!raw) {
    throw new Error("Detail URL is empty");
  }

  const legacyMatch = raw.match(/\/v\/([A-Za-z0-9]+)/i);
  if (legacyMatch?.[1]) {
    return { movieId: legacyMatch[1], baseUrl: normalizeApiBaseUrl(config.baseUrl) };
  }

  try {
    const url = new URL(raw);
    const apiMatch = url.pathname.match(/\/api\/v4\/movies\/([A-Za-z0-9]+)/i);
    if (apiMatch?.[1]) {
      return {
        movieId: apiMatch[1],
        baseUrl: normalizeApiBaseUrl(`${url.protocol}//${url.host}`),
      };
    }
  } catch {
    // ignore
  }

  return {
    movieId: raw,
    baseUrl: normalizeApiBaseUrl(config.baseUrl),
  };
}

function buildMovieDetailUrl(baseUrl: string, movieId: string): string {
  return new URL(buildApiPath(baseUrl, `/api/v4/movies/${encodeURIComponent(movieId)}`), `${baseUrl}/`).toString();
}

function toSearchCandidate(movie: SearchMovie, baseUrl: string): JavSearchResult {
  const titles = resolveMovieTitles(movie.title, movie.origin_title);
  const javId = normalizeJavId(movie.number ?? "");

  return {
    javId,
    title: titles.title,
    titleZh: titles.titleZh,
    coverUrl: normalizeText(movie.cover_url) ?? normalizeText(movie.thumb_url) ?? "",
    releaseDate: normalizeText(movie.release_date) ?? undefined,
    duration: numberOrZero(movie.duration),
    director: "",
    maker: "",
    publisher: "",
    series: "",
    actors: [],
    categories: [],
    torrents: [],
    detailUrl: movie.id ? buildMovieDetailUrl(baseUrl, movie.id) : "",
    dataSource: "Remote",
    cachedAt: undefined,
  };
}

function toDetailResult(movie: DetailMovie, baseUrl: string): JavSearchResult {
  const titles = resolveMovieTitles(movie.title, movie.origin_title);

  return {
    javId: normalizeJavId(movie.number ?? ""),
    title: titles.title,
    titleZh: titles.titleZh,
    coverUrl: normalizeText(movie.cover_url) ?? normalizeText(movie.thumb_url) ?? "",
    releaseDate: normalizeText(movie.release_date) ?? undefined,
    duration: numberOrZero(movie.duration),
    director: normalizeText(movie.director_name) ?? "",
    maker: normalizeText(movie.maker_name) ?? "",
    publisher: normalizeText(movie.publisher_name) ?? "",
    series: normalizeText(movie.series_name) ?? "",
    actors: dedupeStrings((movie.actors ?? []).map((item) => item?.name ?? "")),
    categories: dedupeStrings((movie.tags ?? []).map((item) => item?.name ?? "")),
    torrents: [],
    detailUrl: movie.id ? buildMovieDetailUrl(baseUrl, movie.id) : "",
    dataSource: "Remote",
    cachedAt: undefined,
  };
}

function resolveMovieTitles(title?: string, originTitle?: string): { title: string; titleZh?: string } {
  const normalizedTitle = normalizeText(title);
  const normalizedOriginTitle = normalizeText(originTitle);

  if (normalizedOriginTitle && normalizedTitle && normalizedOriginTitle !== normalizedTitle) {
    return {
      title: normalizedOriginTitle,
      titleZh: normalizedTitle,
    };
  }

  const fallback = normalizedOriginTitle ?? normalizedTitle ?? "";
  const split = splitTitleVariants(fallback);
  return {
    title: normalizeText(split.title) ?? "",
    titleZh: normalizeText(split.titleZh) ?? undefined,
  };
}

function toTorrentInfo(item: MagnetRecord): TorrentInfo {
  const title = normalizeText(item.name) ?? "";
  const hash = normalizeText(item.hash)?.toLowerCase() ?? "";
  const hasUncensored = /无码|無碼|破解|uncensored/i.test(title) || parseTorrentName(title).uncensoredType !== UncensoredMarkerType.None;
  const hasSubtitle = Boolean(item.cnsub) || /字幕|中字|sub/i.test(title);
  const hasHd = Boolean(item.hd) || /(?:^|[^a-z])(?:hd|4k|1080|720)(?:[^a-z]|$)/i.test(title);
  const uncensoredMarkerType = hasUncensored
    ? hasSubtitle
      ? UncensoredMarkerType.UC
      : UncensoredMarkerType.U
    : UncensoredMarkerType.None;

  return {
    title,
    magnetLink: hash ? `magnet:?xt=urn:btih:${hash}` : "",
    size: normalizeMagnetSize(item.size),
    hasUncensoredMarker: hasUncensored,
    uncensoredMarkerType,
    hasSubtitle,
    hasHd,
    seeders: 0,
    leechers: 0,
    sourceSite: "JavDB",
    dlSpeed: 0,
    eta: 0,
    weightScore: 0,
  };
}

function normalizeMagnetSize(value: number | undefined): number {
  if (typeof value !== "number" || !Number.isFinite(value) || value <= 0) {
    return 0;
  }
  return Math.floor(value * 1024 * 1024);
}

function dedupeTorrents(torrents: TorrentInfo[]): TorrentInfo[] {
  const seen = new Set<string>();
  const result: TorrentInfo[] = [];

  for (const torrent of torrents) {
    const key = extractMagnetHash(torrent.magnetLink) || torrent.title;
    if (!key || seen.has(key)) {
      continue;
    }
    seen.add(key);
    result.push(torrent);
  }

  return result;
}

function extractMagnetHash(magnetLink: string): string {
  const match = magnetLink.match(/btih:([a-fA-F0-9]+)/);
  return match?.[1]?.toLowerCase() ?? "";
}

function normalizeText(value: unknown): string | null {
  if (typeof value !== "string") {
    return null;
  }
  const trimmed = value.replace(/\s+/g, " ").trim();
  return trimmed || null;
}

function numberOrZero(value: unknown): number {
  return typeof value === "number" && Number.isFinite(value) ? value : 0;
}

function dedupeStrings(values: string[]): string[] {
  const result: string[] = [];
  for (const value of values) {
    const normalized = normalizeText(value);
    if (normalized && !result.includes(normalized)) {
      result.push(normalized);
    }
  }
  return result;
}

function dedupeResults(results: JavSearchResult[]): JavSearchResult[] {
  const seen = new Set<string>();
  const deduped: JavSearchResult[] = [];
  for (const result of results) {
    const key = result.detailUrl || `${result.javId}|${result.title}`;
    if (seen.has(key)) {
      continue;
    }
    seen.add(key);
    deduped.push(result);
  }
  return deduped;
}

function chooseBestCandidate(candidates: JavSearchResult[], query: string): JavSearchResult {
  if (candidates.length === 1) {
    return candidates[0];
  }

  const normalizedQuery = normalizeJavId(query);
  for (const candidate of candidates) {
    const id = normalizeJavId(candidate.javId || candidate.title);
    if (isValidJavId(id) && id.toLowerCase() === normalizedQuery.toLowerCase()) {
      return candidate;
    }
    const idFromTitle = normalizeJavId(candidate.title);
    if (isValidJavId(idFromTitle) && idFromTitle.toLowerCase() === normalizedQuery.toLowerCase()) {
      return candidate;
    }
  }

  const match = candidates.find((candidate) => candidate.title.toLowerCase().includes(normalizedQuery.toLowerCase()));
  return match ?? candidates[0];
}

function emptySearchResult(javId: string): JavSearchResult {
  return {
    javId,
    title: "",
    coverUrl: "",
    releaseDate: undefined,
    duration: 0,
    director: "",
    maker: "",
    publisher: "",
    series: "",
    actors: [],
    categories: [],
    torrents: [],
    detailUrl: "",
    dataSource: "Remote",
    cachedAt: undefined,
  };
}
