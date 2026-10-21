import { SubtitleIndexSiteConfig } from "../config";
import { ISubtitleSearchProvider } from "../../../../packages/shared/src/interfaces";
import { SubtitleLanguageOption, SubtitleSearchItem } from "../../../../packages/shared/src/models";
import {
  looksLikeSrt,
  normalizeSubtitleQuery,
  parseCount,
  parseSubtitleSize,
  resolveContentFileName,
  scoreSubtitleMatch,
} from "../../../../packages/shared/src/utils/subtitleSearch";
import { HttpHelper } from "../utils/httpHelper";

const DefaultUserAgent = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";

export class SubtitleIndexClient implements ISubtitleSearchProvider {
  private site: SubtitleIndexSiteConfig;
  private timeoutMs: number;
  private userAgent: string;
  private http: HttpHelper;

  constructor(site: SubtitleIndexSiteConfig, timeoutMs: number, userAgent: string, httpHelper?: HttpHelper) {
    this.site = site;
    this.timeoutMs = timeoutMs;
    this.userAgent = userAgent;
    this.http = httpHelper ?? new HttpHelper();
  }

  get sourceName(): string {
    return this.site.name;
  }

  async search(javId: string): Promise<SubtitleSearchItem[]> {
    const query = normalizeSubtitleQuery(javId);
    const html = await this.getText(this.buildSearchUrl(query));
    return parseIndexSearchResults(html, this.getBaseUrl(), this.sourceName, query);
  }

  async getDetail(item: SubtitleSearchItem): Promise<SubtitleSearchItem> {
    if (!item.detailUrl) {
      return item;
    }
    const html = await this.getText(item.detailUrl, item.detailUrl);
    return parseIndexDetailPage(html, item, this.getBaseUrl());
  }

  async download(url: string): Promise<{ fileName: string; content: Uint8Array }> {
    const response = await this.http.getBinary(url, this.buildHeaders(url), this.timeoutMs);
    const fallbackName = decodeURIComponent(url.split("/").pop() ?? "subtitle.srt");
    const fileName = resolveContentFileName(response.headers.get("content-disposition"), fallbackName);
    if (!looksLikeSrt(response.buffer)) {
      throw new Error("Downloaded file is not a valid SRT subtitle");
    }
    return { fileName, content: response.buffer };
  }

  private getBaseUrl(): string {
    return String(this.site.baseUrl ?? "").trim().replace(/\/+$/, "");
  }

  private buildSearchUrl(javId: string): string {
    const template = this.site.searchPath || "/?s={query}";
    const path = template.replace("{query}", encodeURIComponent(javId));
    return `${this.getBaseUrl()}${path.startsWith("/") ? path : `/${path}`}`;
  }

  private async getText(url: string, referer?: string): Promise<string> {
    return this.http.get(url, this.buildHeaders(referer ?? url), this.timeoutMs);
  }

  private buildHeaders(referer?: string): Record<string, string> {
    const headers: Record<string, string> = {
      "User-Agent": this.userAgent.trim() || DefaultUserAgent,
      Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
    };
    if (referer) {
      headers.Referer = referer;
    }
    return headers;
  }
}

export function parseIndexSearchResults(html: string, baseUrl: string, sourceName: string, javId: string): SubtitleSearchItem[] {
  const anchors = html.match(/<a[^>]+href=["'][^"']+["'][^>]*>[\s\S]*?<\/a>/gi) ?? [];
  const items: SubtitleSearchItem[] = [];
  const seen = new Set<string>();

  for (const anchor of anchors) {
    const hrefMatch = anchor.match(/href=["']([^"']+)["']/i);
    const title = decodeHtml(stripTags(anchor)).trim();
    if (!hrefMatch || !title) {
      continue;
    }
    const href = decodeHtml(hrefMatch[1] ?? "").trim();
    if (!href || href.startsWith("#") || href.toLowerCase().startsWith("javascript:")) {
      continue;
    }
    if (/[?&](s|q|search|query)=/i.test(href) || /\/search(?:\/|$|\?)/i.test(href)) {
      continue;
    }
    if (scoreSubtitleMatch(javId, title) < 55 && scoreSubtitleMatch(javId, href) < 55) {
      continue;
    }

    const detailUrl = resolveUrl(baseUrl, href);
    if (seen.has(detailUrl)) {
      continue;
    }
    seen.add(detailUrl);

    const isDirectSrt = /\.srt(?:$|[?#])/i.test(href);
    const languages: SubtitleLanguageOption[] = isDirectSrt
      ? [{
          code: inferLanguageCode(title, href),
          label: inferLanguageCode(title, href),
          downloadUrl: detailUrl,
          isOriginal: /orig|original/i.test(`${title} ${href}`),
        }]
      : [];

    items.push({
      javId,
      title,
      source: sourceName,
      detailUrl,
      size: parseSubtitleSize(title),
      downloads: parseCount(title),
      languageCount: languages.length,
      sourceLanguage: "",
      languages,
      originalDownloadUrl: isDirectSrt ? detailUrl : undefined,
      matchScore: Math.max(scoreSubtitleMatch(javId, title), scoreSubtitleMatch(javId, href)),
    });
  }

  return items;
}

export function parseIndexDetailPage(html: string, item: SubtitleSearchItem, baseUrl: string): SubtitleSearchItem {
  const links = html.match(/href=["']([^"']+\.srt[^"']*)["']/gi) ?? [];
  const languages: SubtitleLanguageOption[] = [];
  const seen = new Set<string>();

  for (const raw of links) {
    const hrefMatch = raw.match(/href=["']([^"']+)["']/i);
    if (!hrefMatch) {
      continue;
    }
    const href = decodeHtml(hrefMatch[1] ?? "").trim();
    const downloadUrl = resolveUrl(baseUrl, href);
    if (seen.has(downloadUrl)) {
      continue;
    }
    seen.add(downloadUrl);
    const code = inferLanguageCode(item.title, href);
    languages.push({
      code,
      label: code,
      downloadUrl,
      isOriginal: /orig|original/i.test(href),
    });
  }

  return {
    ...item,
    languages: languages.length ? languages : item.languages,
    languageCount: Math.max(item.languageCount, languages.length),
    originalDownloadUrl: languages.find((language) => language.isOriginal)?.downloadUrl ?? item.originalDownloadUrl,
  };
}

function inferLanguageCode(title: string, href: string): string {
  const haystack = `${title} ${href}`.toLowerCase();
  if (/zh[-_]?cn|chs|sc|gb|简体/.test(haystack)) return "zh-CN";
  if (/zh[-_]?tw|cht|tc|big5|繁體|繁体/.test(haystack)) return "zh-TW";
  if (/\bzh\b|中字|中文/.test(haystack)) return "zh";
  if (/\bja\b|jp|日本語|日文/.test(haystack)) return "ja";
  if (/\ben\b|eng|english/.test(haystack)) return "en";
  return "und";
}

function resolveUrl(baseUrl: string, href: string): string {
  try {
    return new URL(href, `${String(baseUrl ?? "").replace(/\/+$/, "")}/`).toString();
  } catch {
    return href;
  }
}

function stripTags(value: string): string {
  return String(value ?? "").replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
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
