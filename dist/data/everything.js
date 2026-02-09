"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.EverythingHttpClient = void 0;
const models_1 = require("../models");
const httpHelper_1 = require("../utils/httpHelper");
class EverythingHttpClient {
    config;
    http;
    constructor(config, httpHelper) {
        this.config = config;
        this.http = httpHelper ?? new httpHelper_1.HttpHelper();
    }
    get serviceName() {
        return "Everything";
    }
    async search(searchTerm) {
        this.applyRuntimeConfig();
        const baseUrl = this.getBaseUrl();
        const query = encodeURIComponent(searchTerm);
        const url = `${baseUrl}/?s=${query}&json=1&path_column=1&size_column=1&date_modified_column=1`;
        const response = await this.http.get(url);
        return parseSearchResponse(response);
    }
    async fileExists(javId) {
        const results = await this.search(javId);
        return results.length > 0;
    }
    async checkHealth() {
        this.applyRuntimeConfig();
        try {
            const baseUrl = this.getBaseUrl();
            const url = `${baseUrl}/?s=test&json=1&count=1`;
            const response = await this.http.get(url, undefined, 3000);
            const parsed = JSON.parse(response);
            if (!Array.isArray(parsed.results)) {
                return { serviceName: this.serviceName, isHealthy: false, message: "Missing results field", url: baseUrl };
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
            throw new Error("Everything.BaseUrl is empty");
        }
        return trimmed;
    }
    applyRuntimeConfig() {
        if (this.config.userName) {
            this.http.setBasicAuth(this.config.userName, this.config.password ?? "");
        }
        else {
            this.http.removeDefaultHeader("Authorization");
        }
    }
}
exports.EverythingHttpClient = EverythingHttpClient;
function parseSearchResponse(jsonResponse) {
    const results = [];
    const parsed = JSON.parse(jsonResponse);
    if (!parsed.results || !Array.isArray(parsed.results)) {
        return results;
    }
    for (const item of parsed.results) {
        const name = typeof item.name === "string" ? item.name : "";
        const pathValue = typeof item.path === "string" ? item.path : "";
        const size = parseEverythingSize(item.size);
        const modifiedTicks = typeof item.date_modified === "number" ? item.date_modified : 0;
        const fileType = determineFileType(name);
        results.push({
            fileName: name,
            fullPath: pathValue ? `${pathValue}\\${name}` : name,
            size,
            modifiedDate: parseEverythingDateModified(modifiedTicks),
            fileType,
        });
    }
    return results;
}
function parseEverythingSize(value) {
    if (typeof value === "number" && Number.isFinite(value) && value >= 0) {
        return Math.floor(value);
    }
    if (typeof value === "string") {
        const normalized = value.trim().replace(/[,_\s]/g, "");
        if (!normalized) {
            return 0;
        }
        const parsed = Number(normalized);
        if (Number.isFinite(parsed) && parsed >= 0) {
            return Math.floor(parsed);
        }
    }
    return 0;
}
function parseEverythingDateModified(value) {
    if (!value || value <= 0) {
        return "";
    }
    const minUnixSeconds = Math.floor(Date.now() / 1000) - 1000000000;
    const maxUnixSeconds = Math.floor(Date.now() / 1000) + 1000000000;
    if (value >= minUnixSeconds && value <= maxUnixSeconds) {
        return new Date(value * 1000).toISOString();
    }
    const minUnixMs = Date.now() - 1000000000000;
    const maxUnixMs = Date.now() + 1000000000000;
    if (value >= minUnixMs && value <= maxUnixMs) {
        return new Date(value).toISOString();
    }
    const fileTimeMs = value / 10000 - 11644473600000;
    if (!Number.isNaN(fileTimeMs) && fileTimeMs > 0) {
        return new Date(fileTimeMs).toISOString();
    }
    return "";
}
function determineFileType(fileName) {
    const extension = fileName.toLowerCase().split(".").pop() ?? "";
    const videoExtensions = new Set(["mp4", "mkv", "avi", "wmv", "mov", "flv", "webm", "m4v"]);
    if (videoExtensions.has(extension)) {
        return models_1.FileType.Video;
    }
    if (extension === "torrent") {
        return models_1.FileType.Torrent;
    }
    return models_1.FileType.Folder;
}
