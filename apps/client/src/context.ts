import { AppConfig } from "./config";
import { LocalizationService } from "./localization";
import { IJavDbDataProvider, IEverythingSearchProvider, IJavLocalCacheProvider, IQBittorrentClient } from "../../../packages/shared/src/interfaces";
import { DownloadService, HealthCheckService, JavInfoTelemetryClient, JavSearchService, LocalFileCheckService, ServiceAvailability, SubtitleSearchService, TelemetryService, TorrentSelectionService } from "./services";

export interface AppContext {
  config: AppConfig;
  loc: LocalizationService;
  services: {
    javDbProvider: IJavDbDataProvider;
    everythingProvider: IEverythingSearchProvider;
    qbClient: IQBittorrentClient;
    cacheProvider: IJavLocalCacheProvider | null;
    serviceAvailability: ServiceAvailability;
    torrentSelectionService: TorrentSelectionService;
    localFileCheckService: LocalFileCheckService;
    downloadService: DownloadService;
    javSearchService: JavSearchService;
    subtitleSearchService: SubtitleSearchService;
    healthCheckService: HealthCheckService;
    telemetryClient: JavInfoTelemetryClient;
    telemetryService: TelemetryService;
  };
}
