"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.runCli = runCli;
const promises_1 = __importDefault(require("node:readline/promises"));
const node_process_1 = require("node:process");
const config_1 = require("./config");
const appInfo_1 = require("./utils/appInfo");
const torrentNameParser_1 = require("./utils/torrentNameParser");
const sizeParser_1 = require("./utils/sizeParser");
const curlImpersonateFetcher_1 = require("./data/curlImpersonateFetcher");
const cliDisplay_1 = require("./utils/cliDisplay");
const LOCAL_PAGE_SIZE = 10;
async function runCli(context, args) {
    const { loc, services } = context;
    if (services.cacheProvider) {
        await services.cacheProvider.initialize();
    }
    // Fire-and-forget: populate service availability as early as possible (like the C# CLI startup health check).
    void services.healthCheckService
        .checkAll()
        .then((results) => services.serviceAvailability.updateFrom(results))
        .catch(() => undefined);
    if (args.length > 0) {
        await runCommand(context, args, true);
        return;
    }
    (0, cliDisplay_1.printBanner)(appInfo_1.AppName, (0, appInfo_1.getVersion)());
    (0, cliDisplay_1.printInfo)(loc.get("prompt_input"));
    while (true) {
        const line = (await askLine((0, cliDisplay_1.getPrompt)())).trim();
        if (!line) {
            continue;
        }
        if (["quit", "q", "exit"].includes(line.toLowerCase())) {
            break;
        }
        const tokens = splitArgs(line);
        await runCommand(context, tokens, false);
    }
}
async function runCommand(context, args, autoConfirm) {
    const { loc, services } = context;
    const cmdRaw = args[0] ?? "";
    const cmd = cmdRaw.toLowerCase();
    // Align with C# CLI: support "--id <JAVID>" in addition to passing JAV ID directly.
    if (cmd === "--id") {
        const javId = (0, torrentNameParser_1.normalizeJavId)(args[1] ?? "");
        await handleSearch(context, javId, autoConfirm, false);
        return;
    }
    if (cmd === "--test-curl" || cmd === "tc") {
        await runTestCurl(context);
        return;
    }
    if (["help", "h", "--help", "-h"].includes(cmd)) {
        showHelp(loc);
        return;
    }
    if (["version", "v", "--version", "-v"].includes(cmd)) {
        (0, cliDisplay_1.printInfo)(`${appInfo_1.AppName} ${(0, appInfo_1.getVersion)()}`);
        return;
    }
    if (cmd === "lang" || cmd === "language" || cmd === "lg") {
        if (args.length < 2) {
            (0, cliDisplay_1.printInfo)(loc.get("help_lang"));
            return;
        }
        const raw = String(args[1] ?? "").trim().toLowerCase();
        const language = raw === "zh" ? "zh" : raw === "ja" ? "ja" : raw === "ko" ? "ko" : "en";
        loc.setLanguage(language);
        (0, cliDisplay_1.printSuccess)(`Language: ${language}`);
        return;
    }
    if (cmd === "cs") {
        await handleConfigCommand(context, ["show"]);
        return;
    }
    if (cmd === "cfg" || cmd === "config" || cmd === "cf") {
        await handleConfigCommand(context, args.slice(1));
        return;
    }
    if (cmd === "health" || cmd === "hc") {
        const results = await services.healthCheckService.checkAll();
        services.serviceAvailability.updateFrom(results);
        (0, cliDisplay_1.printHealthResults)(results.map((r) => ({
            name: r.serviceName,
            healthy: r.isHealthy,
            message: r.message,
        })));
        return;
    }
    if (cmd === "cache" || cmd === "c") {
        const stats = await services.javSearchService.getCacheStatistics();
        if (!stats) {
            (0, cliDisplay_1.printWarning)(loc.get("cache_disabled"));
            return;
        }
        (0, cliDisplay_1.printCacheStats)(stats.totalJavCount, stats.totalTorrentCount, stats.databaseSizeBytes);
        return;
    }
    if (cmd === "downloads" || cmd === "t" || cmd === "downloading" || cmd === "d") {
        let torrents = [];
        try {
            torrents = await services.downloadService.getDownloads();
        }
        catch (error) {
            const message = error instanceof Error ? error.message : "Unknown error";
            (0, cliDisplay_1.printError)(message);
            return;
        }
        const downloadingOnly = cmd === "d" || cmd === "downloading";
        const filtered = downloadingOnly
            ? torrents.filter((t) => t.state && /downloading|stalleddl|metadl/i.test(t.state))
            : torrents;
        (0, cliDisplay_1.printDownloadList)(filtered.map((t) => ({
            name: t.name ?? t.title,
            size: (0, cliDisplay_1.formatSize)(t.size),
            state: t.state ?? "unknown",
        })));
        return;
    }
    if (cmd === "local" || cmd === "l") {
        if (args.length < 2) {
            (0, cliDisplay_1.printInfo)(loc.get("help_local"));
            return;
        }
        const { query, minBytes } = parseLocalArgs(args.slice(1));
        if (!query) {
            (0, cliDisplay_1.printInfo)(loc.get("help_local"));
            return;
        }
        const normalized = (0, torrentNameParser_1.normalizeJavId)(query);
        let results = [];
        try {
            results = await services.everythingProvider.search(normalized);
        }
        catch (error) {
            const message = error instanceof Error ? error.message : "Unknown error";
            (0, cliDisplay_1.printError)(message);
            return;
        }
        const filtered = results.filter((file) => (minBytes ? file.size >= minBytes : true));
        if (!filtered.length) {
            (0, cliDisplay_1.printWarning)(loc.get("no_search_results"));
            return;
        }
        const localRows = filtered.map((f) => ({
            name: f.fileName,
            size: (0, cliDisplay_1.formatSize)(f.size),
            path: f.fullPath,
        }));
        if (autoConfirm) {
            const totalPages = Math.max(1, Math.ceil(localRows.length / LOCAL_PAGE_SIZE));
            (0, cliDisplay_1.printLocalFiles)(localRows.slice(0, LOCAL_PAGE_SIZE), {
                startIndex: 0,
                totalCount: localRows.length,
                page: 1,
                totalPages,
            });
            if (localRows.length > LOCAL_PAGE_SIZE) {
                (0, cliDisplay_1.printInfo)(`Showing first ${LOCAL_PAGE_SIZE} of ${localRows.length}. Run interactive mode for pagination.`);
            }
            return;
        }
        await showLocalFilesPaged(localRows);
        return;
    }
    if (cmd === "remote" || cmd === "r") {
        const javId = (0, torrentNameParser_1.normalizeJavId)(args.slice(1).join(" "));
        await handleSearch(context, javId, autoConfirm, true);
        return;
    }
    if (cmd === "search" || cmd === "s" || cmd === "j") {
        const javId = (0, torrentNameParser_1.normalizeJavId)(args.slice(1).join(" "));
        await handleSearch(context, javId, autoConfirm, false);
        return;
    }
    if (cmd) {
        await handleSearch(context, (0, torrentNameParser_1.normalizeJavId)(args.join(" ")), autoConfirm, false);
    }
}
async function handleSearch(context, javId, autoConfirm, forceRemote) {
    const { loc, services } = context;
    if (!(0, torrentNameParser_1.isValidJavId)(javId)) {
        (0, cliDisplay_1.printError)(loc.getFormat("invalid_jav_id", javId));
        return;
    }
    (0, cliDisplay_1.printSearching)(javId);
    services.telemetryService.trackSearch(javId);
    let candidates = [];
    if (!forceRemote && services.cacheProvider) {
        const cached = await services.cacheProvider.get(javId);
        if (cached && cached.torrents.length > 0) {
            candidates = [cached];
        }
    }
    if (candidates.length === 0) {
        try {
            candidates = await services.javDbProvider.searchCandidates(javId);
        }
        catch (error) {
            const message = error instanceof Error ? error.message : "Unknown error";
            (0, cliDisplay_1.printError)(message);
            return;
        }
    }
    if (candidates.length === 0) {
        (0, cliDisplay_1.printWarning)(loc.get("no_search_results"));
        return;
    }
    (0, cliDisplay_1.printSearchResultList)(javId, candidates.map((item) => ({
        javId: item.javId || (0, torrentNameParser_1.normalizeJavId)(item.title),
        title: item.title,
        source: item.dataSource,
    })));
    const selectedCandidateIndex = autoConfirm ? 1 : await promptIndex(candidates.length);
    if (!selectedCandidateIndex) {
        return;
    }
    const selectedCandidate = candidates[selectedCandidateIndex - 1];
    let detail = selectedCandidate;
    if (!detail.torrents.length) {
        if (!detail.detailUrl) {
            (0, cliDisplay_1.printWarning)(loc.get("no_torrents_found"));
            return;
        }
        try {
            detail = await services.javDbProvider.getDetail(detail.detailUrl);
        }
        catch (error) {
            const message = error instanceof Error ? error.message : "Unknown error";
            (0, cliDisplay_1.printError)(message);
            return;
        }
    }
    if (!detail.javId) {
        detail.javId = javId;
    }
    detail = await enrichJavInfoFieldsForTelemetry(services, detail, javId);
    services.telemetryClient.tryReport(detail);
    if (services.cacheProvider && detail.torrents.length > 0) {
        try {
            await services.cacheProvider.save(detail);
        }
        catch {
            // Keep main flow running even when cache write fails.
        }
    }
    const torrentsWithMarkerFallback = detail.torrents.map((torrent) => ({
        ...torrent,
        hasUncensoredMarker: torrent.hasUncensoredMarker || /-(?:UC|U)(?=$|[^A-Za-z0-9])/i.test(torrent.title),
    }));
    const sortedTorrents = services.torrentSelectionService.getSortedTorrents(torrentsWithMarkerFallback);
    if (sortedTorrents.length === 0) {
        (0, cliDisplay_1.printWarning)(loc.get("no_torrents_found"));
        return;
    }
    (0, cliDisplay_1.printTorrentList)(detail.javId, sortedTorrents.map((t) => ({
        title: t.title,
        size: (0, cliDisplay_1.formatSize)(t.size),
        tags: buildTags(t, loc),
    })), buildTagLegend(loc));
    const selected = autoConfirm ? 1 : await promptIndex(sortedTorrents.length);
    if (!selected) {
        return;
    }
    const selectedTorrent = sortedTorrents[selected - 1];
    const processResult = await services.javSearchService.processSelectedTorrent(detail.javId, selectedTorrent, false);
    if (processResult.localFilesFound) {
        (0, cliDisplay_1.printLocalFiles)(processResult.localFiles.map((f) => ({
            name: f.fileName,
            size: (0, cliDisplay_1.formatSize)(f.size),
            path: f.fullPath,
        })));
        if (!autoConfirm) {
            const proceed = await promptYesNo("Download anyway? (y/N) ");
            if (!proceed) {
                return;
            }
            await services.javSearchService.processSelectedTorrent(detail.javId, selectedTorrent, true);
        }
        return;
    }
    if (processResult.downloaded) {
        services.telemetryService.trackDownload(detail.javId);
        (0, cliDisplay_1.printSuccess)(loc.get("download_added"));
        return;
    }
    if (processResult.magnetLink) {
        (0, cliDisplay_1.printMagnetLink)(loc.get("download_failed"), processResult.magnetLink);
    }
}
function buildTags(t, _loc) {
    const hasUncensored = t.hasUncensoredMarker || /-(?:UC|U)(?=$|[^A-Za-z0-9])/i.test(t.title);
    const tags = [];
    if (t.hasSubtitle) {
        tags.push("SUB");
    }
    if (hasUncensored) {
        tags.push("UC");
    }
    if (t.hasHd) {
        tags.push("HD");
    }
    return tags;
}
function buildTagLegend(loc) {
    if (loc.currentLocale === "zh") {
        return "说明: UC=无码, SUB=字幕, HD=高清";
    }
    return "Legend: UC=Uncensored, SUB=Subtitles, HD=High Definition";
}
function showHelp(loc) {
    const isZh = loc.currentLocale === "zh";
    const commands = [
        { cmd: "<JAV-ID> / j <id>", desc: isZh ? "搜索并下载" : "Search and download", category: isZh ? "搜索" : "Search" },
        { cmd: "search <id> / s", desc: isZh ? "搜索并下载" : "Search and download", category: isZh ? "搜索" : "Search" },
        { cmd: "remote <id> / r", desc: isZh ? "仅远端搜索 (跳过缓存)" : "Search JavDB only (skip cache)", category: isZh ? "搜索" : "Search" },
        { cmd: "local <query> / l", desc: isZh ? "本地文件搜索" : "Search local files via Everything", category: isZh ? "搜索" : "Search" },
        { cmd: "downloads / t", desc: isZh ? "下载列表" : "List all torrents", category: isZh ? "下载" : "Downloads" },
        { cmd: "downloading / d", desc: isZh ? "下载中列表" : "List active downloads only", category: isZh ? "下载" : "Downloads" },
        { cmd: "cache / c", desc: isZh ? "缓存统计" : "Show cache statistics", category: isZh ? "系统" : "System" },
        { cmd: "health / hc", desc: isZh ? "健康检查" : "Check service health", category: isZh ? "系统" : "System" },
        { cmd: "cfg show / cs", desc: isZh ? "查看配置" : "View current config", category: isZh ? "系统" : "System" },
        { cmd: "cfg set [svc] [key] [value]", desc: isZh ? "设置服务连接 (支持交互)" : "Set service connection (interactive supported)", category: isZh ? "系统" : "System" },
        { cmd: "--test-curl / tc", desc: isZh ? "curl-impersonate 诊断" : "curl-impersonate diagnostic", category: isZh ? "系统" : "System" },
        { cmd: "lang <en|zh> / lg", desc: isZh ? "切换语言" : "Switch language", category: isZh ? "其他" : "Other" },
        { cmd: "version / v", desc: isZh ? "版本信息" : "Show version", category: isZh ? "其他" : "Other" },
        { cmd: "help / h", desc: isZh ? "帮助" : "Show this help", category: isZh ? "其他" : "Other" },
        { cmd: "quit / q", desc: isZh ? "退出" : "Exit interactive mode", category: isZh ? "其他" : "Other" },
    ];
    (0, cliDisplay_1.printHelp)(commands);
}
async function promptIndex(max) {
    return promptIndexWithLabel(max, "Select #");
}
async function promptIndexWithLabel(max, label) {
    const answer = (await askLine(`  ${(0, cliDisplay_1.getPrompt)()}${label} (empty to cancel): `)).trim();
    if (!answer) {
        return null;
    }
    const value = Number(answer);
    if (!Number.isFinite(value) || value < 1 || value > max) {
        return null;
    }
    return value;
}
async function promptYesNo(message) {
    const answer = (await askLine(`  ${(0, cliDisplay_1.getPrompt)()}${message}`)).trim().toLowerCase();
    return answer === "y" || answer === "yes";
}
async function askLine(prompt) {
    const rl = promises_1.default.createInterface({ input: node_process_1.stdin, output: node_process_1.stdout });
    try {
        return await rl.question(prompt);
    }
    finally {
        rl.close();
    }
}
function splitArgs(inputLine) {
    const args = [];
    let current = "";
    let inQuotes = false;
    for (const ch of inputLine) {
        if (ch === '"') {
            inQuotes = !inQuotes;
            continue;
        }
        if (!inQuotes && /\s/.test(ch)) {
            if (current) {
                args.push(current);
                current = "";
            }
            continue;
        }
        current += ch;
    }
    if (current) {
        args.push(current);
    }
    return args;
}
function parseLocalArgs(args) {
    let minBytes = null;
    const parts = [];
    for (let i = 0; i < args.length; i += 1) {
        const token = args[i];
        if (token === "--min-size" || token === "--min" || token === "-m") {
            const candidate = args[i + 1];
            const parsed = (0, sizeParser_1.tryParseToBytes)(candidate);
            if (parsed === null) {
                return { query: "", minBytes: null };
            }
            minBytes = parsed;
            i += 1;
            continue;
        }
        parts.push(token);
    }
    return { query: parts.join(" "), minBytes };
}
async function showLocalFilesPaged(files) {
    if (files.length === 0)
        return;
    const totalPages = Math.max(1, Math.ceil(files.length / LOCAL_PAGE_SIZE));
    let page = 0;
    while (true) {
        const start = page * LOCAL_PAGE_SIZE;
        const current = files.slice(start, start + LOCAL_PAGE_SIZE);
        (0, cliDisplay_1.printLocalFiles)(current, {
            startIndex: start,
            totalCount: files.length,
            page: page + 1,
            totalPages,
        });
        if (totalPages <= 1) {
            return;
        }
        const answer = (await askLine(`  ${(0, cliDisplay_1.getPrompt)()}Page ${page + 1}/${totalPages} | n-next, p-prev, f-first, l-last, # jump, q-quit: `)).trim().toLowerCase();
        if (!answer || answer === "q" || answer === "quit" || answer === "c") {
            return;
        }
        if (/^\d+$/.test(answer)) {
            const target = Number(answer);
            if (target >= 1 && target <= totalPages) {
                page = target - 1;
            }
            else {
                (0, cliDisplay_1.printWarning)(`Page out of range: 1-${totalPages}`);
            }
            continue;
        }
        if (answer === "n" || answer === "j" || answer === "next") {
            if (page < totalPages - 1) {
                page += 1;
            }
            else {
                (0, cliDisplay_1.printWarning)("Already at last page");
            }
            continue;
        }
        if (answer === "p" || answer === "k" || answer === "prev" || answer === "previous") {
            if (page > 0) {
                page -= 1;
            }
            else {
                (0, cliDisplay_1.printWarning)("Already at first page");
            }
            continue;
        }
        if (answer === "f" || answer === "first") {
            page = 0;
            continue;
        }
        if (answer === "l" || answer === "last") {
            page = totalPages - 1;
            continue;
        }
        (0, cliDisplay_1.printWarning)("Unknown key. Use n/p/f/l/#/q");
    }
}
function maskSecret(value) {
    if (!value) {
        return "-";
    }
    if (value.length <= 2) {
        return "**";
    }
    return "*".repeat(Math.min(value.length, 8));
}
async function handleConfigCommand(context, args) {
    const { loc, config } = context;
    if (args.length === 0) {
        (0, cliDisplay_1.printInfo)(loc.get("usage_config"));
        return;
    }
    const action = (args[0] ?? "").toLowerCase();
    if (action === "show") {
        (0, cliDisplay_1.printConfig)([
            { section: "Everything", key: "BaseUrl", value: config.everything.baseUrl || "-" },
            { section: "Everything", key: "UserName", value: config.everything.userName ?? "-" },
            { section: "Everything", key: "Password", value: maskSecret(config.everything.password), masked: true },
            { section: "qBittorrent", key: "BaseUrl", value: config.qBittorrent.baseUrl || "-" },
            { section: "qBittorrent", key: "UserName", value: config.qBittorrent.userName ?? "-" },
            { section: "qBittorrent", key: "Password", value: maskSecret(config.qBittorrent.password), masked: true },
            { section: "JavDb", key: "BaseUrl", value: config.javDb.baseUrl || "-" },
        ]);
        return;
    }
    const setMode = action === "set";
    if (setMode && args.length < 4) {
        await runInteractiveConfigSet(context, args[1], args[2]);
        return;
    }
    if (!setMode && args.length < 3) {
        (0, cliDisplay_1.printInfo)(loc.get("usage_config"));
        return;
    }
    const service = normalizeConfigService(setMode ? args[1] : args[0]);
    if (!service) {
        (0, cliDisplay_1.printInfo)(loc.get("usage_config"));
        return;
    }
    const key = normalizeConfigKey(service, setMode ? args[2] : args[1]);
    if (!key) {
        (0, cliDisplay_1.printInfo)(loc.get("usage_config"));
        return;
    }
    const value = (setMode ? args.slice(3) : args.slice(2)).join(" ").trim();
    if (!value) {
        (0, cliDisplay_1.printInfo)(loc.get("usage_config"));
        return;
    }
    if (!applyConfigUpdate(config, service, key, value)) {
        (0, cliDisplay_1.printInfo)(loc.get("usage_config"));
        return;
    }
    (0, config_1.saveConfig)(config);
    (0, cliDisplay_1.printSuccess)(loc.get("config_updated"));
}
async function enrichJavInfoFieldsForTelemetry(services, detail, fallbackJavId) {
    if (!isJavInfoFieldMissing(detail)) {
        return detail;
    }
    try {
        let refreshed = null;
        const detailUrl = normalizeText(detail.detailUrl);
        if (detailUrl) {
            refreshed = await services.javDbProvider.getDetail(detailUrl);
        }
        else {
            const normalizedId = (0, torrentNameParser_1.normalizeJavId)(detail.javId || fallbackJavId);
            if (normalizedId) {
                refreshed = await services.javDbProvider.search(normalizedId);
            }
        }
        if (!refreshed) {
            return detail;
        }
        return mergeJavInfo(detail, refreshed, fallbackJavId);
    }
    catch {
        return detail;
    }
}
function isJavInfoFieldMissing(detail) {
    return !normalizeText(detail.releaseDate)
        || !normalizeText(detail.detailUrl)
        || !normalizeStringList(detail.actors).length
        || !normalizeStringList(detail.categories).length;
}
function mergeJavInfo(base, extra, fallbackJavId) {
    return {
        ...base,
        javId: (0, torrentNameParser_1.normalizeJavId)(base.javId || extra.javId || fallbackJavId),
        title: normalizeText(base.title) ?? normalizeText(extra.title) ?? "",
        coverUrl: normalizeText(base.coverUrl) ?? normalizeText(extra.coverUrl) ?? "",
        releaseDate: normalizeText(base.releaseDate) ?? normalizeText(extra.releaseDate) ?? undefined,
        duration: base.duration > 0 ? base.duration : (extra.duration > 0 ? extra.duration : 0),
        director: normalizeText(base.director) ?? normalizeText(extra.director) ?? "",
        maker: normalizeText(base.maker) ?? normalizeText(extra.maker) ?? "",
        publisher: normalizeText(base.publisher) ?? normalizeText(extra.publisher) ?? "",
        series: normalizeText(base.series) ?? normalizeText(extra.series) ?? "",
        actors: normalizeStringList(base.actors).length ? normalizeStringList(base.actors) : normalizeStringList(extra.actors),
        categories: normalizeStringList(base.categories).length ? normalizeStringList(base.categories) : normalizeStringList(extra.categories),
        torrents: base.torrents?.length ? base.torrents : extra.torrents,
        detailUrl: normalizeText(base.detailUrl) ?? normalizeText(extra.detailUrl) ?? "",
        dataSource: base.dataSource,
        cachedAt: base.cachedAt ?? extra.cachedAt,
    };
}
function normalizeText(value) {
    if (typeof value !== "string") {
        return null;
    }
    const trimmed = value.trim();
    return trimmed || null;
}
function normalizeStringList(values) {
    if (!Array.isArray(values)) {
        return [];
    }
    const set = new Set();
    for (const value of values) {
        const normalized = normalizeText(value);
        if (normalized) {
            set.add(normalized);
        }
    }
    return Array.from(set);
}
function normalizeConfigService(raw) {
    const value = (raw ?? "").toLowerCase();
    if (value === "everything" || value === "ev")
        return "everything";
    if (value === "qb" || value === "qbittorrent")
        return "qbittorrent";
    if (value === "javdb")
        return "javdb";
    return null;
}
function normalizeConfigKey(service, raw) {
    const value = (raw ?? "").toLowerCase();
    if (value === "url" || value === "baseurl")
        return "baseurl";
    if (service !== "javdb" && (value === "user" || value === "username"))
        return "username";
    if (service !== "javdb" && (value === "pass" || value === "password"))
        return "password";
    return null;
}
function applyConfigUpdate(config, service, key, value) {
    if (service === "everything") {
        if (key === "baseurl")
            config.everything.baseUrl = value;
        else if (key === "username")
            config.everything.userName = value;
        else if (key === "password")
            config.everything.password = value;
        else
            return false;
        return true;
    }
    if (service === "qbittorrent") {
        if (key === "baseurl")
            config.qBittorrent.baseUrl = value;
        else if (key === "username")
            config.qBittorrent.userName = value;
        else if (key === "password")
            config.qBittorrent.password = value;
        else
            return false;
        return true;
    }
    if (service === "javdb") {
        if (key !== "baseurl")
            return false;
        config.javDb.baseUrl = value;
        return true;
    }
    return false;
}
function getConfigValue(config, service, key) {
    if (service === "everything") {
        if (key === "baseurl")
            return config.everything.baseUrl;
        if (key === "username")
            return config.everything.userName;
        if (key === "password")
            return config.everything.password;
        return null;
    }
    if (service === "qbittorrent") {
        if (key === "baseurl")
            return config.qBittorrent.baseUrl;
        if (key === "username")
            return config.qBittorrent.userName;
        if (key === "password")
            return config.qBittorrent.password;
        return null;
    }
    if (service === "javdb") {
        return key === "baseurl" ? config.javDb.baseUrl : null;
    }
    return null;
}
async function runInteractiveConfigSet(context, serviceArg, keyArg) {
    const { loc, config } = context;
    const isZh = loc.currentLocale === "zh";
    const services = [
        { id: "everything", label: "Everything" },
        { id: "qbittorrent", label: "qBittorrent" },
        { id: "javdb", label: "JavDb" },
    ];
    let service = normalizeConfigService(serviceArg);
    if (!service) {
        (0, cliDisplay_1.printInfo)(isZh ? "请选择要配置的服务:" : "Select service to configure:");
        services.forEach((item, i) => {
            console.log(`  ${i + 1}. ${item.label}`);
        });
        const serviceIdx = await promptIndexWithLabel(services.length, isZh ? "服务序号" : "Service #");
        if (!serviceIdx) {
            return;
        }
        service = services[serviceIdx - 1].id;
    }
    const keys = getConfigKeysForService(service);
    let key = normalizeConfigKey(service, keyArg);
    if (!key) {
        (0, cliDisplay_1.printInfo)(isZh ? "请选择要修改的配置项:" : "Select key to update:");
        const currentLabel = isZh ? "当前值" : "current";
        keys.forEach((item, i) => {
            const current = getConfigValue(config, service, item.key);
            const display = item.key === "password" ? maskSecret(current) : (current || "-");
            console.log(`  ${i + 1}. ${item.label} (${currentLabel}: ${display})`);
        });
        const keyIdx = await promptIndexWithLabel(keys.length, isZh ? "配置项序号" : "Key #");
        if (!keyIdx) {
            return;
        }
        key = keys[keyIdx - 1].key;
    }
    const currentValue = getConfigValue(config, service, key);
    const currentDisplay = key === "password" ? maskSecret(currentValue) : (currentValue || "-");
    const valuePrompt = isZh
        ? `输入新值 (当前: ${currentDisplay}, 留空取消): `
        : `Enter new value (current: ${currentDisplay}, empty to cancel): `;
    const newValue = (await askLine(`  ${(0, cliDisplay_1.getPrompt)()}${valuePrompt}`)).trim();
    if (!newValue) {
        return;
    }
    const confirm = await promptYesNo(isZh
        ? `确认更新 ${service}.${key} ? (y/N) `
        : `Apply update to ${service}.${key}? (y/N) `);
    if (!confirm) {
        return;
    }
    if (!applyConfigUpdate(config, service, key, newValue)) {
        (0, cliDisplay_1.printInfo)(loc.get("usage_config"));
        return;
    }
    (0, config_1.saveConfig)(config);
    (0, cliDisplay_1.printSuccess)(loc.get("config_updated"));
}
function getConfigKeysForService(service) {
    if (service === "javdb") {
        return [{ key: "baseurl", label: "BaseUrl" }];
    }
    return [
        { key: "baseurl", label: "BaseUrl" },
        { key: "username", label: "UserName" },
        { key: "password", label: "Password" },
    ];
}
async function runTestCurl(context) {
    const { config } = context;
    const javDbCfg = config.javDb;
    const urls = Array.from(new Set([javDbCfg.baseUrl, ...javDbCfg.mirrorUrls]
        .map((u) => (u ?? "").trim().replace(/\/+$/, ""))
        .filter((u) => u.length > 0)));
    (0, cliDisplay_1.printHealthResults)([]); // header-like
    console.log("");
    (0, cliDisplay_1.printInfo)("JavDB curl-impersonate Diagnostic");
    console.log("");
    if (!javDbCfg.curlImpersonate.enabled) {
        (0, cliDisplay_1.printWarning)("JavDb.CurlImpersonate.Enabled is false in config.");
        (0, cliDisplay_1.printInfo)("This diagnostic still tries to call curl-impersonate directly.");
    }
    const fetcher = new curlImpersonateFetcher_1.CurlImpersonateFetcher(javDbCfg.curlImpersonate);
    let anySuccess = false;
    const cookieHeader = "over18=1; locale=zh";
    const results = [];
    for (const url of urls) {
        const result = await fetcher.get(url, null, cookieHeader, 15000);
        if (result.status >= 200 && result.status < 300) {
            anySuccess = true;
            results.push({ name: url, healthy: true, message: `HTTP ${result.status}` });
        }
        else {
            const error = result.error ? ` error=${result.error}` : "";
            results.push({ name: url, healthy: false, message: `HTTP ${result.status}${error}` });
        }
    }
    (0, cliDisplay_1.printHealthResults)(results);
    if (anySuccess) {
        (0, cliDisplay_1.printSuccess)("At least one JavDB URL is accessible via curl-impersonate.");
    }
    else {
        (0, cliDisplay_1.printError)("All JavDB URLs failed via curl-impersonate.");
    }
}
