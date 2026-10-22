import fs from "fs";
import path from "path";
import { getPreferredConfigDirectory } from "./utils/appPaths";
import { getBaseEndpoint } from "@jav-manager/shared-utils";

export interface JavDbConfig {
  baseUrl: string;
  mirrorUrls: string[];
  requestTimeout: number;
  userAgent: string;
}

export interface SubtitleIndexSiteConfig {
  name: string;
  baseUrl: string;
  searchPath: string;
}

export interface SubtitleConfig {
  enabled: boolean;
  baseUrl: string;
  requestTimeout: number;
  userAgent: string;
  savePath: string;
  preferredLanguages: string[];
  indexSites: SubtitleIndexSiteConfig[];
}

export interface LocalCacheConfig {
  enabled: boolean;
  databasePath: string;
  cacheExpirationDays: number;
}

export interface ConsoleConfig {
  language: "en" | "zh" | "ja" | "ko";
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
  javDb: JavDbConfig;
  subtitle: SubtitleConfig;
  localCache: LocalCacheConfig;
  console: ConsoleConfig;
  telemetry: TelemetryConfig;
  update: UpdateConfig;
}

const defaultJavDbBaseUrl = "";
const defaultTelemetryEndpoint = "https://jav-manager.techfetch.dev";

const defaultConfig: AppConfig = {
  javDb: {
    baseUrl: defaultJavDbBaseUrl,
    mirrorUrls: [],
    requestTimeout: 30000,
    userAgent: "",
  },
  subtitle: {
    enabled: true,
    baseUrl: "https://www.subtitlecat.com",
    requestTimeout: 30000,
    userAgent: "",
    savePath: "",
    preferredLanguages: ["zh-CN", "zh", "zh-TW"],
    indexSites: [
      { name: "JavSubtitled", baseUrl: "https://javsubtitled.com", searchPath: "/?s={query}" },
      { name: "Javzimu", baseUrl: "https://javzimu.com", searchPath: "/?s={query}" },
    ],
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

    "--javdb-url": "javDb.baseUrl",
    "--subtitle-url": "subtitle.baseUrl",
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
  const javBackend = (raw.JavBackend as Record<string, unknown> | undefined)
    ?? (raw.JavDb as Record<string, unknown> | undefined);
  const subtitle = raw.Subtitle as Record<string, unknown> | undefined;
  const localCache = raw.LocalCache as Record<string, unknown> | undefined;
  const consoleConfig = raw.Console as Record<string, unknown> | undefined;
  const telemetry = raw.Telemetry as Record<string, unknown> | undefined;
  const update = raw.Update as Record<string, unknown> | undefined;
  return {
    javDb: {
      baseUrl: stringOrUndefined(javBackend?.BaseUrl),
      mirrorUrls: arrayStringOrUndefined(javBackend?.MirrorUrls),
      requestTimeout: numberOrUndefined(javBackend?.RequestTimeout),
      userAgent: stringOrUndefined(javBackend?.UserAgent),
    },
    subtitle: {
      enabled: booleanOrUndefined(subtitle?.Enabled),
      baseUrl: stringOrUndefined(subtitle?.BaseUrl),
      requestTimeout: numberOrUndefined(subtitle?.RequestTimeout),
      userAgent: stringOrUndefined(subtitle?.UserAgent),
      savePath: stringOrUndefined(subtitle?.SavePath),
      preferredLanguages: arrayStringOrUndefined(subtitle?.PreferredLanguages),
      indexSites: subtitleIndexSitesOrUndefined(subtitle?.IndexSites),
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

function subtitleIndexSitesOrUndefined(value: unknown): SubtitleIndexSiteConfig[] | undefined {
  if (!Array.isArray(value)) {
    return undefined;
  }
  const sites: SubtitleIndexSiteConfig[] = [];
  for (const item of value) {
    if (!item || typeof item !== "object") {
      continue;
    }
    const record = item as Record<string, unknown>;
    const name = typeof record.Name === "string" ? record.Name : (typeof record.name === "string" ? record.name : "");
    const baseUrl = typeof record.BaseUrl === "string" ? record.BaseUrl : (typeof record.baseUrl === "string" ? record.baseUrl : "");
    const searchPath = typeof record.SearchPath === "string" ? record.SearchPath : (typeof record.searchPath === "string" ? record.searchPath : "/?s={query}");
    if (!name || !baseUrl) {
      continue;
    }
    sites.push({ name, baseUrl, searchPath: searchPath || "/?s={query}" });
  }
  return sites.length ? sites : undefined;
}

function normalizePreferredLanguages(values: string[]): string[] {
  const result: string[] = [];
  for (const value of values ?? []) {
    const normalized = String(value ?? "").trim();
    if (!normalized || result.includes(normalized)) {
      continue;
    }
    result.push(normalized);
  }
  return result.length ? result : ["zh-CN", "zh", "zh-TW"];
}

function normalizeSubtitleIndexSites(sites: SubtitleIndexSiteConfig[]): SubtitleIndexSiteConfig[] {
  const result: SubtitleIndexSiteConfig[] = [];
  const seen = new Set<string>();
  for (const site of sites ?? []) {
    const name = String(site?.name ?? "").trim();
    const baseUrl = String(site?.baseUrl ?? "").trim().replace(/\/+$/, "");
    if (!name || !baseUrl || seen.has(baseUrl.toLowerCase())) {
      continue;
    }
    seen.add(baseUrl.toLowerCase());
    result.push({
      name,
      baseUrl,
      searchPath: String(site.searchPath ?? "/?s={query}").trim() || "/?s={query}",
    });
  }
  return result;
}

function arrayStringOrUndefined(value: unknown): string[] | undefined {
  if (Array.isArray(value)) {
    return value.filter((item) => typeof item === "string") as string[];
  }
  return undefined;
}

function stringRecordOrUndefined(value: unknown): Record<string, string> | undefined {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return undefined;
  }
  const result: Record<string, string> = {};
  for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
    if (typeof v === "string") {
      result[k] = v;
    }
  }
  return Object.keys(result).length > 0 ? result : undefined;
}

function applyOverrides(config: AppConfig, overrides: Record<string, string>): AppConfig {
  const result = { ...config } as AppConfig;
  for (const [key, rawValue] of Object.entries(overrides)) {
    setConfigValue(result, key, rawValue);
  }
  return result;
}

function sanitizeConfig(config: AppConfig): AppConfig {
  config.javDb = {
    ...config.javDb,
    baseUrl: normalizeJavDbApiBaseUrl(getBaseEndpoint(config.javDb.baseUrl)) ?? getBaseEndpoint(),
    mirrorUrls: normalizeJavDbApiBaseUrls(config.javDb.mirrorUrls),
  };

  config.telemetry = {
    ...config.telemetry,
    endpoint: nonEmptyOrDefault(config.telemetry.endpoint, defaultTelemetryEndpoint),
  };

  config.subtitle = {
    ...config.subtitle,
    enabled: config.subtitle.enabled !== false,
    baseUrl: nonEmptyOrDefault(config.subtitle.baseUrl, "https://www.subtitlecat.com"),
    requestTimeout: Number.isFinite(config.subtitle.requestTimeout) && config.subtitle.requestTimeout > 0
      ? config.subtitle.requestTimeout
      : 30000,
    preferredLanguages: normalizePreferredLanguages(config.subtitle.preferredLanguages),
    indexSites: normalizeSubtitleIndexSites(config.subtitle.indexSites),
  };

  if (!["en", "zh", "ja", "ko"].includes(config.console.language)) {
    config.console.language = "en";
  }
  return config;
}

function nonEmptyOrDefault(value: string, fallback: string): string {
  const trimmed = String(value ?? "").trim();
  return trimmed || fallback;
}

function normalizeJavDbApiBaseUrls(values: string[]): string[] {
  const result: string[] = [];
  for (const value of values ?? []) {
    const normalized = normalizeJavDbApiBaseUrl(value);
    if (normalized && !result.includes(normalized)) {
      result.push(normalized);
    }
  }
  return result;
}

function normalizeJavDbApiBaseUrl(value: string): string | null {
  const trimmed = String(value ?? "").trim();
  if (!trimmed) {
    return null;
  }

  try {
    const url = new URL(trimmed);
    if (/(^|\.)(javdb\d*\.com)$/i.test(url.host)) {
      return null;
    }
    url.pathname = url.pathname.replace(/\/api\/?$/i, "/").replace(/\/+$/, "");
    url.search = "";
    url.hash = "";
    return url.toString().replace(/\/+$/, "");
  } catch {
    return null;
  }
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
    JavBackend: {
      BaseUrl: config.javDb.baseUrl,
      MirrorUrls: config.javDb.mirrorUrls,
      RequestTimeout: config.javDb.requestTimeout,
      UserAgent: config.javDb.userAgent,
    },
    Subtitle: {
      Enabled: config.subtitle.enabled,
      BaseUrl: config.subtitle.baseUrl,
      RequestTimeout: config.subtitle.requestTimeout,
      UserAgent: config.subtitle.userAgent,
      SavePath: config.subtitle.savePath,
      PreferredLanguages: config.subtitle.preferredLanguages,
      IndexSites: config.subtitle.indexSites.map((site) => ({
        Name: site.name,
        BaseUrl: site.baseUrl,
        SearchPath: site.searchPath,
      })),
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
