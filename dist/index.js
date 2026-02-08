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
const cliArgs = filterGuiArgs(remaining);
context.services.telemetryService.trackStartup();
if (shouldRunGui(remaining)) {
    const gui = parseGuiArgs(remaining);
    (0, gui_1.startGuiServer)(context, gui.port, gui.host);
}
else {
    (0, cli_1.runCli)(context, cliArgs);
}
function parseGuiArgs(args) {
    let host = "0.0.0.0";
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
function filterGuiArgs(args) {
    const result = [];
    for (let i = 0; i < args.length; i += 1) {
        const token = args[i] ?? "";
        const raw = token.trim();
        const lower = raw.toLowerCase();
        if (lower === "gui")
            continue;
        if (lower === "--gui")
            continue;
        // Keep backward compatibility as no-ops (don't let CLI treat them as a JAV ID).
        if (lower === "--no-gui" || lower === "--console" || lower === "-c")
            continue;
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
