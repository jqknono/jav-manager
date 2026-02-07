import * as cheerio from "cheerio";
import { JavDbConfig } from "../config";
import { IJavDbDataProvider, IHealthChecker, IHttpFetcher } from "../interfaces";
import { JavSearchResult, TorrentInfo, UncensoredMarkerType } from "../models";
import { normalizeJavId, parseTorrentName, isValidJavId } from "../utils/torrentNameParser";
import { CurlImpersonateFetcher } from "./curlImpersonateFetcher";

const MaxAttemptsPerUrl = 4;
const MaxUrlCycles = 2;
const RetryBaseDelayMs = 1000;
const PreferredLocale = "zh";

type FetchResult = { status: number; body: string; error?: string };

export class JavDbWebScraper implements IJavDbDataProvider, IHealthChecker {
  private config: JavDbConfig;
  private userAgents: string[];
  private cookieJar = new Map<string, Map<string, string>>();
  private curlFetcher: CurlImpersonateFetcher;

  constructor(config: JavDbConfig) {
    this.config = config;
    this.userAgents = buildUserAgentCandidates(config);
    this.curlFetcher = new CurlImpersonateFetcher(config.curlImpersonate);
  }

  get serviceName(): string {
    return "JavDB";
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
    const urls = buildBaseUrls(this.config);
    let lastError = "";

    for (let cycle = 0; cycle < MaxUrlCycles; cycle += 1) {
      for (const baseUrl of urls) {
        const trimmed = baseUrl.replace(/\/+$/, "");
        this.seedCookiesForUrl(trimmed);

        const homeUrl = withLocale(trimmed, PreferredLocale);
        const home = await this.getWithRetry(homeUrl, null, MaxAttemptsPerUrl);
        if (!isSuccessStatus(home.status)) {
          lastError = home.error ?? `HTTP ${home.status}`;
          continue;
        }

        const searchUrl = withLocale(`${trimmed}/search?q=${encodeURIComponent(javId)}&f=all`, PreferredLocale);
        const search = await this.getWithRetry(searchUrl, homeUrl, MaxAttemptsPerUrl);
        if (!isSuccessStatus(search.status)) {
          lastError = search.error ?? `HTTP ${search.status}`;
          continue;
        }

        const results = parseSearchResults(search.body);
        for (const result of results) {
          if (result.detailUrl && !/^https?:\/\//i.test(result.detailUrl)) {
            result.detailUrl = `${trimmed}${result.detailUrl}`;
          }
        }

        const deduped = dedupeResults(results);
        if (deduped.length === 0) {
          return [];
        }

        return deduped;
      }
    }

    throw new Error(`JavDB request failed: ${lastError}`);
  }

  async getDetail(detailUrl: string): Promise<JavSearchResult> {
    const baseUrl = this.config.baseUrl.replace(/\/+$/, "");
    let url = detailUrl;
    if (!/^https?:\/\//i.test(url)) {
      url = `${baseUrl}${detailUrl}`;
    }
    url = withLocale(url, PreferredLocale);

    const referer = url.startsWith(baseUrl) ? withLocale(baseUrl, PreferredLocale) : withLocale(new URL(url).origin, PreferredLocale);
    this.seedCookiesForUrl(referer);
    const response = await this.getWithRetry(url, referer, MaxAttemptsPerUrl);
    if (!isSuccessStatus(response.status)) {
      throw new Error(response.error ?? `HTTP ${response.status}`);
    }

    const detail = parseDetailPage(response.body);
    detail.detailUrl = url;
    detail.torrents = parseTorrentLinks(response.body);
    return detail;
  }

  async checkHealth(): Promise<{ serviceName: string; isHealthy: boolean; message: string; url?: string }> {
    const urls = buildBaseUrls(this.config);
    if (urls.length === 0) {
      return { serviceName: this.serviceName, isHealthy: false, message: "No JavDB base URL configured" };
    }

    for (const url of urls) {
      const trimmed = url.replace(/\/+$/, "");
      this.seedCookiesForUrl(trimmed);
      const response = await this.getWithRetry(trimmed, null, 2, 3000);
      if (isSuccessStatus(response.status)) {
        return { serviceName: this.serviceName, isHealthy: true, message: "OK", url: trimmed };
      }
    }

    return { serviceName: this.serviceName, isHealthy: false, message: "JavDB unreachable", url: this.config.baseUrl };
  }

