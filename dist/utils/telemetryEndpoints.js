"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getTelemetryPostUrl = getTelemetryPostUrl;
exports.getJavInfoPostUrl = getJavInfoPostUrl;
exports.getBaseEndpoint = getBaseEndpoint;
exports.normalizeBaseEndpointOrNull = normalizeBaseEndpointOrNull;
const DefaultBaseEndpoint = "https://jav-manager.techfetch.dev";
function getTelemetryPostUrl(endpoint) {
    return `${getBaseEndpoint(endpoint)}/api/telemetry`;
}
function getJavInfoPostUrl(endpoint) {
    return `${getBaseEndpoint(endpoint)}/api/javinfo`;
}
function getBaseEndpoint(endpoint) {
    const normalized = normalizeBaseEndpointOrNull(endpoint);
    return normalized || DefaultBaseEndpoint;
}
function normalizeBaseEndpointOrNull(endpoint) {
    if (!endpoint || !String(endpoint).trim()) {
        return null;
    }
    const raw = String(endpoint).trim();
    let parsed;
    try {
        parsed = new URL(raw);
    }
    catch {
        return raw.replace(/\/+$/, "");
    }
    let path = parsed.pathname.replace(/\/+$/, "");
    if (path.toLowerCase().endsWith("/api/telemetry")) {
        path = path.slice(0, -"/api/telemetry".length);
    }
    else if (path.toLowerCase().endsWith("/api/javinfo")) {
        path = path.slice(0, -"/api/javinfo".length);
    }
    else if (path.toLowerCase().endsWith("/api")) {
        path = path.slice(0, -"/api".length);
    }
    parsed.pathname = path.replace(/\/+$/, "") || "/";
    parsed.search = "";
    parsed.hash = "";
    return parsed.toString().replace(/\/+$/, "");
}
