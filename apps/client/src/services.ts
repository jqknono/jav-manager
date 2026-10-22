import fs from "fs";
import os from "os";
import path from "path";
import { SubtitleConfig, TelemetryConfig } from "./config";
import { IHealthChecker, IJavDbDataProvider, IJavLocalCacheProvider, ISubtitleSearchProvider } from "../../../packages/shared/src/interfaces";
import { CacheStatistics, HealthCheckResult, JavSearchResult, SubtitleLanguageOption, SubtitleSearchItem, SubtitleSearchResult, TorrentInfo } from "../../../packages/shared/src/models";
import { LocalizationService } from "./localization";
import { calculateAndSort } from "../../../packages/shared/src/utils/weightCalculator";
import { normalizeJavId } from "../../../packages/shared/src/utils/torrentNameParser";
import { getVersion } from "./utils/appInfo";
import { getJavInfoPostUrl, getTelemetryPostUrl } from "../../../packages/shared/src/utils/backendEndpoints";
import { splitTitleVariants } from "../../../packages/shared/src/utils/titleVariants";
import { getPreferredConfigDirectory } from "./utils/appPaths";
import {
  buildSubtitleFileName,
  isExactJavSubtitle,
  pickPreferredLanguage,
  sanitizeFileName,
  sortSubtitleItems,
} from "../../../packages/shared/src/utils/subtitleSearch";

export class ServiceAvailability {
  javDbKnown = false;
  javDbHealthy = false;
  subtitleKnown = false;
  subtitleHealthy = false;

  get remoteSearchAvailable(): boolean {
    return !this.javDbKnown || this.javDbHealthy;
  }

  get subtitleAvailable(): boolean {
    return !this.subtitleKnown || this.subtitleHealthy;
  }

  updateFrom(results: HealthCheckResult[]): void {
    if (!results) {
      return;
    }

    const javDb = results.find((r) => r.serviceName.toLowerCase().includes("javdb"));
    if (javDb) {
      this.javDbKnown = true;
      this.javDbHealthy = javDb.isHealthy;
    }

    const subtitle = results.find((r) => r.serviceName.toLowerCase().includes("subtitle"));
    if (subtitle) {
      this.subtitleKnown = true;
      this.subtitleHealthy = subtitle.isHealthy;
    }
  }
}

export class HealthCheckService {
  private checkers: IHealthChecker[];
  private loc: LocalizationService;

  constructor(checkers: IHealthChecker[], loc: LocalizationService) {
    this.checkers = checkers;
    this.loc = loc;
  }

  async checkAll(): Promise<HealthCheckResult[]> {
    const tasks = this.checkers.map(async (checker) => {
      try {
        return await checker.checkHealth();
      } catch (error) {
        const message = error instanceof Error ? error.message : "Unknown error";
        return { serviceName: checker.serviceName, isHealthy: false, message: message || this.loc.get("health_fail") };
      }
    });
    return Promise.all(tasks);
  }
}

export class TorrentSelectionService {
  private hideOtherTorrents: boolean;

  constructor(hideOtherTorrents: boolean) {
    this.hideOtherTorrents = hideOtherTorrents;
  }

  selectBest(torrents: TorrentInfo[]): TorrentInfo | null {
    if (torrents.length === 0) {
      return null;
    }
    return this.getSortedTorrents(torrents)[0] ?? null;
  }

  getSortedTorrents(torrents: TorrentInfo[]): TorrentInfo[] {
    if (torrents.length === 0) {
      return torrents;
    }
    const sorted = calculateAndSort(torrents);
    if (!this.hideOtherTorrents) {
      return sorted;
    }
    return sorted.filter((torrent) => torrent.hasUncensoredMarker || torrent.hasSubtitle || torrent.hasHd);
  }
}

export interface SubtitleDownloadResult {
  javId: string;
  savedPath: string;
  languageCode: string;
  source: string;
  title: string;
}

export class SubtitleSearchService {
  private providers: ISubtitleSearchProvider[];
  private config: SubtitleConfig;

  constructor(providers: ISubtitleSearchProvider[], config: SubtitleConfig) {
    this.providers = providers;
    this.config = config;
  }

