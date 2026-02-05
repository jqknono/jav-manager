import { CacheStatistics, HealthCheckResult, JavSearchResult, LocalFileInfo, TorrentInfo } from "./models";

export interface IJavDbDataProvider {
  search(javId: string): Promise<JavSearchResult>;
  searchCandidates(javId: string): Promise<JavSearchResult[]>;
  getDetail(detailUrl: string): Promise<JavSearchResult>;
}

export interface IEverythingSearchProvider {
  search(searchTerm: string): Promise<LocalFileInfo[]>;
  fileExists(javId: string): Promise<boolean>;
}

export interface IQBittorrentClient {
  login(): Promise<void>;
  addTorrent(magnetLink: string, savePath?: string, category?: string, tags?: string): Promise<boolean>;
  addTorrentFromUrl(urls: string[], savePath?: string, category?: string, tags?: string): Promise<boolean>;
  getTorrents(): Promise<TorrentInfo[]>;
  pause(hashes: string[]): Promise<void>;
  resume(hashes: string[]): Promise<void>;
  delete(hashes: string[], deleteFiles?: boolean): Promise<void>;
}

export interface IJavLocalCacheProvider {
  get(javId: string): Promise<JavSearchResult | null>;
  save(result: JavSearchResult): Promise<void>;
  updateTorrents(javId: string, torrents: TorrentInfo[]): Promise<void>;
  exists(javId: string): Promise<boolean>;
  delete(javId: string): Promise<void>;
  getStatistics(): Promise<CacheStatistics>;
  initialize(): Promise<void>;
}

export interface IHealthChecker {
  serviceName: string;
  checkHealth(): Promise<HealthCheckResult>;
}

export interface IHttpFetcher {
  get(url: string, referer: string | null, cookieHeader: string | null, timeoutMs: number): Promise<{ status: number; body: string; error?: string }>;
}
