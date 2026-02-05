import fs from "fs";
import path from "path";
import { getPreferredConfigDirectory } from "./utils/appPaths";

export interface EverythingConfig {
  baseUrl: string;
  userName: string | null;
  password: string | null;
}

export interface QBittorrentConfig {
  baseUrl: string;
  userName: string | null;
  password: string | null;
}

export interface JavDbCurlImpersonateConfig {
  enabled: boolean;
  target: string;
  libraryPath: string;
  caBundlePath: string;
  defaultHeaders: boolean;
}

export interface JavDbConfig {
  baseUrl: string;
  mirrorUrls: string[];
  requestTimeout: number;
  userAgent: string;
  curlImpersonate: JavDbCurlImpersonateConfig;
}

export interface DownloadConfig {
  defaultSavePath: string;
  defaultCategory: string;
  defaultTags: string;
}

export interface LocalCacheConfig {
  enabled: boolean;
  databasePath: string;
  cacheExpirationDays: number;
}

export interface ConsoleConfig {
  language: "en" | "zh";
  hideOtherTorrents: boolean;
}

export interface TelemetryConfig {
  enabled: boolean;
  endpoint: string;
}

export interface UpdateConfig {
  enabled: boolean;
  autoCheckOnStartup: boolean;
  gitHubRepo: string;
}

export interface AppConfig {
  everything: EverythingConfig;
  qBittorrent: QBittorrentConfig;
  javDb: JavDbConfig;
  download: DownloadConfig;
  localCache: LocalCacheConfig;
  console: ConsoleConfig;
  telemetry: TelemetryConfig;
  update: UpdateConfig;
}

const defaultConfig: AppConfig = {
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
    baseUrl: "https://javdb.com",
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
    endpoint: "https://jav-manager.techfetch.dev",
  },
  update: {
    enabled: true,
    autoCheckOnStartup: true,
    gitHubRepo: "jqknono/jav-manager",
  },
};

const defaultConfigFileName = "appsettings.json";
const devConfigFileName = "appsettings.Development.json";

export function getConfigPath(baseDir?: string): string {
  return path.join(baseDir ?? getPreferredConfigDirectory(), defaultConfigFileName);
}

export function loadConfig(overrides?: Record<string, string>): AppConfig {
  const baseDir = getPreferredConfigDirectory();
  const configPath = getConfigPath(baseDir);
  const devPath = path.join(baseDir, devConfigFileName);

  const fileConfig = readConfigFile(configPath);
  const devConfig = readConfigFile(devPath);

  let merged = mergeDeep(defaultConfig, fileConfig, devConfig);
  if (overrides) {
    merged = applyOverrides(merged, overrides);
  }

  return sanitizeConfig(merged);
}

export function saveConfig(config: AppConfig, baseDir?: string): void {
  const target = getConfigPath(baseDir);
  const json = JSON.stringify(toFileConfig(config), null, 2);
  fs.writeFileSync(target, json);
}

export function extractOverrides(args: string[]): {
  overrides: Record<string, string>;
  remaining: string[];
} {
  const overrides: Record<string, string> = {};
  const remaining: string[] = [];

  const optionToKey: Record<string, string> = {
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
    let value: string | undefined;
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

function readConfigFile(filePath: string): Record<string, unknown> {
  if (!fs.existsSync(filePath)) {
    return {};
  }
  const raw = fs.readFileSync(filePath, "utf-8");
  if (!raw.trim()) {
    return {};
  }
  const parsed = JSON.parse(raw) as Record<string, unknown>;
  return normalizeFileConfig(parsed);
}

function mergeDeep<T>(base: T, ...sources: Array<Record<string, unknown>>): T {
  let result: Record<string, unknown> = { ...base } as Record<string, unknown>;
  for (const source of sources) {
    result = mergeRecord(result, source);
  }
  return result as T;
}

function mergeRecord(target: Record<string, unknown>, source: Record<string, unknown>): Record<string, unknown> {
  const result: Record<string, unknown> = { ...target };
  for (const [key, value] of Object.entries(source)) {
    if (value && typeof value === "object" && !Array.isArray(value)) {
      const existing = (result[key] ?? {}) as Record<string, unknown>;
      result[key] = mergeRecord(existing, value as Record<string, unknown>);
    } else if (value !== undefined) {
      result[key] = value;
    }
  }
  return result;
}

function normalizeFileConfig(raw: Record<string, unknown>): Record<string, unknown> {
  const everything = raw.Everything as Record<string, unknown> | undefined;
  const qb = raw.QBittorrent as Record<string, unknown> | undefined;
  const javDb = raw.JavDb as Record<string, unknown> | undefined;
  const download = raw.Download as Record<string, unknown> | undefined;
  const localCache = raw.LocalCache as Record<string, unknown> | undefined;
  const consoleConfig = raw.Console as Record<string, unknown> | undefined;
  const telemetry = raw.Telemetry as Record<string, unknown> | undefined;
  const update = raw.Update as Record<string, unknown> | undefined;
  const curl = (javDb?.CurlImpersonate as Record<string, unknown> | undefined) ?? undefined;

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

function stringOrUndefined(value: unknown): string | undefined {
  return typeof value === "string" ? value : undefined;
}

function nullableStringOrUndefined(value: unknown): string | null | undefined {
  return typeof value === "string" ? value : undefined;
}

function numberOrUndefined(value: unknown): number | undefined {
  return typeof value === "number" ? value : undefined;
}

function booleanOrUndefined(value: unknown): boolean | undefined {
  return typeof value === "boolean" ? value : undefined;
}

function arrayStringOrUndefined(value: unknown): string[] | undefined {
  if (Array.isArray(value)) {
    return value.filter((item) => typeof item === "string") as string[];
  }
  return undefined;
}

function applyOverrides(config: AppConfig, overrides: Record<string, string>): AppConfig {
  const result = { ...config } as AppConfig;
  for (const [key, rawValue] of Object.entries(overrides)) {
    setConfigValue(result, key, rawValue);
  }
  return result;
}

function sanitizeConfig(config: AppConfig): AppConfig {
  if (config.console.language !== "en" && config.console.language !== "zh") {
    config.console.language = "en";
  }
  return config;
}

function setConfigValue(config: AppConfig, key: string, value: string): void {
  const parts = key.split(".");
  let cursor: Record<string, unknown> = config as unknown as Record<string, unknown>;
  for (let i = 0; i < parts.length - 1; i += 1) {
    const part = parts[i];
    const next = cursor[part];
    if (!next || typeof next !== "object") {
      cursor[part] = {};
    }
    cursor = cursor[part] as Record<string, unknown>;
  }
  cursor[parts[parts.length - 1]] = value;
}

function toFileConfig(config: AppConfig): Record<string, unknown> {
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