  async search(javId: string): Promise<SubtitleSearchResult> {
    const normalized = normalizeJavId(javId);
    const messages: string[] = [];
    const collected: SubtitleSearchItem[] = [];

    const searches = await Promise.all(this.providers.map(async (provider) => {
      try {
        const items = await provider.search(normalized);
        return { provider, items, error: "" };
      } catch (error) {
        const message = error instanceof Error ? error.message : "Unknown error";
        return { provider, items: [] as SubtitleSearchItem[], error: message };
      }
    }));

    for (const result of searches) {
      if (result.error) {
        messages.push(`${result.provider.sourceName}: ${result.error}`);
        continue;
      }
      collected.push(...result.items.filter((item) => isExactJavSubtitle(normalized, item.title) || item.matchScore >= 75));
    }

    const ranked = sortSubtitleItems(dedupeSubtitleItems(collected));
    return {
      javId: normalized,
      items: ranked,
      messages,
    };
  }

  async hydrate(item: SubtitleSearchItem): Promise<SubtitleSearchItem> {
    const provider = this.findProvider(item.source);
    if (!provider) {
      return item;
    }
    return provider.getDetail(item);
  }

  async downloadPreferred(item: SubtitleSearchItem, javId: string): Promise<SubtitleDownloadResult> {
    const hydrated = item.languages.length ? item : await this.hydrate(item);
    const language = pickPreferredLanguage(hydrated, this.config.preferredLanguages);
    if (!language) {
      throw new Error("No downloadable subtitle language found");
    }
    return this.downloadLanguage(hydrated, language, javId);
  }

  async downloadLanguage(item: SubtitleSearchItem, language: SubtitleLanguageOption, javId: string): Promise<SubtitleDownloadResult> {
    const provider = this.findProvider(item.source);
    if (!provider) {
      throw new Error(`Unknown subtitle source: ${item.source}`);
    }

    const downloaded = await provider.download(language.downloadUrl);
    const fileName = sanitizeFileName(downloaded.fileName.endsWith(".srt")
      ? downloaded.fileName
      : buildSubtitleFileName(javId, language.code, item.source));
    const savedPath = writeSubtitleFile(this.resolveSaveDirectory(), fileName, downloaded.content);

    return {
      javId: normalizeJavId(javId),
      savedPath,
      languageCode: language.code,
      source: item.source,
      title: item.title,
    };
  }

  private findProvider(source: string): ISubtitleSearchProvider | undefined {
    return this.providers.find((provider) => provider.sourceName.toLowerCase() === String(source ?? "").toLowerCase());
  }

  private resolveSaveDirectory(): string {
    const configured = String(this.config.savePath ?? "").trim();
    if (configured) {
      return configured;
    }
    return path.join(getPreferredConfigDirectory(), "subtitles");
  }
}

function writeSubtitleFile(directory: string, fileName: string, content: Uint8Array): string {
  fs.mkdirSync(directory, { recursive: true });
  const target = path.join(directory, fileName);
  fs.writeFileSync(target, content);
  return target;
}

function dedupeSubtitleItems(items: SubtitleSearchItem[]): SubtitleSearchItem[] {
  const seen = new Set<string>();
  const result: SubtitleSearchItem[] = [];
  for (const item of items) {
    const key = `${item.source}|${item.detailUrl || item.title}`.toLowerCase();
    if (seen.has(key)) {
      continue;
    }
    seen.add(key);
    result.push(item);
  }
  return result;
}

export interface JavSearchProcessResult {
  javId: string;
  success: boolean;
  selectedTorrent?: TorrentInfo;
  magnetLink?: string;
  availableTorrents: TorrentInfo[];
  searchResult?: JavSearchResult;
  messages: string[];
}

export class JavInfoTelemetryClient {
  private config: TelemetryConfig;
  private endpoint: string;

  constructor(config: TelemetryConfig) {
    this.config = config;
    this.endpoint = getJavInfoPostUrl(config.endpoint);
  }

  tryReport(result: JavSearchResult): void {
    if (!this.config.enabled) {
      return;
    }
    const javId = normalizeTelemetryText(result.javId);
    if (!javId) {
      return;
    }

    let title = normalizeTelemetryText(result.title);
    let titleZh = normalizeTelemetryText(result.titleZh);

    // Backward-compatible fallback:
    // if caller passed a combined title string (zh + marker + original),
    // split it so storage can keep title/title_zh separately.
    if (!titleZh && title) {
      const split = splitTitleVariants(title);
      const splitTitle = normalizeTelemetryText(split.title);
      const splitTitleZh = normalizeTelemetryText(split.titleZh);
      if (splitTitle) title = splitTitle;
      if (splitTitleZh) titleZh = splitTitleZh;
    }

    const payload = {
      jav_id: javId,
      title,
      title_zh: titleZh,
      cover_url: normalizeTelemetryText(result.coverUrl),
      release_date: normalizeTelemetryDate(result.releaseDate),
      duration: result.duration > 0 ? result.duration : null,
      director: normalizeTelemetryText(result.director),
      maker: normalizeTelemetryText(result.maker),
      publisher: normalizeTelemetryText(result.publisher),
      series: normalizeTelemetryText(result.series),
      actors: normalizeTelemetryList(result.actors),
      categories: normalizeTelemetryList(result.categories),
      torrents: normalizeTelemetryTorrents(result.torrents),
      detail_url: normalizeTelemetryText(result.detailUrl),
    };

    void fetch(this.endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    }).catch(() => undefined);
  }
}

