import { SubtitleConfig } from "../config";
import { IHealthChecker, ISubtitleSearchProvider } from "../../../../packages/shared/src/interfaces";
import { SubtitleLanguageOption, SubtitleSearchItem } from "../../../../packages/shared/src/models";
import {
  extractSourceLanguage,
  looksLikeSrt,
  normalizeSubtitleQuery,
  parseCount,
  parseSubtitleSize,
  resolveContentFileName,
  scoreSubtitleMatch,
} from "../../../../packages/shared/src/utils/subtitleSearch";
import { HttpHelper } from "../utils/httpHelper";

const DefaultBaseUrl = "https://www.subtitlecat.com";
const DefaultUserAgent = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";

export class SubtitleCatClient implements ISubtitleSearchProvider, IHealthChecker {
  private config: SubtitleConfig;
  private http: HttpHelper;

  constructor(config: SubtitleConfig, httpHelper?: HttpHelper) {
    this.config = config;
    this.http = httpHelper ?? new HttpHelper();
  }

  get sourceName(): string {
    return "SubtitleCat";
  }

  get serviceName(): string {
    return "SubtitleCat";
  }

  async search(javId: string): Promise<SubtitleSearchItem[]> {
    const query = normalizeSubtitleQuery(javId);
    const searchUrl = `${this.getBaseUrl()}/index.php?search=${encodeURIComponent(query)}`;
    const html = await this.getText(searchUrl);
    return parseSearchResults(html, this.getBaseUrl(), query);
  }

  async getDetail(item: SubtitleSearchItem): Promise<SubtitleSearchItem> {
    if (!item.detailUrl) {
      return item;
    }
    const html = await this.getText(item.detailUrl, item.detailUrl);
    return parseDetailPage(html, item, this.getBaseUrl());
  }

  async download(url: string): Promise<{ fileName: string; content: Uint8Array }> {
    const response = await this.http.getBinary(url, this.buildHeaders(url), this.config.requestTimeout);
    const fallbackName = decodeURIComponent(url.split("/").pop() ?? "subtitle.srt");
    const fileName = resolveContentFileName(response.headers.get("content-disposition"), fallbackName);
    if (!looksLikeSrt(response.buffer)) {
      throw new Error("Downloaded file is not a valid SRT subtitle");
    }
    return { fileName, content: response.buffer };
  }

  async checkHealth(): Promise<{ serviceName: string; isHealthy: boolean; message: string; url?: string }> {
    const baseUrl = this.getBaseUrl();
    try {
      const html = await this.getText(baseUrl, baseUrl, Math.min(this.config.requestTimeout, 5000));
      if (!/subtitle/i.test(html)) {
        return { serviceName: this.serviceName, isHealthy: false, message: "Unexpected homepage", url: baseUrl };
      }
      return { serviceName: this.serviceName, isHealthy: true, message: "OK", url: baseUrl };
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error";
      return { serviceName: this.serviceName, isHealthy: false, message, url: baseUrl };
    }
  }

  private getBaseUrl(): string {
    return normalizeBaseUrl(this.config.baseUrl) || DefaultBaseUrl;
  }

  private async getText(url: string, referer?: string, timeoutMs?: number): Promise<string> {
    return this.http.get(url, this.buildHeaders(referer ?? url), timeoutMs ?? this.config.requestTimeout);
  }

  private buildHeaders(referer?: string): Record<string, string> {
    const headers: Record<string, string> = {
      "User-Agent": this.config.userAgent.trim() || DefaultUserAgent,
      Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
    };
    if (referer) {
      headers.Referer = referer;
    }
    return headers;
  }
}

export function parseSearchResults(html: string, baseUrl: string, javId: string): SubtitleSearchItem[] {
  const rows = html.match(/<tr[\s\S]*?<\/tr>/gi) ?? [];
  const items: SubtitleSearchItem[] = [];

  for (const row of rows) {
    const linkMatch = row.match(/<a[^>]+href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/i);
    if (!linkMatch) {
      continue;
    }

    const href = decodeHtml(linkMatch[1] ?? "").trim();
    if (!/\/?subs\//i.test(href)) {
      continue;
    }

    const title = decodeHtml(stripTags(linkMatch[2] ?? "")).trim();
    const sourceLanguage = extractSourceLanguage(stripTags(row));
    const size = parseSubtitleSize(extractMetric(row, "Size"));
    const downloads = parseCount(extractMetric(row, "Downloads"));
    const languageCount = parseCount(extractMetric(row, "Languages"));
    const detailUrl = resolveUrl(baseUrl, href);
    const matchScore = scoreSubtitleMatch(javId, title);

    items.push({
      javId,
      title,
      source: "SubtitleCat",
      detailUrl,
      size,
      downloads,
      languageCount,
      sourceLanguage,
      languages: [],
      originalDownloadUrl: guessOriginalDownloadUrl(detailUrl, title),
      matchScore,
    });
  }

  return dedupeByDetailUrl(items);
}

