"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.JsonJavCacheProvider = void 0;
const promises_1 = __importDefault(require("fs/promises"));
const path_1 = __importDefault(require("path"));
const appPaths_1 = require("../utils/appPaths");
const torrentNameParser_1 = require("../utils/torrentNameParser");
class JsonJavCacheProvider {
    config;
    cacheFilePath;
    constructor(config) {
        this.config = config;
        const baseDir = (0, appPaths_1.getPreferredConfigDirectory)();
        this.cacheFilePath = resolveCacheFilePath(baseDir, config.databasePath);
    }
    async initialize() {
        const dir = path_1.default.dirname(this.cacheFilePath);
        await promises_1.default.mkdir(dir, { recursive: true });
        try {
            await promises_1.default.access(this.cacheFilePath);
        }
        catch {
            await this.writeStore({ items: {} });
        }
    }
    async get(javId) {
        const key = (0, torrentNameParser_1.normalizeJavId)(javId);
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
    async save(result) {
        const key = (0, torrentNameParser_1.normalizeJavId)(result.javId);
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
    async updateTorrents(javId, torrents) {
        const key = (0, torrentNameParser_1.normalizeJavId)(javId);
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
    async exists(javId) {
        const key = (0, torrentNameParser_1.normalizeJavId)(javId);
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
    async delete(javId) {
        const key = (0, torrentNameParser_1.normalizeJavId)(javId);
        if (!key) {
            return;
        }
        const store = await this.readStore();
        if (store.items[key]) {
            delete store.items[key];
            await this.writeStore(store);
        }
    }
    async getStatistics() {
        const store = await this.readStore();
        const expiredKeys = [];
        let torrentCount = 0;
        let lastUpdatedAt;
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
    isExpired(result) {
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
    async readStore() {
        try {
            const raw = await promises_1.default.readFile(this.cacheFilePath, "utf-8");
            if (!raw.trim()) {
                return { items: {} };
            }
            const parsed = JSON.parse(raw);
            return parsed ?? { items: {} };
        }
        catch {
            return { items: {} };
        }
    }
    async writeStore(store) {
        const dir = path_1.default.dirname(this.cacheFilePath);
        await promises_1.default.mkdir(dir, { recursive: true });
        const tmp = `${this.cacheFilePath}.tmp`;
        await promises_1.default.writeFile(tmp, JSON.stringify(store));
        await promises_1.default.rename(tmp, this.cacheFilePath);
    }
}
exports.JsonJavCacheProvider = JsonJavCacheProvider;
function sanitizeResult(result) {
    result.actors ??= [];
    result.categories ??= [];
    result.torrents ??= [];
}
function resolveCacheFilePath(baseDir, configuredPath) {
    const trimmed = (configuredPath ?? "").trim();
    if (trimmed) {
        const ext = path_1.default.extname(trimmed).toLowerCase();
        let target = trimmed;
        if (ext === ".db") {
            target = trimmed.replace(/\.db$/i, ".json");
        }
        if (!path_1.default.isAbsolute(target)) {
            return path_1.default.join(baseDir, target);
        }
        return target;
    }
    return path_1.default.join(baseDir, "jav_cache.json");
}
async function getFileSize(filePath) {
    try {
        const stat = await promises_1.default.stat(filePath);
        return stat.size;
    }
    catch {
        return 0;
    }
}