export class TelemetryService {
  private enabled: boolean;
  private endpoint: string;
  private info: {
    machineName: string;
    userName: string;
    appVersion: string;
    osInfo: string;
  };

  constructor(config: TelemetryConfig) {
    this.enabled = config.enabled;
    this.endpoint = getTelemetryPostUrl(config.endpoint);
    this.info = {
      machineName: getMachineNameSafe(),
      userName: getUserNameSafe(),
      appVersion: getVersion(),
      osInfo: getOsInfo(),
    };
  }

  trackStartup(): void {
    this.sendEvent("startup", null);
  }

  trackSearch(searchTerm?: string): void {
    this.sendEvent("search", searchTerm ? `term:${searchTerm}` : null);
  }

  trackEvent(eventType: string, eventData?: string | null): void {
    this.sendEvent(eventType, eventData ?? null);
  }

  private sendEvent(eventType: string, eventData: string | null): void {
    if (!this.enabled) {
      return;
    }

    const payload = {
      machine_name: this.info.machineName,
      user_name: this.info.userName,
      app_version: this.info.appVersion,
      os_info: this.info.osInfo,
      event_type: eventType,
      event_data: eventData,
    };

    // Fire-and-forget: telemetry should never block main workflow.
    void fetch(this.endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    }).catch(() => undefined);
  }
}

function getMachineNameSafe(): string {
  const fromEnv = process.env.COMPUTERNAME || process.env.HOSTNAME;
  if (fromEnv && fromEnv.trim()) {
    return fromEnv.trim();
  }
  try {
    const host = os.hostname();
    if (host && host.trim()) {
      return host.trim();
    }
  } catch {
    // ignore
  }
  return `machine-${randomId()}`;
}

function getUserNameSafe(): string {
  const fromEnv = process.env.USERNAME || process.env.USER;
  if (fromEnv && fromEnv.trim()) {
    return fromEnv.trim();
  }
  try {
    const user = os.userInfo().username;
    if (user && user.trim()) {
      return user.trim();
    }
  } catch {
    // ignore
  }
  return `user-${randomId()}`;
}

function getOsInfo(): string {
  try {
    return `${os.platform()} ${os.release()}`;
  } catch {
    return "unknown";
  }
}

function randomId(): string {
  return Math.random().toString(16).slice(2, 10);
}

function normalizeTelemetryText(value?: string | null): string | null {
  if (typeof value !== "string") {
    return null;
  }
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}

function normalizeTelemetryDate(value?: string | null): string | null {
  const text = normalizeTelemetryText(value);
  if (!text) {
    return null;
  }

  // Keep already-normalized YYYY-MM-DD.
  if (/^\d{4}-\d{2}-\d{2}$/.test(text)) {
    return text;
  }

  const parsed = new Date(text);
  if (Number.isNaN(parsed.getTime())) {
    return text;
  }
  return parsed.toISOString().slice(0, 10);
}

function normalizeTelemetryList(values?: string[] | null): string[] {
  if (!Array.isArray(values)) {
    return [];
  }

  const deduped = new Set<string>();
  for (const value of values) {
    const normalized = normalizeTelemetryText(value);
    if (normalized) {
      deduped.add(normalized);
    }
  }
  return Array.from(deduped);
}

