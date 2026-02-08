import { AppConfig, extractOverrides, loadConfig } from "./config";
import { AppContext } from "./context";
import { LocalizationService } from "./localization";
import { JsonJavCacheProvider } from "./data/cache";
import { EverythingHttpClient } from "./data/everything";
import { JavDbWebScraper } from "./data/javdb";
import { QBittorrentApiClient } from "./data/qbittorrent";
import { runCli } from "./cli";
import { startGuiServer } from "./gui";
import { DownloadService, HealthCheckService, JavInfoTelemetryClient, JavSearchService, LocalFileCheckService, ServiceAvailability, TelemetryService, TorrentSelectionService } from "./services";

const rawArgs = process.argv.slice(2);
const { overrides, remaining } = extractOverrides(rawArgs);
const config = loadConfig(overrides);
const loc = new LocalizationService(config.console.language);
const context = createAppContext(config, loc);
const args = filterGuiArgs(remaining);
context.services.telemetryService.trackStartup();

if (shouldRunGui(remaining)) {
  const gui = parseGuiArgs(remaining);
  startGuiServer(context, gui.port, gui.host);
} else {
  runCli(context, args);
}

function parseGuiArgs(args: string[]): { host: string; port: number } {
  let host = "127.0.0.1";
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

function createAppContext(config: AppConfig, loc: LocalizationService): AppContext {
  const javDbProvider = new JavDbWebScraper(config.javDb);
  const everythingProvider = new EverythingHttpClient(config.everything);
  const qbClient = new QBittorrentApiClient(config.qBittorrent);
  const cacheProvider = config.localCache.enabled ? new JsonJavCacheProvider(config.localCache) : null;
  const serviceAvailability = new ServiceAvailability();
  const torrentSelectionService = new TorrentSelectionService(config.console.hideOtherTorrents);
  const localFileCheckService = new LocalFileCheckService(everythingProvider);
  const downloadService = new DownloadService(qbClient, config.download);
  const telemetryClient = new JavInfoTelemetryClient(config.telemetry);
  const telemetryService = new TelemetryService(config.telemetry);
  const javSearchService = new JavSearchService(
    javDbProvider,
    torrentSelectionService,
    localFileCheckService,
    downloadService,
    serviceAvailability,
    loc,
    cacheProvider
  );
  const healthCheckService = new HealthCheckService([everythingProvider, qbClient, javDbProvider], loc);

  return {
    config,
    loc,
    services: {
      javDbProvider,
      everythingProvider,
      qbClient,
      cacheProvider,
      serviceAvailability,
      torrentSelectionService,
      localFileCheckService,
      downloadService,
      javSearchService,
      healthCheckService,
      telemetryClient,
      telemetryService,
    },
  };
}

function shouldRunGui(args: string[]): boolean {
  for (const arg of args) {
    if (arg === "--no-gui" || arg === "--console" || arg === "-c") {
      return false;
    }
  }

  for (const arg of args) {
    if (["help", "h", "--help", "-h", "version", "v", "--version", "-v", "--test-curl", "--id"].includes(arg)) {
      return false;
    }
  }

  if (args.length > 0) {
    const first = args[0].trim();
    if (!first.startsWith("--") && first.toLowerCase() !== "gui") {
      return false;
    }
  }

  return true;
}

function filterGuiArgs(args: string[]): string[] {
  return args.filter(
    (arg) =>
      arg !== "--no-gui" &&
      arg !== "--console" &&
      arg !== "-c" &&
      arg.toLowerCase() !== "gui"
  );
}
