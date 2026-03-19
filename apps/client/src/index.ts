import { AppConfig, extractOverrides, loadConfig } from "./config";
import { AppContext } from "./context";
import { LocalizationService } from "./localization";
import { JsonJavCacheProvider } from "./data/cache";
import { EverythingHttpClient } from "./data/everything";
import { JavDbWebScraper, CloudflareChallengeCallback } from "./data/javdb";
import { QBittorrentApiClient } from "./data/qbittorrent";
import readline from "node:readline/promises";
import { stdin as input, stdout as output } from "node:process";
import { isLightweightCliCommand, runCli } from "./cli";
import { startGuiServer } from "./gui";
import { DownloadService, HealthCheckService, JavInfoTelemetryClient, JavSearchService, LocalFileCheckService, ServiceAvailability, TelemetryService, TorrentSelectionService } from "./services";

export async function runAutoEntry(rawArgs: string[] = process.argv.slice(2)): Promise<void> {
  const { overrides, remaining } = extractOverrides(rawArgs);
  const config = loadConfig(overrides);
  const loc = new LocalizationService(config.console.language);
  const isGui = shouldRunGui(remaining);
  const cfCallback: CloudflareChallengeCallback | undefined = isGui ? undefined : createCliCfChallengeHandler(loc);
  const context = createAppContext(config, loc, cfCallback);
  const cliArgs = filterGuiArgs(remaining);

  if (isGui) {
    context.services.telemetryService.trackStartup();
    const gui = parseGuiArgs(remaining);
    startGuiServer(context, gui.port, gui.host);
    return;
  }

  if (!isLightweightCliCommand(cliArgs)) {
    context.services.telemetryService.trackStartup();
  }
  await runCli(context, cliArgs);
}

export async function runCliEntry(rawArgs: string[] = process.argv.slice(2)): Promise<void> {
  const { overrides, remaining } = extractOverrides(rawArgs);
  const config = loadConfig(overrides);
  const loc = new LocalizationService(config.console.language);
  const context = createAppContext(config, loc, createCliCfChallengeHandler(loc));
  const cliArgs = filterGuiArgs(remaining);

  if (!isLightweightCliCommand(cliArgs)) {
    context.services.telemetryService.trackStartup();
  }
  await runCli(context, cliArgs);
}

export function runGuiEntry(rawArgs: string[] = process.argv.slice(2)): void {
  const { overrides, remaining } = extractOverrides(rawArgs);
  const config = loadConfig(overrides);
  const loc = new LocalizationService(config.console.language);
  const context = createAppContext(config, loc);
  const gui = parseGuiArgs(remaining);

  context.services.telemetryService.trackStartup();
  startGuiServer(context, gui.port, gui.host);
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

export function createAppContext(config: AppConfig, loc: LocalizationService, onCfChallenge?: CloudflareChallengeCallback): AppContext {
  const javDbProvider = new JavDbWebScraper(config.javDb, onCfChallenge);
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
    if (["help", "h", "--help", "-h", "version", "v", "--version", "-v", "--id"].includes(arg)) {
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

function createCliCfChallengeHandler(loc: LocalizationService): CloudflareChallengeCallback {
  return async (url: string): Promise<Record<string, string> | null> => {
    const isZh = loc.currentLocale === "zh";
    const host = (() => { try { return new URL(url).host; } catch { return url; } })();

    console.log("");
    console.log(isZh
      ? `⚠  Cloudflare 挑戰攔截 (${host})`
      : `⚠  Cloudflare challenge detected (${host})`);
    console.log(isZh
      ? "   請在瀏覽器中打開該網站, 通過驗證後, 從瀏覽器開發者工具 (F12) 中複製 Cookie."
      : "   Open this site in a browser, pass the challenge, then copy cookies from DevTools (F12).");
    console.log(isZh
      ? "   需要的 Cookie: cf_clearance (必需), 其他可選."
      : "   Required cookie: cf_clearance (required), others optional.");
    console.log(isZh
      ? "   格式: cf_clearance=xxx 或 cf_clearance=xxx; __cf_bm=yyy"
      : "   Format: cf_clearance=xxx or cf_clearance=xxx; __cf_bm=yyy");
    console.log("");

    const rl = readline.createInterface({ input, output });
    try {
      const answer = await rl.question(isZh
        ? "  ▸ 粘貼 Cookie (留空跳過): "
        : "  ▸ Paste cookie (empty to skip): ");
      const trimmed = answer.trim();
      if (!trimmed) {
        return null;
      }
      return parseCookieString(trimmed);
    } finally {
      rl.close();
    }
  };
}

function parseCookieString(raw: string): Record<string, string> {
  const result: Record<string, string> = {};
  for (const part of raw.split(";")) {
    const idx = part.indexOf("=");
    if (idx < 1) continue;
    const key = part.slice(0, idx).trim();
    const value = part.slice(idx + 1).trim();
    if (key) {
      result[key] = value;
    }
  }
  return result;
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
