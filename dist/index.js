"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const config_1 = require("./config");
const localization_1 = require("./localization");
const cache_1 = require("./data/cache");
const everything_1 = require("./data/everything");
const javdb_1 = require("./data/javdb");
const qbittorrent_1 = require("./data/qbittorrent");
const cli_1 = require("./cli");
const gui_1 = require("./gui");
const services_1 = require("./services");
const rawArgs = process.argv.slice(2);
const { overrides, remaining } = (0, config_1.extractOverrides)(rawArgs);
const config = (0, config_1.loadConfig)(overrides);
const loc = new localization_1.LocalizationService(config.console.language);
const context = createAppContext(config, loc);
const args = filterGuiArgs(remaining);
context.services.telemetryService.trackStartup();
if (shouldRunGui(remaining)) {
    const gui = parseGuiArgs(remaining);
    (0, gui_1.startGuiServer)(context, gui.port, gui.host);
}
else {
    (0, cli_1.runCli)(context, args);
}
function parseGuiArgs(args) {
    let host = "127.0.0.1";
    let port = 4860;
    for (let i = 0; i < args.length; i += 1) {
        const raw = args[i] ?? "";
        if (!raw.startsWith("--"))
            continue;
        let name = raw;
        let value;
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
            if (next)
                host = next;
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
function createAppContext(config, loc) {
    const javDbProvider = new javdb_1.JavDbWebScraper(config.javDb);
    const everythingProvider = new everything_1.EverythingHttpClient(config.everything);
    const qbClient = new qbittorrent_1.QBittorrentApiClient(config.qBittorrent);
    const cacheProvider = config.localCache.enabled ? new cache_1.JsonJavCacheProvider(config.localCache) : null;
    const serviceAvailability = new services_1.ServiceAvailability();
    const torrentSelectionService = new services_1.TorrentSelectionService(config.console.hideOtherTorrents);
    const localFileCheckService = new services_1.LocalFileCheckService(everythingProvider);
    const downloadService = new services_1.DownloadService(qbClient, config.download);
    const telemetryClient = new services_1.JavInfoTelemetryClient(config.telemetry);
    const telemetryService = new services_1.TelemetryService(config.telemetry);
    const javSearchService = new services_1.JavSearchService(javDbProvider, torrentSelectionService, localFileCheckService, downloadService, serviceAvailability, loc, cacheProvider);
    const healthCheckService = new services_1.HealthCheckService([everythingProvider, qbClient, javDbProvider], loc);
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
function shouldRunGui(args) {
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
function filterGuiArgs(args) {
    return args.filter((arg) => arg !== "--no-gui" &&
        arg !== "--console" &&
        arg !== "-c" &&
        arg.toLowerCase() !== "gui");
}
