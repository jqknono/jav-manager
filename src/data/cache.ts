import fs from "fs/promises";
import path from "path";
import { LocalCacheConfig } from "../config";
import { IJavLocalCacheProvider } from "../interfaces";
import { CacheStatistics, JavSearchResult, TorrentInfo } from "../models";
import { getPreferredConfigDirectory } from "../utils/appPaths";
import { normalizeJavId } from "../utils/torrentNameParser";
import { splitTitleVariants } from "../utils/titleVariants";

type CacheStore = {
  items: Record<string, JavSearchResult | null>;
};

export class JsonJavCacheProvider implements IJavLocalCacheProvider {
  private config: LocalCacheConfig;
  private cacheFilePath: string;

  constructor(config: LocalCacheConfig) {
    this.config = config;
    const baseDir = getPreferredConfigDirectory();
    this.cacheFilePath = resolveCacheFilePath(baseDir, config.databasePath);
  }

  async initialize(): Promise<void> {
    const dir = path.dirname(this.cacheFilePath);
    await fs.mkdir(dir, { recursive: true });
    try {
      await fs.access(this.cacheFilePath);
    } catch {
      await this.writeStore({ items: {} });
    }
  }

  async get(javId: string): Promise<JavSearchResult | null> {
    const key = normalizeJavId(javId);
    if (!key) {
      return null;
    }

    const store = await this.readStore();
    const value = store.items[key];
    if (!value) {
      return null;
    }

    if (this.isExpired(value)) {
      delete store.items[key];
      await this.writeStore(store);
      return null;
    }

    sanitizeResult(value);
    value.javId = key;
    value.dataSource = "Local";
    return value;
  }

  async save(result: JavSearchResult): Promise<void> {
    const key = normalizeJavId(result.javId);
    if (!key) {
      throw new Error("JavId is required.");
    }

    const now = new Date().toISOString();
    result.javId = key;
    result.cachedAt = now;
    sanitizeResult(result);

    const store = await this.readStore();
    store.items[key] = result;
    await this.writeStore(store);
  }

  async updateTorrents(javId: string, torrents: TorrentInfo[]): Promise<void> {
    const key = normalizeJavId(javId);
    if (!key) {
      return;
    }

    const store = await this.readStore();
    const existing = store.items[key];
    if (!existing) {
      return;
    }

    existing.torrents = torrents ?? [];
    existing.cachedAt = new Date().toISOString();
    sanitizeResult(existing);
    store.items[key] = existing;
    await this.writeStore(store);
  }

  async exists(javId: string): Promise<boolean> {
    const key = normalizeJavId(javId);
    if (!key) {
      return false;
    }

    const store = await this.readStore();
    const value = store.items[key];
    if (!value) {
      return false;
    }

    if (this.isExpired(value)) {
      delete store.items[key];
      await this.writeStore(store);
      return false;
    }

    return true;
  }

  async delete(javId: string): Promise<void> {
    const key = normalizeJavId(javId);
    if (!key) {
      return;
    }

    const store = await this.readStore();
    if (store.items[key]) {
      delete store.items[key];
      await this.writeStore(store);
    }
  }

  async getStatistics(): Promise<CacheStatistics> {
    const store = await this.readStore();
    const expiredKeys: string[] = [];
    let torrentCount = 0;
    let lastUpdatedAt: string | undefined;

    for (const [key, item] of Object.entries(store.items)) {
      if (!item) {
        expiredKeys.push(key);
        continue;
      }

      if (this.isExpired(item)) {
        expiredKeys.push(key);
        continue;
      }

      sanitizeResult(item);
      torrentCount += item.torrents.length;
      if (item.cachedAt && (!lastUpdatedAt || item.cachedAt > lastUpdatedAt)) {
        lastUpdatedAt = item.cachedAt;
      }
    }

    if (expiredKeys.length) {
      for (const key of expiredKeys) {
        delete store.items[key];
      }
      await this.writeStore(store);
    }

    const size = await getFileSize(this.cacheFilePath);
    return {
      totalJavCount: Object.keys(store.items).length,
      totalTorrentCount: torrentCount,
      databaseSizeBytes: size,
      lastUpdatedAt,
    };
  }

  private isExpired(result: JavSearchResult): boolean {
    const days = this.config.cacheExpirationDays;
    if (days <= 0) {
      return false;
    }
    if (!result.cachedAt) {
      return false;
    }
    const cutoff = Date.now() - days * 24 * 60 * 60 * 1000;
    return new Date(result.cachedAt).getTime() < cutoff;
  }

  private async readStore(): Promise<CacheStore> {
    try {
      const raw = await fs.readFile(this.cacheFilePath, "utf-8");
      if (!raw.trim()) {
        return { items: {} };
      }
      const parsed = JSON.parse(raw) as CacheStore;
      return parsed ?? { items: {} };
    } catch {
      return { items: {} };
    }
  }

  private async writeStore(store: CacheStore): Promise<void> {
    const dir = path.dirname(this.cacheFilePath);
    await fs.mkdir(dir, { recursive: true });
    const tmp = `${this.cacheFilePath}.tmp`;
    await fs.writeFile(tmp, JSON.stringify(store));
    await fs.rename(tmp, this.cacheFilePath);
  }
}

function sanitizeResult(result: JavSearchResult): void {
  result.actors ??= [];
  result.categories ??= [];
  result.torrents ??= [];

  // Back-compat: older cache entries stored a combined zh+original title string
  // with a "show original title" marker. Split it into separate fields.
  if (!result.titleZh && typeof result.title === "string") {
    const { title, titleZh } = splitTitleVariants(result.title);
    // Only treat it as a split if we actually extracted both.
    if (titleZh && title && title !== result.title) {
      result.title = title;
      result.titleZh = titleZh;
    }
  }
}

function resolveCacheFilePath(baseDir: string, configuredPath: string): string {
  const trimmed = (configuredPath ?? "").trim();
  if (trimmed) {
    const ext = path.extname(trimmed).toLowerCase();
    let target = trimmed;
    if (ext === ".db") {
      target = trimmed.replace(/\.db$/i, ".json");
    }
    if (!path.isAbsolute(target)) {
      return path.join(baseDir, target);
    }
    return target;
  }
  return path.join(baseDir, "jav_cache.json");
}

async function getFileSize(filePath: string): Promise<number> {
  try {
    const stat = await fs.stat(filePath);
    return stat.size;
  } catch {
    return 0;
  }
}
