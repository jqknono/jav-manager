"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.normalizeDomainOrUrlToHttpsUrl = normalizeDomainOrUrlToHttpsUrl;
exports.mergeMirrorUrls = mergeMirrorUrls;
exports.fetchLatestJavDbDomains = fetchLatestJavDbDomains;
const backendEndpoints_1 = require("./backendEndpoints");
function normalizeDomainOrUrlToHttpsUrl(input) {
    const raw = (input ?? "").trim();
    if (!raw)
        return null;
    if (/^https?:\/\//i.test(raw)) {
        return raw.replace(/\/+$/, "");
    }
    // Treat as domain.
    const domain = raw.replace(/^\/*/, "").replace(/\/+$/, "");
    if (!domain)
        return null;
    return `https://${domain}`;
}
function mergeMirrorUrls(existing, domainsOrUrls) {
    const normalizedNew = domainsOrUrls
        .map((d) => normalizeDomainOrUrlToHttpsUrl(d))
        .filter((d) => !!d);
    const normalizedExisting = (existing ?? [])
        .map((u) => normalizeDomainOrUrlToHttpsUrl(u))
        .filter((u) => !!u);
    const seen = new Set();
    const out = [];
    for (const u of normalizedNew) {
        const key = u.toLowerCase();
        if (seen.has(key))
            continue;
        seen.add(key);
        out.push(u);
    }
    for (const u of normalizedExisting) {
        const key = u.toLowerCase();
        if (seen.has(key))
            continue;
        seen.add(key);
        out.push(u);
    }
    return out;
}
async function fetchLatestJavDbDomains(telemetryEndpoint, fetchImpl = fetch) {
    const base = (0, backendEndpoints_1.getBaseEndpoint)(telemetryEndpoint);
    const apiUrl = `${base}/api/javdb-domain`;
    const resp = await fetchImpl(apiUrl, {
        headers: {
            "User-Agent": "jav-manager",
            Accept: "application/json",
        },
        signal: typeof AbortSignal !== "undefined" && "timeout" in AbortSignal
            ? AbortSignal.timeout(10000)
            : undefined,
    });
    if (!resp.ok) {
        throw new Error(`HTTP ${resp.status}`);
    }
    const json = (await resp.json());
    if (!json || json.success !== true) {
        const msg = (json && (json.message || json.error)) ? String(json.message || json.error) : "Unknown error";
        throw new Error(msg);
    }
    const domains = Array.isArray(json.domains) ? json.domains.map(String) : [];
    if (domains.length === 0) {
        throw new Error("Empty domains");
    }
    return { apiUrl, domains };
}
