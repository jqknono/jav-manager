import { AppConfig, extractOverrides, loadConfig } from "./config";
import { AppContext } from "./context";
import { LocalizationService } from "./localization";
import { JsonJavCacheProvider } from "./data/cache";
import { JavDbApiClient } from "./data/javdb";
import { SubtitleCatClient } from "./data/subtitlecat";
import { SubtitleIndexClient } from "./data/subtitleIndex";
import {
  HealthCheckService,
  JavInfoTelemetryClient,
  JavSearchService,
  ServiceAvailability,
  SubtitleSearchService,
  TelemetryService,
  TorrentSelectionService,
} from "./services";

export * from "./config";
export * from "./context";
export * from "./localization";
export * from "./services";
export * from "./data/cache";
export * from "./data/javdb";
export * from "./data/subtitlecat";
export * from "./data/subtitleIndex";
export * from "./utils/appInfo";
export * from "./utils/appPaths";
export * from "./utils/httpHelper";

export function createAppContext(config: AppConfig, loc: LocalizationService): AppContext {
  const javDbProvider = new JavDbApiClient(config.javDb);
  const cacheProvider = config.localCache.enabled ? new JsonJavCacheProvider(config.localCache) : null;
  const serviceAvailability = new ServiceAvailability();
  const torrentSelectionService = new TorrentSelectionService(config.console.hideOtherTorrents);
  const telemetryClient = new JavInfoTelemetryClient(config.telemetry);
  const telemetryService = new TelemetryService(config.telemetry);
  const javSearchService = new JavSearchService(
    javDbProvider,
    torrentSelectionService,
    serviceAvailability,
    loc,
    cacheProvider
  );
  const subtitleCatClient = new SubtitleCatClient(config.subtitle);
  const subtitleProviders = config.subtitle.enabled
    ? [
        subtitleCatClient,
        ...config.subtitle.indexSites.map(
          (site) => new SubtitleIndexClient(site, config.subtitle.requestTimeout, config.subtitle.userAgent)
        ),
      ]
    : [];
  const subtitleSearchService = new SubtitleSearchService(subtitleProviders, config.subtitle);
  const healthCheckers = config.subtitle.enabled ? [javDbProvider, subtitleCatClient] : [javDbProvider];
  const healthCheckService = new HealthCheckService(healthCheckers, loc);

  return {
    config,
    loc,
    services: {
      javDbProvider,
      cacheProvider,
      serviceAvailability,
      torrentSelectionService,
      javSearchService,
      subtitleSearchService,
      healthCheckService,
      telemetryClient,
      telemetryService,
    },
  };
}

export function parseGuiArgs(args: string[]): { host: string; port: number } {
  let host = "0.0.0.0";
  let port = 4860;

  for (let i = 0; i < args.length; i += 1) {
    const raw = args[i] ?? "";
    if (!raw.startsWith("--")) continue;

    let name = raw;
    let value: string | undefined;
    if (raw.includes("=")) {
      const idx = raw.indexOf("=");
      name = raw.slice(0, idx);
      value = raw.slice(idx + 1);
    }

    if (name === "--host" || name === "--gui-host") {
      if (value === undefined) {
        value = args[i + 1];
        i += 1;
      }
      const next = String(value ?? "").trim();
      if (next) host = next;
      continue;
    }

    if (name === "--port" || name === "--gui-port") {
      if (value === undefined) {
        value = args[i + 1];
        i += 1;
      }
      const n = Number.parseInt(String(value ?? ""), 10);
      if (Number.isFinite(n) && n > 0 && n <= 65535) {
        port = n;
      }
      continue;
    }
  }

  return { host, port };
}

export function filterGuiArgs(args: string[]): string[] {
  const result: string[] = [];
  for (let i = 0; i < args.length; i += 1) {
    const token = args[i] ?? "";
    const raw = token.trim();
    const lower = raw.toLowerCase();

    if (lower === "gui") continue;
    if (lower === "--gui") continue;
    if (lower === "--no-gui" || lower === "--console" || lower === "-c") continue;

    if (lower === "--host" || lower === "--gui-host" || lower === "--port" || lower === "--gui-port") {
      if (i + 1 < args.length && !(String(args[i + 1] ?? "").startsWith("--"))) {
        i += 1;
      }
      continue;
    }

    if (
      lower.startsWith("--host=") ||
      lower.startsWith("--gui-host=") ||
      lower.startsWith("--port=") ||
      lower.startsWith("--gui-port=")
    ) {
      continue;
    }

    result.push(token);
  }
  return result;
}

export { extractOverrides, loadConfig };