export function parseDetailPage(html: string, item: SubtitleSearchItem, baseUrl: string): SubtitleSearchItem {
  const languages = parseReadyLanguages(html, baseUrl);
  const originalMatch = html.match(/translate_from_server_folder\(['"][^'"]+['"]\s*,\s*['"]([^'"]+-orig\.srt)['"]\s*,\s*['"]([^'"]+)['"]\)/i);
  const originalDownloadUrl = originalMatch
    ? resolveUrl(baseUrl, `${originalMatch[2].replace(/\/+$/, "")}/${originalMatch[1]}`)
    : item.originalDownloadUrl;

  return {
    ...item,
    languages,
    originalDownloadUrl,
    languageCount: Math.max(item.languageCount, languages.length),
  };
}

function parseReadyLanguages(html: string, baseUrl: string): SubtitleLanguageOption[] {
  const blocks = html.match(/<div class="sub-single">[\s\S]*?<\/div>/gi) ?? [];
  const languages: SubtitleLanguageOption[] = [];
  const seen = new Set<string>();

  for (const block of blocks) {
    const hrefMatch = block.match(/href=["']([^"']+\.srt)["']/i);
    if (!hrefMatch) {
      continue;
    }
    const codeMatch = block.match(/id="download_([^"]+)"/i) ?? block.match(/alt="([^"]+)"/i);
    const labelMatch = block.match(/<span>([^<]+)<\/span>/i);
    const code = decodeHtml(codeMatch?.[1] ?? "").trim();
    const label = decodeHtml(labelMatch?.[1] ?? code).trim();
    const downloadUrl = resolveUrl(baseUrl, decodeHtml(hrefMatch[1] ?? ""));
    if (!code || !downloadUrl || seen.has(code.toLowerCase())) {
      continue;
    }
    seen.add(code.toLowerCase());
    languages.push({
      code,
      label,
      downloadUrl,
      isOriginal: /orig/i.test(downloadUrl),
    });
  }

  return languages;
}

function extractMetric(row: string, label: string): string {
  const pattern = new RegExp(`${label}[\\s\\S]{0,180}?class="sub-table__metric-value">([\\s\\S]*?)<\\/span>`, "i");
  const match = row.match(pattern);
  return match ? stripTags(match[1] ?? "") : "";
}

function guessOriginalDownloadUrl(detailUrl: string, title: string): string | undefined {
  try {
    const url = new URL(detailUrl);
    const fileName = `${title.trim()}-orig.srt`;
    url.pathname = url.pathname.replace(/[^/]+\.html$/i, encodeURIComponent(fileName));
    return url.toString();
  } catch {
    return undefined;
  }
}

function dedupeByDetailUrl(items: SubtitleSearchItem[]): SubtitleSearchItem[] {
  const seen = new Set<string>();
  const result: SubtitleSearchItem[] = [];
  for (const item of items) {
    const key = item.detailUrl || item.title;
    if (seen.has(key)) {
      continue;
    }
    seen.add(key);
    result.push(item);
  }
  return result;
}

function normalizeBaseUrl(value: string): string {
  return String(value ?? "").trim().replace(/\/+$/, "");
}

function resolveUrl(baseUrl: string, href: string): string {
  try {
    return new URL(href, `${normalizeBaseUrl(baseUrl)}/`).toString();
  } catch {
    return href;
  }
}

function stripTags(value: string): string {
  return String(value ?? "").replace(/<[^>]+>/g, " ").replace(/&nbsp;/gi, " ").replace(/\s+/g, " ").trim();
}

function decodeHtml(value: string): string {
  return String(value ?? "")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&nbsp;/g, " ");
}
