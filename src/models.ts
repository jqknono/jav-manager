export enum UncensoredMarkerType {
  None = "None",
  UC = "UC",
  U = "U",
}

export enum FileType {
  Video = "Video",
  Folder = "Folder",
  Torrent = "Torrent",
}

export interface TorrentInfo {
  title: string;
  magnetLink: string;
  torrentUrl?: string;
  size: number;
  hasUncensoredMarker: boolean;
  uncensoredMarkerType: UncensoredMarkerType;
  hasSubtitle: boolean;
  hasHd: boolean;
  seeders: number;
  leechers: number;
  sourceSite: string;
  progress?: number;
  state?: string;
  dlSpeed: number;
  eta: number;
  weightScore: number;
  name?: string;
}

export interface JavSearchResult {
  javId: string;
  title: string;
  titleZh?: string;
  coverUrl: string;
  releaseDate?: string;
  duration: number;
  director: string;
  maker: string;
  publisher: string;
  series: string;
  actors: string[];
  categories: string[];
  torrents: TorrentInfo[];
  detailUrl: string;
  dataSource: "Local" | "Remote";
  cachedAt?: string;
}

export interface LocalFileInfo {
  fileName: string;
  fullPath: string;
  size: number;
  modifiedDate: string;
  fileType: FileType;
}

export interface UserSelectionOption<T = unknown> {
  index: number;
  description: string;
  data?: T;
}

export interface UserSelectionResult {
  selectedIndex: number;
  isCancelled: boolean;
  forceDownload: boolean;
}

export interface CacheStatistics {
  totalJavCount: number;
  totalTorrentCount: number;
  databaseSizeBytes: number;
  lastUpdatedAt?: string;
}

export interface HealthCheckResult {
  serviceName: string;
  isHealthy: boolean;
  message: string;
  url?: string;
}
