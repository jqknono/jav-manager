"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getConfigPath = getConfigPath;
exports.loadConfig = loadConfig;
exports.saveConfig = saveConfig;
exports.extractOverrides = extractOverrides;
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
const appPaths_1 = require("./utils/appPaths");
const defaultJavDbBaseUrl = "https://javdb.com";
const defaultTelemetryEndpoint = "https://jav-manager.techfetch.dev";
const defaultConfig = {
    everything: {
        baseUrl: "",
        userName: null,
        password: null,
    },
    qBittorrent: {
        baseUrl: "",
        userName: null,
        password: null,
    },
    javDb: {
        baseUrl: defaultJavDbBaseUrl,
        mirrorUrls: [],
        requestTimeout: 30000,
        userAgent: "",
        curlImpersonate: {
            enabled: true,
            target: "chrome116",
            libraryPath: "",
            caBundlePath: "",
            defaultHeaders: true,
        },
    },
    download: {
        defaultSavePath: "",
        defaultCategory: "jav",
        defaultTags: "jav-manager",
    },
    localCache: {
        enabled: true,
        databasePath: "",
        cacheExpirationDays: 0,
    },
    console: {
        language: "en",
        hideOtherTorrents: true,
    },
    telemetry: {
        enabled: true,
        endpoint: defaultTelemetryEndpoint,
    },
    update: {
        enabled: true,
        autoCheckOnStartup: true,
        gitHubRepo: "jqknono/jav-manager",
    },
};
const defaultConfigFileName = "appsettings.json";
const devConfigFileName = "appsettings.Development.json";
function getConfigPath(baseDir) {
    return path_1.default.join(baseDir ?? (0, appPaths_1.getPreferredConfigDirectory)(), defaultConfigFileName);
}
function loadConfig(overrides) {
    const baseDir = (0, appPaths_1.getPreferredConfigDirectory)();
    const configPath = getConfigPath(baseDir);
    const devPath = path_1.default.join(baseDir, devConfigFileName);
    const fileConfig = readConfigFile(configPath);
    const devConfig = readConfigFile(devPath);
    let merged = mergeDeep(defaultConfig, fileConfig, devConfig);
    if (overrides) {
        merged = applyOverrides(merged, overrides);
    }
    return sanitizeConfig(merged);
}
function saveConfig(config, baseDir) {
    const target = getConfigPath(baseDir);
    const json = JSON.stringify(toFileConfig(config), null, 2);
    fs_1.default.writeFileSync(target, json);
}
function extractOverrides(args) {
    const overrides = {};
    const remaining = [];
    const optionToKey = {
        "--lang": "console.language",
        "--language": "console.language",
        "--everything-url": "everything.baseUrl",
        "--everything-user": "everything.userName",
        "--everything-username": "everything.userName",
        "--everything-pass": "everything.password",
        "--everything-password": "everything.password",
        "--qb-url": "qBittorrent.baseUrl",
        "--qb-user": "qBittorrent.userName",
        "--qb-username": "qBittorrent.userName",
        "--qb-pass": "qBittorrent.password",
        "--qb-password": "qBittorrent.password",
        "--javdb-url": "javDb.baseUrl",
    };
    for (let i = 0; i < args.length; i += 1) {
        const arg = args[i];
        if (arg === "--") {
            remaining.push(...args.slice(i + 1));
            break;
        }
        let name = arg;
        let value;
        if (arg.startsWith("--") && arg.includes("=")) {
            const idx = arg.indexOf("=");
            name = arg.slice(0, idx);
            value = arg.slice(idx + 1);
        }
        const key = optionToKey[name];
        if (key) {
            if (value === undefined) {
                value = args[i + 1];
                i += 1;
            }
            overrides[key] = value ?? "";
            continue;
        }
        remaining.push(arg);
    }
    return { overrides, remaining };
}
function readConfigFile(filePath) {
    if (!fs_1.default.existsSync(filePath)) {
        return {};
    }
    const raw = fs_1.default.readFileSync(filePath, "utf-8");
    if (!raw.trim()) {
        return {};
    }
    const parsed = JSON.parse(raw);
    return normalizeFileConfig(parsed);
}
function mergeDeep(base, ...sources) {
    let result = { ...base };
    for (const source of sources) {
        result = mergeRecord(result, source);
    }
    return result;
}
function mergeRecord(target, source) {
    const result = { ...target };
    for (const [key, value] of Object.entries(source)) {
        if (value && typeof value === "object" && !Array.isArray(value)) {
            const existing = (result[key] ?? {});
            result[key] = mergeRecord(existing, value);
        }
        else if (value !== undefined) {
            result[key] = value;
        }
    }
    return result;
}
function normalizeFileConfig(raw) {
    const everything = raw.Everything;
    const qb = raw.QBittorrent;
    const javDb = raw.JavDb;
    const download = raw.Download;
    const localCache = raw.LocalCache;
    const consoleConfig = raw.Console;
    const telemetry = raw.Telemetry;
    const update = raw.Update;
    const curl = javDb?.CurlImpersonate ?? undefined;
    return {
        everything: {
            baseUrl: stringOrUndefined(everything?.BaseUrl),
            userName: nullableStringOrUndefined(everything?.UserName),
            password: nullableStringOrUndefined(everything?.Password),
        },
        qBittorrent: {
            baseUrl: stringOrUndefined(qb?.BaseUrl),
            userName: nullableStringOrUndefined(qb?.UserName),
            password: nullableStringOrUndefined(qb?.Password),
        },
        javDb: {
            baseUrl: stringOrUndefined(javDb?.BaseUrl),
            mirrorUrls: arrayStringOrUndefined(javDb?.MirrorUrls),
            requestTimeout: numberOrUndefined(javDb?.RequestTimeout),
            userAgent: stringOrUndefined(javDb?.UserAgent),
            curlImpersonate: {
                enabled: booleanOrUndefined(curl?.Enabled),
                target: stringOrUndefined(curl?.Target),
                libraryPath: stringOrUndefined(curl?.LibraryPath),
                caBundlePath: stringOrUndefined(curl?.CaBundlePath),
                defaultHeaders: booleanOrUndefined(curl?.DefaultHeaders),
            },
        },
        download: {
            defaultSavePath: stringOrUndefined(download?.DefaultSavePath),
            defaultCategory: stringOrUndefined(download?.DefaultCategory),
            defaultTags: stringOrUndefined(download?.DefaultTags),
        },
        localCache: {
            enabled: booleanOrUndefined(localCache?.Enabled),
            databasePath: stringOrUndefined(localCache?.DatabasePath),
            cacheExpirationDays: numberOrUndefined(localCache?.CacheExpirationDays),
        },
        console: {
            language: stringOrUndefined(consoleConfig?.Language),
            hideOtherTorrents: booleanOrUndefined(consoleConfig?.HideOtherTorrents),
        },
        telemetry: {
            enabled: booleanOrUndefined(telemetry?.Enabled),
            endpoint: stringOrUndefined(telemetry?.Endpoint),
        },
        update: {
            enabled: booleanOrUndefined(update?.Enabled),
            autoCheckOnStartup: booleanOrUndefined(update?.AutoCheckOnStartup),
            gitHubRepo: stringOrUndefined(update?.GitHubRepo),
        },
    };
}
function stringOrUndefined(value) {
    return typeof value === "string" ? value : undefined;
}
function nullableStringOrUndefined(value) {
    return typeof value === "string" ? value : undefined;
}
function numberOrUndefined(value) {
    return typeof value === "number" ? value : undefined;
}
function booleanOrUndefined(value) {
    return typeof value === "boolean" ? value : undefined;
}
function arrayStringOrUndefined(value) {
    if (Array.isArray(value)) {
        return value.filter((item) => typeof item === "string");
    }
    return undefined;
}
function applyOverrides(config, overrides) {
    const result = { ...config };
    for (const [key, rawValue] of Object.entries(overrides)) {
        setConfigValue(result, key, rawValue);
    }
    return result;
}
function sanitizeConfig(config) {
    config.javDb = {
        ...config.javDb,
        baseUrl: nonEmptyOrDefault(config.javDb.baseUrl, defaultJavDbBaseUrl),
    };
    config.telemetry = {
        ...config.telemetry,
        endpoint: nonEmptyOrDefault(config.telemetry.endpoint, defaultTelemetryEndpoint),
    };
    if (!["en", "zh", "ja", "ko"].includes(config.console.language)) {
        config.console.language = "en";
    }
    return config;
}
function nonEmptyOrDefault(value, fallback) {
    const trimmed = String(value ?? "").trim();
    return trimmed || fallback;
}
function setConfigValue(config, key, value) {
    const parts = key.split(".");
    let cursor = config;
    for (let i = 0; i < parts.length - 1; i += 1) {
        const part = parts[i];
        const next = cursor[part];
        if (!next || typeof next !== "object") {
            cursor[part] = {};
        }
        cursor = cursor[part];
    }
    cursor[parts[parts.length - 1]] = value;
}
function toFileConfig(config) {
    return {
        Everything: {
            BaseUrl: config.everything.baseUrl,
            UserName: config.everything.userName,
            Password: config.everything.password,
        },
        QBittorrent: {
            BaseUrl: config.qBittorrent.baseUrl,
            UserName: config.qBittorrent.userName,
            Password: config.qBittorrent.password,
        },
        JavDb: {
            BaseUrl: config.javDb.baseUrl,
            MirrorUrls: config.javDb.mirrorUrls,
            RequestTimeout: config.javDb.requestTimeout,
            UserAgent: config.javDb.userAgent,
            CurlImpersonate: {
                Enabled: config.javDb.curlImpersonate.enabled,
                Target: config.javDb.curlImpersonate.target,
                LibraryPath: config.javDb.curlImpersonate.libraryPath,
                CaBundlePath: config.javDb.curlImpersonate.caBundlePath,
                DefaultHeaders: config.javDb.curlImpersonate.defaultHeaders,
            },
        },
        Download: {
            DefaultSavePath: config.download.defaultSavePath,
            DefaultCategory: config.download.defaultCategory,
            DefaultTags: config.download.defaultTags,
        },
        LocalCache: {
            Enabled: config.localCache.enabled,
            DatabasePath: config.localCache.databasePath,
            CacheExpirationDays: config.localCache.cacheExpirationDays,
        },
        Console: {
            Language: config.console.language,
            HideOtherTorrents: config.console.hideOtherTorrents,
        },
        Telemetry: {
            Enabled: config.telemetry.enabled,
            Endpoint: config.telemetry.endpoint,
        },
        Update: {
            Enabled: config.update.enabled,
            AutoCheckOnStartup: config.update.autoCheckOnStartup,
            GitHubRepo: config.update.gitHubRepo,
        },
    };
}