  private async getWithRetry(url: string, referer: string | null, maxAttempts: number, timeoutMs?: number): Promise<FetchResult> {
    let lastError = "";
    for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
      if (attempt > 0) {
        await delay(getRetryDelay(attempt));
      } else {
        await delay(100 + Math.floor(Math.random() * 300));
      }

      try {
        const result = await this.sendRequest(url, referer, attempt, timeoutMs);
        if (isSuccessStatus(result.status)) {
          return result;
        }
        lastError = result.error ?? `HTTP ${result.status}`;
        if (!isRetryableStatus(result.status)) {
          return { ...result, error: lastError };
        }
      } catch (error) {
        lastError = error instanceof Error ? error.message : "Unknown error";
      }
    }
    return { status: 0, body: "", error: lastError };
  }

  private async sendRequest(url: string, referer: string | null, attemptIndex: number, timeoutMs?: number): Promise<FetchResult> {
    const cookieHeader = this.getCookieHeader(url);
    const timeout = timeoutMs ?? this.config.requestTimeout;

    // Try curl-impersonate first if enabled and available
    if (this.curlFetcher.isAvailable()) {
      try {
        const result = await this.curlFetcher.get(url, referer, cookieHeader, timeout);
        if (isSuccessStatus(result.status)) {
          return { status: result.status, body: result.body };
        }
        // If curl-impersonate fails, fall back to standard fetch
        console.warn(`curl-impersonate failed: ${result.error}, falling back to standard fetch`);
      } catch (error) {
        console.warn(`curl-impersonate error: ${error instanceof Error ? error.message : "Unknown error"}, falling back to standard fetch`);
      }
    }

    // Fallback to standard fetch
    const userAgent = this.userAgents[attemptIndex % this.userAgents.length] ?? defaultUserAgent;
    const headers: Record<string, string> = buildChromeHeaders(userAgent, referer);

    if (cookieHeader) {
      headers.Cookie = cookieHeader;
    }

    const controller = new AbortController();
    const timeoutTimer = setTimeout(() => controller.abort(), timeout);

    try {
      const response = await fetch(url, {
        method: "GET",
        headers,
        signal: controller.signal,
      });
      const body = await response.text();
      this.captureCookies(url, response.headers);
      return { status: response.status, body };
    } finally {
      clearTimeout(timeoutTimer);
    }
  }

  private seedCookiesForUrl(baseUrl: string): void {
    if (!baseUrl) {
      return;
    }
    const host = new URL(baseUrl).host;
    const jar = this.cookieJar.get(host) ?? new Map<string, string>();
    jar.set("over18", "1");
    jar.set("locale", "zh");
    this.cookieJar.set(host, jar);
  }

  private getCookieHeader(url: string): string | null {
    const host = new URL(url).host;
    const jar = this.cookieJar.get(host);
    if (!jar || jar.size === 0) {
      return null;
    }
    return Array.from(jar.entries())
      .map(([key, value]) => `${key}=${value}`)
      .join("; ");
  }

  private captureCookies(url: string, headers: Headers): void {
    const host = new URL(url).host;
    const jar = this.cookieJar.get(host) ?? new Map<string, string>();

    const setCookies = typeof headers.getSetCookie === "function"
      ? headers.getSetCookie()
      : (headers.get("set-cookie") ? [headers.get("set-cookie") as string] : []);

    for (const raw of setCookies) {
      const [pair] = raw.split(";", 1);
      const [name, value] = pair.split("=", 2);
      if (name && value) {
        jar.set(name.trim(), value.trim());
      }
    }

    this.cookieJar.set(host, jar);
  }
}

function buildBaseUrls(config: JavDbConfig): string[] {
  const urls = [config.baseUrl, ...config.mirrorUrls]
    .map((url) => url.trim())
    .filter((url) => url.length > 0);
  return Array.from(new Set(urls));
}

function buildUserAgentCandidates(config: JavDbConfig): string[] {
  const candidates: string[] = [];
  if (config.userAgent?.trim()) {
    candidates.push(config.userAgent.trim());
  }
  candidates.push(defaultUserAgent);
  candidates.push("Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/144.0.0.0 Safari/537.36");
  candidates.push("Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/144.0.0.0 Safari/537.36");
  return Array.from(new Set(candidates));
}

