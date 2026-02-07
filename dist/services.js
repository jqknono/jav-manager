"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.JavSearchService = exports.TelemetryService = exports.JavInfoTelemetryClient = exports.DownloadService = exports.LocalFileCheckService = exports.TorrentSelectionService = exports.HealthCheckService = exports.ServiceAvailability = void 0;
const fs_1 = __importDefault(require("fs"));
const os_1 = __importDefault(require("os"));
const models_1 = require("./models");
const weightCalculator_1 = require("./utils/weightCalculator");
const torrentNameParser_1 = require("./utils/torrentNameParser");
const appInfo_1 = require("./utils/appInfo");
const telemetryEndpoints_1 = require("./utils/telemetryEndpoints");
class ServiceAvailability {
    lock = new Object();
    everythingKnown = false;
    everythingHealthy = false;
    qBittorrentKnown = false;
    qBittorrentHealthy = false;
    javDbKnown = false;
    javDbHealthy = false;
    get localDedupAvailable() {
        return !this.everythingKnown || this.everythingHealthy;
    }
    get downloadQueueAvailable() {
        return !this.qBittorrentKnown || this.qBittorrentHealthy;
    }
    get remoteSearchAvailable() {
        return !this.javDbKnown || this.javDbHealthy;
    }
    updateFrom(results) {
        if (!results) {
            return;
        }
        const everything = results.find((r) => r.serviceName.toLowerCase().includes("everything"));
        if (everything) {
            this.everythingKnown = true;
            this.everythingHealthy = everything.isHealthy;
        }
        const qb = results.find((r) => r.serviceName.toLowerCase().includes("qbittorrent"));
        if (qb) {
            this.qBittorrentKnown = true;
            this.qBittorrentHealthy = qb.isHealthy;
        }
        const javDb = results.find((r) => r.serviceName.toLowerCase().includes("javdb"));
        if (javDb) {
            this.javDbKnown = true;
            this.javDbHealthy = javDb.isHealthy;
        }
    }
}
exports.ServiceAvailability = ServiceAvailability;
class HealthCheckService {
    checkers;
    loc;
    constructor(checkers, loc) {
        this.checkers = checkers;
        this.loc = loc;
    }
    async checkAll() {
        const tasks = this.checkers.map(async (checker) => {
            try {
                return await checker.checkHealth();
            }
            catch (error) {
                const message = error instanceof Error ? error.message : "Unknown error";
                return { serviceName: checker.serviceName, isHealthy: false, message: message || this.loc.get("health_fail") };
            }
        });
        return Promise.all(tasks);
    }
}
exports.HealthCheckService = HealthCheckService;
class TorrentSelectionService {
    hideOtherTorrents;
    constructor(hideOtherTorrents) {
        this.hideOtherTorrents = hideOtherTorrents;
    }
    selectBest(torrents) {
        if (torrents.length === 0) {
            return null;
        }
        return this.getSortedTorrents(torrents)[0] ?? null;
    }
    getSortedTorrents(torrents) {
        if (torrents.length === 0) {
            return torrents;
        }
        const sorted = (0, weightCalculator_1.calculateAndSort)(torrents);
        if (!this.hideOtherTorrents) {
            return sorted;
        }
        return sorted.filter((torrent) => torrent.hasUncensoredMarker || torrent.hasSubtitle || torrent.hasHd);
    }
}
exports.TorrentSelectionService = TorrentSelectionService;
class LocalFileCheckService {
    searchProvider;
    constructor(searchProvider) {
        this.searchProvider = searchProvider;
    }
    async checkLocalFiles(javId) {
        const normalized = (0, torrentNameParser_1.normalizeJavId)(javId);
        const results = await this.searchProvider.search(normalized);
        return results.filter((file) => file.fileType === models_1.FileType.Video);
    }
    async fileExists(javId) {
        const files = await this.checkLocalFiles(javId);
        return files.length > 0;
    }
}
exports.LocalFileCheckService = LocalFileCheckService;
class DownloadService {
    qbClient;
    config;
    constructor(qbClient, config) {
        this.qbClient = qbClient;
        this.config = config;
    }
    async addDownload(torrent, savePath, category, tags) {
        const normalizedPath = normalizeExistingDirectoryPath(savePath ?? this.config.defaultSavePath);
        const finalCategory = category ?? this.config.defaultCategory;
        const finalTags = tags ?? this.config.defaultTags;
        return this.qbClient.addTorrent(torrent.magnetLink, normalizedPath ?? undefined, finalCategory, finalTags);
    }
    async getDownloads() {
        return this.qbClient.getTorrents();
    }
}
exports.DownloadService = DownloadService;
class JavInfoTelemetryClient {
    config;
    endpoint;
    constructor(config) {
        this.config = config;
        this.endpoint = (0, telemetryEndpoints_1.getJavInfoPostUrl)(config.endpoint);
    }
    tryReport(result) {
        if (!this.config.enabled) {
            return;
        }
        const javId = normalizeTelemetryText(result.javId);
        if (!javId) {
            return;
        }
        const payload = {
            jav_id: javId,
            title: normalizeTelemetryText(result.title),
            cover_url: normalizeTelemetryText(result.coverUrl),
            release_date: normalizeTelemetryDate(result.releaseDate),
            duration: result.duration > 0 ? result.duration : null,
            director: normalizeTelemetryText(result.director),
            maker: normalizeTelemetryText(result.maker),
            publisher: normalizeTelemetryText(result.publisher),
            series: normalizeTelemetryText(result.series),
            actors: normalizeTelemetryList(result.actors),
            categories: normalizeTelemetryList(result.categories),
            torrents: normalizeTelemetryTorrents(result.torrents),
            detail_url: normalizeTelemetryText(result.detailUrl),
        };
        void fetch(this.endpoint, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload),
        }).catch(() => undefined);
    }
}
exports.JavInfoTelemetryClient = JavInfoTelemetryClient;
class TelemetryService {
    enabled;
    endpoint;
    info;
    constructor(config) {
        this.enabled = config.enabled;
        this.endpoint = (0, telemetryEndpoints_1.getTelemetryPostUrl)(config.endpoint);
        this.info = {
            machineName: getMachineNameSafe(),
            userName: getUserNameSafe(),
            appVersion: (0, appInfo_1.getVersion)(),
            osInfo: getOsInfo(),
        };
    }
    trackStartup() {
        this.sendEvent("startup", null);
    }
    trackSearch(searchTerm) {
        this.sendEvent("search", searchTerm ? `term:${searchTerm}` : null);
    }
    trackDownload(javId) {
        this.sendEvent("download", javId ? `jav:${javId}` : null);
    }
    trackEvent(eventType, eventData) {
        this.sendEvent(eventType, eventData ?? null);
    }
    sendEvent(eventType, eventData) {
        if (!this.enabled) {
            return;
        }
        const payload = {
            machine_name: this.info.machineName,
            user_name: this.info.userName,
            app_version: this.info.appVersion,
            os_info: this.info.osInfo,
            event_type: eventType,
            event_data: eventData,
        };
        // Fire-and-forget: telemetry should never block main workflow.
        void fetch(this.endpoint, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload),
        }).catch(() => undefined);
    }
}
exports.TelemetryService = TelemetryService;
function getMachineNameSafe() {
    const fromEnv = process.env.COMPUTERNAME || process.env.HOSTNAME;
    if (fromEnv && fromEnv.trim()) {
        return fromEnv.trim();
    }
    try {
        const host = os_1.default.hostname();
        if (host && host.trim()) {
            return host.trim();
        }
    }
    catch {
        // ignore
    }
    return `machine-${randomId()}`;
}
function getUserNameSafe() {
    const fromEnv = process.env.USERNAME || process.env.USER;
    if (fromEnv && fromEnv.trim()) {
        return fromEnv.trim();
    }
    try {
        const user = os_1.default.userInfo().username;
        if (user && user.trim()) {
            return user.trim();
        }
    }
    catch {
        // ignore
    }
    return `user-${randomId()}`;
}
function getOsInfo() {
    try {
        return `${os_1.default.platform()} ${os_1.default.release()}`;
    }
    catch {
        return "unknown";
    }
}
function randomId() {
    return Math.random().toString(16).slice(2, 10);
}
function normalizeTelemetryText(value) {
    if (typeof value !== "string") {
        return null;
    }
    const trimmed = value.trim();
    return trimmed ? trimmed : null;
}
function normalizeTelemetryDate(value) {
    const text = normalizeTelemetryText(value);
    if (!text) {
        return null;
    }
    // Keep already-normalized YYYY-MM-DD.
    if (/^\d{4}-\d{2}-\d{2}$/.test(text)) {
        return text;
    }
    const parsed = new Date(text);
    if (Number.isNaN(parsed.getTime())) {
        return text;
    }
    return parsed.toISOString().slice(0, 10);
}
function normalizeTelemetryList(values) {
    if (!Array.isArray(values)) {
        return [];
    }
    const deduped = new Set();
    for (const value of values) {
        const normalized = normalizeTelemetryText(value);
        if (normalized) {
            deduped.add(normalized);
        }
    }
    return Array.from(deduped);
}
function normalizeTelemetryTorrents(torrents) {
    if (!Array.isArray(torrents)) {
        return [];
    }
    return torrents.map((torrent) => ({
        title: normalizeTelemetryText(torrent.title),
        magnet_link: normalizeTelemetryText(torrent.magnetLink),
        torrent_url: normalizeTelemetryText(torrent.torrentUrl),
        size: typeof torrent.size === "number" && Number.isFinite(torrent.size) ? torrent.size : 0,
        has_uncensored_marker: !!torrent.hasUncensoredMarker,
        uncensored_marker_type: normalizeTelemetryText(String(torrent.uncensoredMarkerType ?? "")),
        has_subtitle: !!torrent.hasSubtitle,
        has_hd: !!torrent.hasHd,
        seeders: typeof torrent.seeders === "number" && Number.isFinite(torrent.seeders) ? torrent.seeders : 0,
        leechers: typeof torrent.leechers === "number" && Number.isFinite(torrent.leechers) ? torrent.leechers : 0,
        source_site: normalizeTelemetryText(torrent.sourceSite),
        weight_score: typeof torrent.weightScore === "number" && Number.isFinite(torrent.weightScore) ? torrent.weightScore : 0,
    }));
}
class JavSearchService {
    javDbProvider;
    cacheProvider;
    selectionService;
    localFileService;
    downloadService;
    serviceAvailability;
    loc;
    constructor(javDbProvider, selectionService, localFileService, downloadService, serviceAvailability, loc, cacheProvider) {
        this.javDbProvider = javDbProvider;
        this.selectionService = selectionService;
        this.localFileService = localFileService;
        this.downloadService = downloadService;
        this.serviceAvailability = serviceAvailability;
        this.loc = loc;
        this.cacheProvider = cacheProvider ?? null;
    }
    async process(javId, forceDownload = false, forceRemote = false) {
        const result = createProcessResult(javId);
        let searchResult = null;
        if (!forceRemote && this.cacheProvider) {
            searchResult = await this.cacheProvider.get(javId);
            if (searchResult?.torrents?.length) {
            }
            else {
                searchResult = null;
            }
        }
        if (!searchResult) {
            if (!this.serviceAvailability.remoteSearchAvailable) {
                result.success = false;
                result.messages.push(this.loc.get("no_search_results"));
                return result;
            }
            searchResult = await this.javDbProvider.search(javId);
            if (searchResult.torrents.length === 0) {
                result.success = false;
                result.messages.push(this.loc.get("no_torrents_found"));
                return result;
            }
            if (this.cacheProvider) {
                await this.cacheProvider.save(searchResult);
            }
        }
        const selectedTorrent = this.selectionService.selectBest(searchResult.torrents);
        if (!selectedTorrent) {
            result.success = false;
            result.messages.push(this.loc.get("no_torrents_found"));
            return result;
        }
        result.selectedTorrent = selectedTorrent;
        if (!forceDownload) {
            if (!this.serviceAvailability.localDedupAvailable) {
                result.localDedupSkipped = true;
            }
            else {
                try {
                    const localFiles = await this.localFileService.checkLocalFiles(javId);
                    if (localFiles.length) {
                        result.localFilesFound = true;
                        result.localFiles = localFiles;
                        result.success = true;
                        return result;
                    }
                }
                catch {
                    result.localDedupSkipped = true;
                }
            }
        }
        if (!this.serviceAvailability.downloadQueueAvailable) {
            result.downloadQueueSkipped = true;
            result.magnetLink = selectedTorrent.magnetLink;
            result.success = true;
            result.messages.push(this.loc.get("downloader_unavailable"));
            return result;
        }
        try {
            const downloadSuccess = await this.downloadService.addDownload(selectedTorrent);
            if (downloadSuccess) {
                result.success = true;
                result.downloaded = true;
                result.messages.push(this.loc.get("download_added"));
                return result;
            }
        }
        catch {
            // Treat downloader errors as "skipped" and show magnet link for manual use.
            result.success = true;
            result.downloadQueueSkipped = true;
            result.magnetLink = selectedTorrent.magnetLink;
            result.messages.push(this.loc.get("download_failed"));
            return result;
        }
        result.success = true;
        result.downloadQueueSkipped = true;
        result.magnetLink = selectedTorrent.magnetLink;
        result.messages.push(this.loc.get("download_failed"));
        return result;
    }
    async processSelectedTorrent(javId, selectedTorrent, forceDownload = false) {
        const result = createProcessResult(javId);
        result.selectedTorrent = selectedTorrent;
        if (!forceDownload) {
            if (!this.serviceAvailability.localDedupAvailable) {
                result.localDedupSkipped = true;
            }
            else {
                try {
                    const localFiles = await this.localFileService.checkLocalFiles(javId);
                    if (localFiles.length) {
                        result.localFilesFound = true;
                        result.localFiles = localFiles;
                        result.success = true;
                        return result;
                    }
                }
                catch {
                    result.localDedupSkipped = true;
                }
            }
        }
        if (!this.serviceAvailability.downloadQueueAvailable) {
            result.downloadQueueSkipped = true;
            result.magnetLink = selectedTorrent.magnetLink;
            result.success = true;
            result.messages.push(this.loc.get("downloader_unavailable"));
            return result;
        }
        try {
            const downloadSuccess = await this.downloadService.addDownload(selectedTorrent);
            if (downloadSuccess) {
                result.success = true;
                result.downloaded = true;
                result.messages.push(this.loc.get("download_added"));
                return result;
            }
        }
        catch {
            result.success = true;
            result.downloadQueueSkipped = true;
            result.magnetLink = selectedTorrent.magnetLink;
            result.messages.push(this.loc.get("download_failed"));
            return result;
        }
        result.success = true;
        result.downloadQueueSkipped = true;
        result.magnetLink = selectedTorrent.magnetLink;
        result.messages.push(this.loc.get("download_failed"));
        return result;
    }
    async searchOnly(javId, forceRemote = false) {
        const result = createProcessResult(javId);
        let searchResult = null;
        if (!forceRemote && this.cacheProvider) {
            searchResult = await this.cacheProvider.get(javId);
        }
        if (!searchResult) {
            if (!this.serviceAvailability.remoteSearchAvailable) {
                result.success = false;
                result.messages.push(this.loc.get("no_search_results"));
                return result;
            }
            searchResult = await this.javDbProvider.search(javId);
            if (searchResult.torrents.length === 0) {
                result.success = false;
                result.messages.push(this.loc.get("no_torrents_found"));
                return result;
            }
            if (this.cacheProvider) {
                await this.cacheProvider.save(searchResult);
            }
        }
        result.availableTorrents = this.selectionService.getSortedTorrents(searchResult.torrents);
        result.searchResult = searchResult;
        result.success = result.availableTorrents.length > 0;
        return result;
    }
    async getCacheStatistics() {
        if (!this.cacheProvider) {
            return null;
        }
        return this.cacheProvider.getStatistics();
    }
}
exports.JavSearchService = JavSearchService;
function normalizeExistingDirectoryPath(pathValue) {
    if (!pathValue) {
        return null;
    }
    const expanded = pathValue.trim();
    if (!expanded) {
        return null;
    }
    const resolved = expanded.replace(/%([^%]+)%/g, (_, name) => process.env[name] ?? "");
    if (!fs_1.default.existsSync(resolved)) {
        return null;
    }
    const stat = fs_1.default.statSync(resolved);
    return stat.isDirectory() ? resolved : null;
}
function createProcessResult(javId) {
    return {
        javId,
        success: false,
        downloaded: false,
        localFilesFound: false,
        localDedupSkipped: false,
        downloadQueueSkipped: false,
        localFiles: [],
        availableTorrents: [],
        messages: [],
    };
}
