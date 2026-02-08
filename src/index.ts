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
const cliArgs = filterGuiArgs(remaining);
context.services.telemetryService.trackStartup();

if (shouldRunGui(remaining)) {
  const gui = parseGuiArgs(remaining);
  startGuiServer(context, gui.port, gui.host);
} else {
  runCli(context, cliArgs);
}

function parseGuiArgs(args: string[]): { host: string; port: number } {
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
  if (args.length === 0) {
    // Default mode: CLI.
    return false;
  }

  // CLI takes precedence for these common commands.
  for (const arg of args) {
    if (["help", "h", "--help", "-h", "version", "v", "--version", "-v", "--test-curl", "--id"].includes(arg)) {
      return false;
    }
  }

  // Explicit GUI selector.
  for (const arg of args) {
    const raw = (arg ?? "").trim();
    const name = raw.includes("=") ? raw.slice(0, raw.indexOf("=")) : raw;
    if (name === "--gui" || name === "--host" || name === "--port" || name === "--gui-host" || name === "--gui-port") {
      return true;
    }
    if (name.startsWith("--gui-")) {
      return true;
    }
  }

  // `gui` subcommand.
  const first = (args[0] ?? "").trim();
  if (first.toLowerCase() === "gui") {
    return true;
  }

  return false;
}

function filterGuiArgs(args: string[]): string[] {
  const result: string[] = [];
  for (let i = 0; i < args.length; i += 1) {
    const token = args[i] ?? "";
    const raw = token.trim();
    const lower = raw.toLowerCase();

    if (lower === "gui") continue;
    if (lower === "--gui") continue;

    // Keep backward compatibility as no-ops (don't let CLI treat them as a JAV ID).
    if (lower === "--no-gui" || lower === "--console" || lower === "-c") continue;

    if (lower === "--host" || lower === "--gui-host" || lower === "--port" || lower === "--gui-port") {
      // Skip flag + optional value.
      if (i + 1 < args.length && !(String(args[i + 1] ?? "").startsWith("--"))) {
        i += 1;
      }
      continue;
    }

    if (lower.startsWith("--host=") || lower.startsWith("--gui-host=") || lower.startsWith("--port=") || lower.startsWith("--gui-port=")) {
      continue;
    }

    result.push(token);
  }
  return result;
}