function buildChromeHeaders(userAgent: string, referer: string | null): Record<string, string> {
  const chromeMajor = parseChromeMajorVersion(userAgent);
  const platform = getPlatformFromUserAgent(userAgent);
  const mobile = userAgent.toLowerCase().includes("mobile") ? "?1" : "?0";

  const headers: Record<string, string> = {
    Connection: "keep-alive",
    "Cache-Control": "max-age=0",
    "sec-ch-ua": `"Google Chrome";v="${chromeMajor}", "Chromium";v="${chromeMajor}", "Not_A Brand";v="24"`,
    "sec-ch-ua-mobile": mobile,
    "sec-ch-ua-platform": `"${platform}"`,
    DNT: "1",
    "Upgrade-Insecure-Requests": "1",
    "User-Agent": userAgent,
    Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7",
    "Sec-Fetch-Site": referer ? "same-origin" : "none",
    "Sec-Fetch-Mode": "navigate",
    "Sec-Fetch-User": "?1",
    "Sec-Fetch-Dest": "document",
    "Accept-Encoding": "gzip, deflate, br",
    "Accept-Language": "zh-CN,zh;q=0.9,en;q=0.8,ja;q=0.7",
  };

  if (referer) {
    headers.Referer = referer;
  }

  return headers;
}

function parseChromeMajorVersion(userAgent: string): string {
  const match = userAgent.match(/Chrome\/(\d+)/);
  return match?.[1] ?? "131";
}

function getPlatformFromUserAgent(userAgent: string): string {
  const ua = userAgent.toLowerCase();
  if (ua.includes("windows")) return "Windows";
  if (ua.includes("mac os x") || ua.includes("macintosh")) return "macOS";
  if (ua.includes("linux")) return "Linux";
  return "Windows";
}

function isSuccessStatus(status: number): boolean {
  return status >= 200 && status < 300;
}

function isRetryableStatus(status: number): boolean {
  return [0, 403, 408, 425, 429, 500, 502, 503, 520, 522, 524].includes(status);
}

