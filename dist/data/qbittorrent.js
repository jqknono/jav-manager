"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.QBittorrentApiClient = void 0;
const models_1 = require("../models");
const httpHelper_1 = require("../utils/httpHelper");
class QBittorrentApiClient {
    config;
    http;
    sidCookie = null;
    loginTime = 0;
    appliedBaseUrl;
    appliedUserName;
    appliedPassword;
    constructor(config, httpHelper) {
        this.config = config;
        this.http = httpHelper ?? new httpHelper_1.HttpHelper();
    }
    get serviceName() {
        return "qBittorrent";
    }
    async login() {
        this.applyRuntimeConfig();
        if (!this.hasCredentials()) {
            this.sidCookie = "no-auth";
            this.loginTime = Date.now();
            return;
        }
        const form = new URLSearchParams({
            username: this.getUserName(),
            password: this.getPassword(),
        }).toString();
        const response = await this.http.request("POST", `${this.getBaseUrl()}/api/v2/auth/login`, {
            headers: { "Content-Type": "application/x-www-form-urlencoded" },
            body: form,
            timeoutMs: 10000,
        });
        if (!isOkResponse(response.text)) {
            throw new Error(`qBittorrent login rejected: ${normalizeResponseText(response.text)}`);
        }
        const sid = readSidCookie(response.headers);
        this.sidCookie = sid ?? "1";
        this.loginTime = Date.now();
    }
    async addTorrent(magnetLink, savePath, category, tags) {
        await this.ensureLoggedIn();
        const data = new FormData();
        data.append("urls", normalizeMagnetLink(magnetLink));
        if (savePath)
            data.append("savepath", savePath);
        if (category)
            data.append("category", category);
        if (tags)
            data.append("tags", tags);
        const response = await this.request("POST", `${this.getBaseUrl()}/api/v2/torrents/add`, data);
        if (!isOkResponse(response.text)) {
            throw new Error(`qBittorrent rejected torrent: ${normalizeResponseText(response.text)}`);
        }
        return true;
    }
    async addTorrentFromUrl(urls, savePath, category, tags) {
        await this.ensureLoggedIn();
        const data = new FormData();
        data.append("urls", urls.join("\n"));
        if (savePath)
            data.append("savepath", savePath);
        if (category)
            data.append("category", category);
        if (tags)
            data.append("tags", tags);
        const response = await this.request("POST", `${this.getBaseUrl()}/api/v2/torrents/add`, data);
        if (!isOkResponse(response.text)) {
            throw new Error(`qBittorrent rejected torrent URL(s): ${normalizeResponseText(response.text)}`);
        }
        return true;
    }
    async getTorrents() {
        await this.ensureLoggedIn();
        const response = await this.request("GET", `${this.getBaseUrl()}/api/v2/torrents/info`);
        return parseTorrentList(response.text);
    }
    async pause(hashes) {
        await this.ensureLoggedIn();
        const hashParam = encodeURIComponent(hashes.join("|"));
        await this.request("POST", `${this.getBaseUrl()}/api/v2/torrents/stop?hashes=${hashParam}`);
    }
    async resume(hashes) {
        await this.ensureLoggedIn();
        const hashParam = encodeURIComponent(hashes.join("|"));
        await this.request("POST", `${this.getBaseUrl()}/api/v2/torrents/start?hashes=${hashParam}`);
    }
    async delete(hashes, deleteFiles = false) {
        await this.ensureLoggedIn();
        const hashParam = encodeURIComponent(hashes.join("|"));
        await this.request("POST", `${this.getBaseUrl()}/api/v2/torrents/delete?hashes=${hashParam}&deleteFiles=${deleteFiles ? "true" : "false"}`);
    }
    async checkHealth() {
        this.applyRuntimeConfig();
        try {
            const baseUrl = this.getBaseUrl();
            if (this.hasCredentials()) {
                await this.login();
            }
            else {
                await this.request("GET", `${baseUrl}/api/v2/app/version`);
            }
            return { serviceName: this.serviceName, isHealthy: true, message: "OK", url: baseUrl };
        }
        catch (error) {
            const message = error instanceof Error ? error.message : "Unknown error";
            const baseUrl = this.config.baseUrl.trim().replace(/\/+$/, "");
            return { serviceName: this.serviceName, isHealthy: false, message, url: baseUrl };
        }
    }
    getBaseUrl() {
        const trimmed = this.config.baseUrl.trim().replace(/\/+$/, "");
        if (!trimmed) {
            throw new Error("qBittorrent.BaseUrl is empty");
        }
        return trimmed;
    }
    applyRuntimeConfig() {
        const baseUrl = this.config.baseUrl.trim().replace(/\/+$/, "");
        if (!baseUrl) {
            // Defer validation to actual request paths.
            return;
        }
        const baseChanged = this.appliedBaseUrl?.toLowerCase() !== baseUrl.toLowerCase();
        const credentialsChanged = this.appliedUserName !== this.config.userName || this.appliedPassword !== this.config.password;
        if (baseChanged) {
            this.appliedBaseUrl = baseUrl;
            this.http.setDefaultHeader("Referer", baseUrl);
        }
        if (baseChanged || credentialsChanged) {
            this.appliedUserName = this.config.userName;
            this.appliedPassword = this.config.password;
            this.sidCookie = null;
        }
    }
    hasCredentials() {
        return Boolean(this.config.userName || this.config.password);
    }
    getUserName() {
        return this.config.userName ?? "";
    }
    getPassword() {
        return this.config.password ?? "";
    }
    async ensureLoggedIn() {
        this.applyRuntimeConfig();
        if (!this.hasCredentials()) {
            this.sidCookie ??= "no-auth";
            this.loginTime = Date.now();
            return;
        }
        const thirtyMinutes = 30 * 60 * 1000;
        if (!this.sidCookie || Date.now() - this.loginTime > thirtyMinutes) {
            await this.login();
        }
    }
    async request(method, url, body) {
        const headers = {};
        if (this.sidCookie && this.sidCookie !== "no-auth") {
            headers.Cookie = `SID=${this.sidCookie}`;
        }
        const response = await this.http.request(method, url, { headers, body });
        return { text: response.text, headers: response.headers };
    }
}
exports.QBittorrentApiClient = QBittorrentApiClient;
function parseTorrentList(jsonResponse) {
    const results = [];
    const parsed = JSON.parse(jsonResponse);
    for (const item of parsed) {
        results.push({
            title: String(item.name ?? ""),
            name: item.name ? String(item.name) : undefined,
            size: Number(item.size ?? 0),
            seeders: Number(item.num_seeds ?? 0),
            leechers: Number(item.num_leechs ?? 0),
            magnetLink: String(item.magnet_uri ?? ""),
            progress: typeof item.progress === "number" ? item.progress : undefined,
            state: item.state ? String(item.state) : undefined,
            dlSpeed: Number(item.dlspeed ?? 0),
            eta: Number(item.eta ?? 0),
            sourceSite: "qBittorrent",
            hasSubtitle: false,
            hasUncensoredMarker: false,
            uncensoredMarkerType: models_1.UncensoredMarkerType.None,
            hasHd: false,
            weightScore: 0,
        });
    }
    return results;
}
function readSidCookie(headers) {
    const setCookies = typeof headers.getSetCookie === "function"
        ? headers.getSetCookie()
        : (headers.get("set-cookie") ? [headers.get("set-cookie")] : []);
    for (const raw of setCookies) {
        const match = raw.match(/SID=([^;]+)/);
        if (match) {
            return match[1];
        }
    }
    return null;
}
function normalizeMagnetLink(magnetLink) {
    return decodeHtml(magnetLink).trim();
}
function isOkResponse(responseBody) {
    const text = normalizeResponseText(responseBody);
    return text === "" || text.toLowerCase() === "ok" || text.toLowerCase() === "ok.";
}
function normalizeResponseText(responseBody) {
    return (responseBody ?? "").trim();
}
function decodeHtml(text) {
    return text.replace(/&amp;/g, "&");
}