function normalizeTelemetryTorrents(torrents?: TorrentInfo[] | null): Array<Record<string, unknown>> {
  if (!Array.isArray(torrents)) {
    return [];
  }

  return torrents.map((torrent) => ({
    title: normalizeTelemetryText(torrent.title),
    magnet_link: normalizeTelemetryText(torrent.magnetLink),
    torrent_url: normalizeTelemetryText(torrent.torrentUrl),
    size: typeof torrent.size === "number" && Number.isFinite(torrent.size) ? torrent.size : 0,
    has_uncensored_marker: !!torrent.hasUncensoredMarker,
    uncensored_marker_type: normalizeTelemetryText(String(torrent.uncensoredMarkerType ?? "")),
    has_subtitle: !!torrent.hasSubtitle,
    has_hd: !!torrent.hasHd,
    seeders: typeof torrent.seeders === "number" && Number.isFinite(torrent.seeders) ? torrent.seeders : 0,
    leechers: typeof torrent.leechers === "number" && Number.isFinite(torrent.leechers) ? torrent.leechers : 0,
    source_site: normalizeTelemetryText(torrent.sourceSite),
    weight_score: typeof torrent.weightScore === "number" && Number.isFinite(torrent.weightScore) ? torrent.weightScore : 0,
  }));
}

export class JavSearchService {
  private javDbProvider: IJavDbDataProvider;
  private cacheProvider: IJavLocalCacheProvider | null;
  private selectionService: TorrentSelectionService;
  private serviceAvailability: ServiceAvailability;
  private loc: LocalizationService;

  constructor(
    javDbProvider: IJavDbDataProvider,
    selectionService: TorrentSelectionService,
    serviceAvailability: ServiceAvailability,
    loc: LocalizationService,
    cacheProvider?: IJavLocalCacheProvider | null
  ) {
    this.javDbProvider = javDbProvider;
    this.selectionService = selectionService;
    this.serviceAvailability = serviceAvailability;
    this.loc = loc;
    this.cacheProvider = cacheProvider ?? null;
  }

  async process(javId: string, forceRemote = false): Promise<JavSearchProcessResult> {
    const result = createProcessResult(javId);
    let searchResult: JavSearchResult | null = null;

    if (!forceRemote && this.cacheProvider) {
      searchResult = await this.cacheProvider.get(javId);
      if (!searchResult?.torrents?.length) {
        searchResult = null;
      }
    }

    if (!searchResult) {
      if (!this.serviceAvailability.remoteSearchAvailable) {
        result.success = false;
        result.messages.push(this.loc.get("no_search_results"));
        return result;
      }

      searchResult = await this.javDbProvider.search(javId);
      if (searchResult.torrents.length === 0) {
        result.success = false;
        result.messages.push(this.loc.get("no_torrents_found"));
        return result;
      }

      if (this.cacheProvider) {
        await this.cacheProvider.save(searchResult);
      }
    }

    const selectedTorrent = this.selectionService.selectBest(searchResult.torrents);
    if (!selectedTorrent) {
      result.success = false;
      result.messages.push(this.loc.get("no_torrents_found"));
      return result;
    }

    return this.applySelectedTorrent(result, selectedTorrent);
  }

  async processSelectedTorrent(javId: string, selectedTorrent: TorrentInfo): Promise<JavSearchProcessResult> {
    const result = createProcessResult(javId);
    return this.applySelectedTorrent(result, selectedTorrent);
  }

  async searchOnly(javId: string, forceRemote = false): Promise<JavSearchProcessResult> {
    const result = createProcessResult(javId);
    let searchResult: JavSearchResult | null = null;

    if (!forceRemote && this.cacheProvider) {
      searchResult = await this.cacheProvider.get(javId);
    }

    if (!searchResult) {
      if (!this.serviceAvailability.remoteSearchAvailable) {
        result.success = false;
        result.messages.push(this.loc.get("no_search_results"));
        return result;
      }
      searchResult = await this.javDbProvider.search(javId);
      if (searchResult.torrents.length === 0) {
        result.success = false;
        result.messages.push(this.loc.get("no_torrents_found"));
        return result;
      }
      if (this.cacheProvider) {
        await this.cacheProvider.save(searchResult);
      }
    }

    result.availableTorrents = this.selectionService.getSortedTorrents(searchResult.torrents);
    result.searchResult = searchResult;
    result.success = result.availableTorrents.length > 0;
    return result;
  }

  async getCacheStatistics(): Promise<CacheStatistics | null> {
    if (!this.cacheProvider) {
      return null;
    }
    return this.cacheProvider.getStatistics();
  }

  private applySelectedTorrent(result: JavSearchProcessResult, selectedTorrent: TorrentInfo): JavSearchProcessResult {
    result.selectedTorrent = selectedTorrent;
    result.magnetLink = selectedTorrent.magnetLink;
    result.success = true;
    result.messages.push(this.loc.get("magnet_ready"));
    return result;
  }
}

function createProcessResult(javId: string): JavSearchProcessResult {
  return {
    javId,
    success: false,
    availableTorrents: [],
    messages: [],
  };
}
