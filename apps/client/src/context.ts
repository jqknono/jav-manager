import { AppConfig } from "./config";
import { LocalizationService } from "./localization";
import { IJavDbDataProvider, IJavLocalCacheProvider } from "../../../packages/shared/src/interfaces";
import { HealthCheckService, JavInfoTelemetryClient, JavSearchService, ServiceAvailability, SubtitleSearchService, TelemetryService, TorrentSelectionService } from "./services";

export interface AppContext {
  config: AppConfig;
  loc: LocalizationService;
  services: {
    javDbProvider: IJavDbDataProvider;
    cacheProvider: IJavLocalCacheProvider | null;
    serviceAvailability: ServiceAvailability;
    torrentSelectionService: TorrentSelectionService;
    javSearchService: JavSearchService;
    subtitleSearchService: SubtitleSearchService;
    healthCheckService: HealthCheckService;
    telemetryClient: JavInfoTelemetryClient;
    telemetryService: TelemetryService;
  };
}
