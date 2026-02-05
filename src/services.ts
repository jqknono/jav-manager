import fs from "fs";
import { DownloadConfig, TelemetryConfig } from "./config";
import { IEverythingSearchProvider, IHealthChecker, IJavDbDataProvider, IJavLocalCacheProvider, IQBittorrentClient } from "./interfaces";
import { CacheStatistics, FileType, HealthCheckResult, JavSearchResult, LocalFileInfo, TorrentInfo } from "./models";
import { LocalizationService } from "./localization";
import { calculateAndSort } from "./utils/weightCalculator";
import { normalizeJavId } from "./utils/torrentNameParser";

export class ServiceAvailability {
  private lock = new Object();
  everythingKnown = false;
  everythingHealthy = false;
  qBittorrentKnown = false;
  qBittorrentHealthy = false;
  javDbKnown = false;
  javDbHealthy = false;

  get localDedupAvailable(): boolean {
    return !this.everythingKnown || this.everythingHealthy;
  }

  get downloadQueueAvailable(): boolean {
    return !this.qBittorrentKnown || this.qBittorrentHealthy;
  }

  get remoteSearchAvailable(): boolean {
    return !this.javDbKnown || this.javDbHealthy;
  }

  updateFrom(results: HealthCheckResult[]): void {
    if (!results) {
      return;
    }

    const everything = results.find((r) => r.serviceName.toLowerCase().includes("everything"));
    if (everything) {
      this.everythingKnown = true;
      this.everythingHealthy = everything.isHealthy;
    }

    const qb = results.find((r) => r.serviceName.toLowerCase().includes("qbittorrent"));
    if (qb) {
      this.qBittorrentKnown = true;
      this.qBittorrentHealthy = qb.isHealthy;
    }

    const javDb = results.find((r) => r.serviceName.toLowerCase().includes("javdb"));
    if (javDb) {
      this.javDbKnown = true;
      this.javDbHealthy = javDb.isHealthy;
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

export class LocalFileCheckService {
  private searchProvider: IEverythingSearchProvider;

  constructor(searchProvider: IEverythingSearchProvider) {
    this.searchProvider = searchProvider;
  }

  async checkLocalFiles(javId: string): Promise<LocalFileInfo[]> {
    const normalized = normalizeJavId(javId);
    const results = await this.searchProvider.search(normalized);
    return results.filter((file) => file.fileType === FileType.Video);
  }

  async fileExists(javId: string): Promise<boolean> {
    const files = await this.checkLocalFiles(javId);
    return files.length > 0;
  }
}

export class DownloadService {
  private qbClient: IQBittorrentClient;
  private config: DownloadConfig;

  constructor(qbClient: IQBittorrentClient, config: DownloadConfig) {
    this.qbClient = qbClient;
    this.config = config;
  }

  async addDownload(torrent: TorrentInfo, savePath?: string, category?: string, tags?: string): Promise<boolean> {
    const normalizedPath = normalizeExistingDirectoryPath(savePath ?? this.config.defaultSavePath);
    const finalCategory = category ?? this.config.defaultCategory;
    const finalTags = tags ?? this.config.defaultTags;
    return this.qbClient.addTorrent(torrent.magnetLink, normalizedPath ?? undefined, finalCategory, finalTags);
  }

  async getDownloads(): Promise<TorrentInfo[]> {
    return this.qbClient.getTorrents();
  }
}

export interface JavSearchProcessResult {
  javId: string;
  success: boolean;
  downloaded: boolean;
  localFilesFound: boolean;
  localDedupSkipped: boolean;
  selectedTorrent?: TorrentInfo;
  downloadQueueSkipped: boolean;
  magnetLink?: string;
  localFiles: LocalFileInfo[];
  availableTorrents: TorrentInfo[];
  searchResult?: JavSearchResult;
  messages: string[];
}

export class JavInfoTelemetryClient {
  private config: TelemetryConfig;

  constructor(config: TelemetryConfig) {
    this.config = config;
  }

  tryReport(result: JavSearchResult): void {
    if (!this.config.enabled || !this.config.endpoint) {
      return;
    }
    void fetch(`${this.config.endpoint.replace(/\/+$/, "")}/api/javinfo`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(result),
    }).catch(() => undefined);
  }
}

export class JavSearchService {
  private javDbProvider: IJavDbDataProvider;
  private cacheProvider: IJavLocalCacheProvider | null;
  private selectionService: TorrentSelectionService;
  private localFileService: LocalFileCheckService;
  private downloadService: DownloadService;
  private serviceAvailability: ServiceAvailability;
  private loc: LocalizationService;
  private telemetryClient: JavInfoTelemetryClient;

  constructor(
    javDbProvider: IJavDbDataProvider,
    selectionService: TorrentSelectionService,
    localFileService: LocalFileCheckService,
    downloadService: DownloadService,
    serviceAvailability: ServiceAvailability,
    loc: LocalizationService,
    telemetryClient: JavInfoTelemetryClient,
    cacheProvider?: IJavLocalCacheProvider | null
  ) {
    this.javDbProvider = javDbProvider;
    this.selectionService = selectionService;
    this.localFileService = localFileService;
    this.downloadService = downloadService;
    this.serviceAvailability = serviceAvailability;
    this.loc = loc;
    this.telemetryClient = telemetryClient;
    this.cacheProvider = cacheProvider ?? null;
  }

  async process(javId: string, forceDownload = false, forceRemote = false): Promise<JavSearchProcessResult> {
    const result = createProcessResult(javId);
    let searchResult: JavSearchResult | null = null;

    if (!forceRemote && this.cacheProvider) {
      searchResult = await this.cacheProvider.get(javId);
      if (searchResult?.torrents?.length) {
        this.telemetryClient.tryReport(searchResult);
      } else {
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

      this.telemetryClient.tryReport(searchResult);
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
    result.selectedTorrent = selectedTorrent;

    if (!forceDownload) {
      if (!this.serviceAvailability.localDedupAvailable) {
        result.localDedupSkipped = true;
      } else {
        try {
          const localFiles = await this.localFileService.checkLocalFiles(javId);
          if (localFiles.length) {
            result.localFilesFound = true;
            result.localFiles = localFiles;
            result.success = true;
            return result;
          }
        } catch {
          result.localDedupSkipped = true;
        }
      }
    }

    if (!this.serviceAvailability.downloadQueueAvailable) {
      result.downloadQueueSkipped = true;
      result.magnetLink = selectedTorrent.magnetLink;
      result.success = true;
      result.messages.push(this.loc.get("downloader_unavailable"));
      return result;
    }

    try {
      const downloadSuccess = await this.downloadService.addDownload(selectedTorrent);
      if (downloadSuccess) {
        result.success = true;
        result.downloaded = true;
        result.messages.push(this.loc.get("download_added"));
        return result;
      }
    } catch {
      // Treat downloader errors as "skipped" and show magnet link for manual use.
      result.success = true;
      result.downloadQueueSkipped = true;
      result.magnetLink = selectedTorrent.magnetLink;
      result.messages.push(this.loc.get("download_failed"));
      return result;
    }

    result.success = true;
    result.downloadQueueSkipped = true;
    result.magnetLink = selectedTorrent.magnetLink;
    result.messages.push(this.loc.get("download_failed"));
    return result;
  }

  async processSelectedTorrent(javId: string, selectedTorrent: TorrentInfo, forceDownload = false): Promise<JavSearchProcessResult> {
    const result = createProcessResult(javId);
    result.selectedTorrent = selectedTorrent;

    if (!forceDownload) {
      if (!this.serviceAvailability.localDedupAvailable) {
        result.localDedupSkipped = true;
      } else {
        try {
          const localFiles = await this.localFileService.checkLocalFiles(javId);
          if (localFiles.length) {
            result.localFilesFound = true;
            result.localFiles = localFiles;
            result.success = true;
            return result;
          }
        } catch {
          result.localDedupSkipped = true;
        }
      }
    }

    if (!this.serviceAvailability.downloadQueueAvailable) {
      result.downloadQueueSkipped = true;
      result.magnetLink = selectedTorrent.magnetLink;
      result.success = true;
      result.messages.push(this.loc.get("downloader_unavailable"));
      return result;
    }

    try {
      const downloadSuccess = await this.downloadService.addDownload(selectedTorrent);
      if (downloadSuccess) {
        result.success = true;
        result.downloaded = true;
        result.messages.push(this.loc.get("download_added"));
        return result;
      }
    } catch {
      result.success = true;
      result.downloadQueueSkipped = true;
      result.magnetLink = selectedTorrent.magnetLink;
      result.messages.push(this.loc.get("download_failed"));
      return result;
    }

    result.success = true;
    result.downloadQueueSkipped = true;
    result.magnetLink = selectedTorrent.magnetLink;
    result.messages.push(this.loc.get("download_failed"));
    return result;
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
}

function normalizeExistingDirectoryPath(pathValue?: string): string | null {
  if (!pathValue) {
    return null;
  }
  const expanded = pathValue.trim();
  if (!expanded) {
    return null;
  }
  const resolved = expanded.replace(/%([^%]+)%/g, (_, name) => process.env[name] ?? "");
  if (!fs.existsSync(resolved)) {
    return null;
  }
  const stat = fs.statSync(resolved);
  return stat.isDirectory() ? resolved : null;
}

function createProcessResult(javId: string): JavSearchProcessResult {
  return {
    javId,
    success: false,
    downloaded: false,
    localFilesFound: false,
    localDedupSkipped: false,
    downloadQueueSkipped: false,
    localFiles: [],
    availableTorrents: [],
    messages: [],
  };
}
