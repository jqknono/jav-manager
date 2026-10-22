import { CacheStatistics, HealthCheckResult, JavSearchResult, SubtitleSearchItem, TorrentInfo } from "./models";

export interface IJavDbDataProvider {
  search(javId: string): Promise<JavSearchResult>;
  searchCandidates(javId: string): Promise<JavSearchResult[]>;
  getDetail(detailUrl: string): Promise<JavSearchResult>;
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

export interface ISubtitleSearchProvider {
  readonly sourceName: string;
  search(javId: string): Promise<SubtitleSearchItem[]>;
  getDetail(item: SubtitleSearchItem): Promise<SubtitleSearchItem>;
  download(url: string): Promise<{ fileName: string; content: Uint8Array }>;
}