function getRetryDelay(attemptIndex: number): number {
  const base = RetryBaseDelayMs * Math.pow(1.5, attemptIndex);
  const jitter = Math.floor(Math.random() * 800) - 300;
  return Math.max(500, base + jitter);
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function withLocale(url: string, locale: string): string {
  try {
    const u = new URL(url);
    if (!u.searchParams.has("locale")) {
      u.searchParams.set("locale", locale);
    }
    return u.toString();
  } catch {
    return url;
  }
}

function parseSearchResults(html: string): JavSearchResult[] {
  const results: JavSearchResult[] = [];
  const $ = cheerio.load(html);
  const items = $("div.item").has("a.box");

  items.each((_, element) => {
    const link = $(element).find("a.box").first();
    if (!link.length) {
      return;
    }

    const detailUrl = link.attr("href") ?? "";
    const titleAttr = link.attr("title") ?? "";
    const titleText = normalizeInlineText(link.text());
    const title = titleAttr || titleText;

    const coverNode = $(element).find("img.video-cover").first();
    const coverUrl = coverNode.attr("data-src") || coverNode.attr("src") || "";

    const idNode = $(element).find(".uid, .video-id, .video-uid, .video_id").first();
    const idFromNode = extractJavIdFromText(normalizeInlineText(idNode.text()));
    const idFromText = extractJavIdFromText(normalizeInlineText($(element).text()));
    const idFromTitle = extractJavIdFromText(title);
    const javId = idFromNode ?? idFromText ?? idFromTitle ?? "";

    results.push({
      javId,
      title,
      coverUrl,
      detailUrl,
      releaseDate: undefined,
      duration: 0,
      director: "",
      maker: "",
      publisher: "",
      series: "",
      actors: [],
      categories: [],
      torrents: [],
      dataSource: "Remote",
      cachedAt: undefined,
    });
  });

  return results;
}

function parseDetailPage(html: string): JavSearchResult {
  const $ = cheerio.load(html);
  const title = normalizeInlineText($("h2.title").first().text());
  let javId = normalizeInlineText($("span.current-title").first().text());
  if (!javId) {
    javId = extractJavIdFromText(title) ?? "";
  }

  const coverNode = $("img.video-cover").first();
  const coverUrl = coverNode.attr("data-src") || coverNode.attr("src") || "";
  const releaseDate = parseMetaField($, ["發行日期", "发行日期", "發布日期", "発売日", "Released Date", "Release Date", "日期"]);
  const duration = parseDuration(parseMetaField($, ["時長", "时长", "片長", "片长", "収録時間", "Duration"]));
  const director = parseMetaField($, ["導演", "导演", "監督", "Director"]);
  const maker = parseMetaField($, ["片商", "製作商", "制作商", "メーカー", "Maker", "Studio"]);
  const publisher = parseMetaField($, ["發行", "发行", "レーベル", "Publisher", "Label"]);
  const series = parseMetaField($, ["系列", "シリーズ", "Series"]);
  const actors = parseList($, [
    "div.video-meta-panel strong:contains('演員') ~ span a",
    "div.video-meta-panel strong:contains('演员') ~ span a",
    "div.video-meta-panel strong:contains('出演者') ~ span a",
    "div.panel-block strong:contains('演員') ~ span a",
    "div.panel-block strong:contains('演员') ~ span a",
    "div.panel-block strong:contains('出演者') ~ span a",
    "div.panel-block strong:contains('演員') ~ a",
    "div.panel-block strong:contains('演员') ~ a",
    "div.panel-block strong:contains('出演者') ~ a",
    "div.panel-block a[href*='/actors/']",
  ]);
  const categories = parseList($, [
    "div.video-meta-panel strong:contains('Tags') ~ span a",
    "div.panel-block strong:contains('Tags') ~ span a",
    "div.video-meta-panel strong:contains('類別') ~ span a",
    "div.video-meta-panel strong:contains('类别') ~ span a",
    "div.video-meta-panel strong:contains('ジャンル') ~ span a",
    "div.panel-block strong:contains('類別') ~ span a",
    "div.panel-block strong:contains('类别') ~ span a",
    "div.panel-block strong:contains('ジャンル') ~ span a",
    "div.panel-block strong:contains('類別') ~ a",
    "div.panel-block strong:contains('类别') ~ a",
    "div.panel-block strong:contains('ジャンル') ~ a",
    "div.video-meta-panel a[href^='/tags']",
    "div.panel-block a[href^='/tags']",
  ]);

  return {
    javId,
    title,
    coverUrl,
    releaseDate: releaseDate || undefined,
    duration,
    director,
    maker,
    publisher,
    series,
    actors,
    categories,
    torrents: [],
    detailUrl: "",
    dataSource: "Remote",
    cachedAt: undefined,
  };
}

function parseMetaField($: cheerio.CheerioAPI, keywords: string[]): string {
  for (const keyword of keywords) {
    const selectors = [
      `div.video-meta-panel strong:contains('${keyword}') ~ span`,
      `div.video-meta-panel span:contains('${keyword}') ~ span`,
      `div.video-meta-panel span:contains('${keyword}') ~ a`,
      `div.panel-block strong:contains('${keyword}') ~ span`,
      `div.panel-block strong:contains('${keyword}') ~ a`,
    ];

    for (const selector of selectors) {
      const nodes = $(selector);
      for (const node of nodes.toArray()) {
        const text = normalizeInlineText($(node).text());
        if (isMeaningfulMetaText(text)) {
          return text;
        }
      }
    }
  }
  return "";
}

function isMeaningfulMetaText(text: string): boolean {
  if (!text) {
    return false;
  }
  const normalized = text.trim().toLowerCase();
  return normalized !== "n/a" && normalized !== "-" && normalized !== "--";
}

function parseDuration(text: string): number {
  if (!text) {
    return 0;
  }
  const match = text.match(/(\d+)\s*(?:分鐘|分钟|min)/i);
  if (match) {
    return Number(match[1]);
  }
  const asNumber = Number(text.trim());
  return Number.isNaN(asNumber) ? 0 : asNumber;
}

function parseList($: cheerio.CheerioAPI, selectors: string[]): string[] {
  for (const selector of selectors) {
    const nodes = $(selector);
    if (nodes.length) {
      const items: string[] = [];
      nodes.each((_, element) => {
        const text = normalizeInlineText($(element).text());
        if (text && !items.includes(text)) {
          items.push(text);
        }
      });
      return items;
    }
  }
  return [];
}

function parseTorrentLinks(html: string): TorrentInfo[] {
  const $ = cheerio.load(html);
  const torrents: TorrentInfo[] = [];
  const seenMagnets = new Set<string>();

  $("div.magnet-name").each((_, element) => {
    const magnetNode = $(element).find("a[href^='magnet:']").first();
    const magnetLink = magnetNode.attr("href") ?? "";
    if (!magnetLink.startsWith("magnet:")) {
      return;
    }

    const hash = extractMagnetHash(magnetLink);
    if (hash && seenMagnets.has(hash)) {
      return;
    }
    if (hash) {
      seenMagnets.add(hash);
    }

    const title = normalizeInlineText($(element).find("span.name").first().text());
    const meta = normalizeInlineText($(element).find("span.meta").first().text());

    let size = extractSizeFromMagnet(magnetLink);
    if (!size) {
      size = parseSizeBytes(meta) ?? 0;
    }

    const tags = $(element).find("span.tag");
    let hasSubtitle = false;
    let hasUncensored = false;
    let hasHd = false;

    tags.each((_, tag) => {
      const tagText = normalizeInlineText($(tag).text());
      if (!tagText) {
        return;
      }
      if (tagText.includes("字幕") || tagText.includes("中文") || tagText.includes("中文字幕")) {
        hasSubtitle = true;
      }
      if (tagText.includes("無碼") || tagText.includes("无码") || tagText.includes("破解")) {
        hasUncensored = true;
      }
      if (tagText.includes("高清") || /HD|1080|720|4K/i.test(tagText)) {
        hasHd = true;
      }
    });

    if (!hasHd && /HD|1080|720|4K/i.test(title)) {
      hasHd = true;
    }

    const { uncensoredType } = parseTorrentName(title);
    hasUncensored = hasUncensored || uncensoredType !== UncensoredMarkerType.None;
    const uncensoredMarkerType = hasUncensored
      ? hasSubtitle
        ? UncensoredMarkerType.UC
        : UncensoredMarkerType.U
      : UncensoredMarkerType.None;

    torrents.push({
      title,
      magnetLink,
      size,
      hasSubtitle,
      hasUncensoredMarker: hasUncensored,
      uncensoredMarkerType,
      hasHd,
      seeders: 0,
      leechers: 0,
      sourceSite: "JavDB",
      progress: undefined,
      state: undefined,
      dlSpeed: 0,
      eta: 0,
      weightScore: 0,
    });
  });

  return torrents;
}

function normalizeInlineText(text: string): string {
  return text.replace(/\s+/g, " ").trim();
}

function extractMagnetHash(magnetLink: string): string {
  const match = magnetLink.match(/btih:([a-fA-F0-9]+)/);
  return match?.[1]?.toLowerCase() ?? "";
}

function extractSizeFromMagnet(magnetLink: string): number | null {
  const match = magnetLink.match(/[?&]xl=(\d+)/i);
  if (!match) {
    return null;
  }
  const value = Number(match[1]);
  return Number.isNaN(value) ? null : value;
}

function parseSizeBytes(text: string): number | null {
  if (!text) {
    return null;
  }
  const match = text.match(/(\d+(?:\.\d+)?)\s*(KiB|MiB|GiB|TiB|KB|MB|GB|TB|B)\b/i);
  if (!match) {
    return null;
  }
  const value = Number(match[1]);
  if (Number.isNaN(value)) {
    return null;
  }
  const unit = match[2].toUpperCase();
  const multiplier: Record<string, number> = {
    B: 1,
    KB: 1024,
    KIB: 1024,
    MB: 1024 * 1024,
    MIB: 1024 * 1024,
    GB: 1024 * 1024 * 1024,
    GIB: 1024 * 1024 * 1024,
    TB: 1024 * 1024 * 1024 * 1024,
    TIB: 1024 * 1024 * 1024 * 1024,
  };
  const factor = multiplier[unit];
  return factor ? Math.floor(value * factor) : null;
}

function extractJavIdFromText(text: string): string | null {
  if (!text) {
    return null;
  }
  const match = text.match(/([A-Z0-9]+-\d+)/i);
  return match ? match[1].toUpperCase() : null;
}

function dedupeResults(results: JavSearchResult[]): JavSearchResult[] {
  const seen = new Set<string>();
  const deduped: JavSearchResult[] = [];
  for (const result of results) {
    const key = result.detailUrl || `${result.title}|${result.javId}`;
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

const defaultUserAgent =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/144.0.0.0 Safari/537.36";
