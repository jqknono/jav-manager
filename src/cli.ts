import readline from "node:readline/promises";
import { stdin as input, stdout as output } from "node:process";
import { AppContext } from "./context";
import { LocalizationService } from "./localization";
import { JavSearchResult } from "./models";
import { saveConfig } from "./config";
import { AppName, getVersion } from "./utils/appInfo";
import { isValidJavId, normalizeJavId } from "./utils/torrentNameParser";
import { tryParseToBytes } from "./utils/sizeParser";
import { CurlImpersonateFetcher } from "./data/curlImpersonateFetcher";
import {
  printBanner,
  printHelp,
  printSearchResultList,
  printTorrentList,
  printHealthResults,
  printConfig,
  printCacheStats,
  printDownloadList,
  printLocalFiles,
  printSearching,
  printSuccess,
  printError,
  printWarning,
  printInfo,
  printMagnetLink,
  getPrompt,
  formatSize,
} from "./utils/cliDisplay";

const LOCAL_PAGE_SIZE = 10;

export async function runCli(context: AppContext, args: string[]): Promise<void> {
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

  printBanner(AppName, getVersion());
  printInfo(loc.get("prompt_input"));

  while (true) {
    const line = (await askLine(getPrompt())).trim();
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

async function runCommand(context: AppContext, args: string[], autoConfirm: boolean): Promise<void> {
  const { loc, services } = context;
  const cmdRaw = args[0] ?? "";
  const cmd = cmdRaw.toLowerCase();

  // Align with C# CLI: support "--id <JAVID>" in addition to passing JAV ID directly.
  if (cmd === "--id") {
    const javId = normalizeJavId(args[1] ?? "");
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
    printInfo(`${AppName} ${getVersion()}`);
    return;
  }

  if (cmd === "lang" || cmd === "language" || cmd === "lg") {
    if (args.length < 2) {
      printInfo(loc.get("help_lang"));
      return;
    }

    const language = args[1] === "zh" ? "zh" : "en";
    loc.setLanguage(language);
    printSuccess(`Language: ${language}`);
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
    printHealthResults(
      results.map((r) => ({
        name: r.serviceName,
        healthy: r.isHealthy,
        message: r.message,
      }))
    );
    return;
  }

  if (cmd === "cache" || cmd === "c") {
    const stats = await services.javSearchService.getCacheStatistics();
    if (!stats) {
      printWarning(loc.get("cache_disabled"));
      return;
    }
    printCacheStats(stats.totalJavCount, stats.totalTorrentCount, stats.databaseSizeBytes);
    return;
  }

  if (cmd === "downloads" || cmd === "t" || cmd === "downloading" || cmd === "d") {
    let torrents = [];
    try {
      torrents = await services.downloadService.getDownloads();
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error";
      printError(message);
      return;
    }
    const downloadingOnly = cmd === "d" || cmd === "downloading";
    const filtered = downloadingOnly
      ? torrents.filter((t) => t.state && /downloading|stalleddl|metadl/i.test(t.state))
      : torrents;

    printDownloadList(
      filtered.map((t) => ({
        name: t.name ?? t.title,
        size: formatSize(t.size),
        state: t.state ?? "unknown",
      }))
    );
    return;
  }

  if (cmd === "local" || cmd === "l") {
    if (args.length < 2) {
      printInfo(loc.get("help_local"));
      return;
    }
    const { query, minBytes } = parseLocalArgs(args.slice(1));
    if (!query) {
      printInfo(loc.get("help_local"));
      return;
    }

    const normalized = normalizeJavId(query);
    let results = [];
    try {
      results = await services.everythingProvider.search(normalized);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error";
      printError(message);
      return;
    }
    const filtered = results.filter((file) => (minBytes ? file.size >= minBytes : true));
    if (!filtered.length) {
      printWarning(loc.get("no_search_results"));
      return;
    }

    const localRows = filtered.map((f) => ({
      name: f.fileName,
      size: formatSize(f.size),
      path: f.fullPath,
    }));

    if (autoConfirm) {
      const totalPages = Math.max(1, Math.ceil(localRows.length / LOCAL_PAGE_SIZE));
      printLocalFiles(localRows.slice(0, LOCAL_PAGE_SIZE), {
        startIndex: 0,
        totalCount: localRows.length,
        page: 1,
        totalPages,
      });
      if (localRows.length > LOCAL_PAGE_SIZE) {
        printInfo(`Showing first ${LOCAL_PAGE_SIZE} of ${localRows.length}. Run interactive mode for pagination.`);
      }
      return;
    }

    await showLocalFilesPaged(localRows);
    return;
  }

  if (cmd === "remote" || cmd === "r") {
    const javId = normalizeJavId(args.slice(1).join(" "));
    await handleSearch(context, javId, autoConfirm, true);
    return;
  }

  if (cmd === "search" || cmd === "s" || cmd === "j") {
    const javId = normalizeJavId(args.slice(1).join(" "));
    await handleSearch(context, javId, autoConfirm, false);
    return;
  }

  if (cmd) {
    await handleSearch(context, normalizeJavId(args.join(" ")), autoConfirm, false);
  }
}

async function handleSearch(context: AppContext, javId: string, autoConfirm: boolean, forceRemote: boolean): Promise<void> {
  const { loc, services } = context;

  if (!isValidJavId(javId)) {
    printError(loc.getFormat("invalid_jav_id", javId));
    return;
  }

  printSearching(javId);
  services.telemetryService.trackSearch(javId);
  let candidates: JavSearchResult[] = [];

  if (!forceRemote && services.cacheProvider) {
    const cached = await services.cacheProvider.get(javId);
    if (cached && cached.torrents.length > 0) {
      candidates = [cached];
    }
  }

  if (candidates.length === 0) {
    try {
      candidates = await services.javDbProvider.searchCandidates(javId);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error";
      printError(message);
      return;
    }
  }

  if (candidates.length === 0) {
    printWarning(loc.get("no_search_results"));
    return;
  }

  printSearchResultList(
    javId,
    candidates.map((item) => ({
      javId: item.javId || normalizeJavId(item.title),
      title: item.title,
      source: item.dataSource,
    }))
  );

  const selectedCandidateIndex = autoConfirm ? 1 : await promptIndex(candidates.length);
  if (!selectedCandidateIndex) {
    return;
  }

  const selectedCandidate = candidates[selectedCandidateIndex - 1];
  let detail = selectedCandidate;

  if (!detail.torrents.length) {
    if (!detail.detailUrl) {
      printWarning(loc.get("no_torrents_found"));
      return;
    }

    try {
      detail = await services.javDbProvider.getDetail(detail.detailUrl);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error";
      printError(message);
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
    } catch {
      // Keep main flow running even when cache write fails.
    }
  }

  const torrentsWithMarkerFallback = detail.torrents.map((torrent) => ({
    ...torrent,
    hasUncensoredMarker: torrent.hasUncensoredMarker || /-(?:UC|U)(?=$|[^A-Za-z0-9])/i.test(torrent.title),
  }));

  const sortedTorrents = services.torrentSelectionService.getSortedTorrents(torrentsWithMarkerFallback);
  if (sortedTorrents.length === 0) {
    printWarning(loc.get("no_torrents_found"));
    return;
  }

  printTorrentList(
    detail.javId,
    sortedTorrents.map((t) => ({
      title: t.title,
      size: formatSize(t.size),
      tags: buildTags(t, loc),
    })),
    buildTagLegend(loc),
  );

  const selected = autoConfirm ? 1 : await promptIndex(sortedTorrents.length);
  if (!selected) {
    return;
  }

  const selectedTorrent = sortedTorrents[selected - 1];
  const processResult = await services.javSearchService.processSelectedTorrent(detail.javId, selectedTorrent, false);

  if (processResult.localFilesFound) {
    printLocalFiles(
      processResult.localFiles.map((f) => ({
        name: f.fileName,
        size: formatSize(f.size),
        path: f.fullPath,
      }))
    );
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
    printSuccess(loc.get("download_added"));
    return;
  }

  if (processResult.magnetLink) {
    printMagnetLink(loc.get("download_failed"), processResult.magnetLink);
  }
}

function buildTags(
  t: { title: string; hasUncensoredMarker: boolean; hasSubtitle: boolean; hasHd: boolean },
  _loc: LocalizationService,
): string[] {
  const hasUncensored = t.hasUncensoredMarker || /-(?:UC|U)(?=$|[^A-Za-z0-9])/i.test(t.title);
  const tags: string[] = [];
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

function buildTagLegend(loc: LocalizationService): string {
  if (loc.currentLocale === "zh") {
    return "说明: UC=无码, SUB=字幕, HD=高清";
  }
  return "Legend: UC=Uncensored, SUB=Subtitles, HD=High Definition";
}

function showHelp(loc: LocalizationService): void {
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

  printHelp(commands);
}

async function promptIndex(max: number): Promise<number | null> {
  return promptIndexWithLabel(max, "Select #");
}

async function promptIndexWithLabel(max: number, label: string): Promise<number | null> {
  const answer = (await askLine(`  ${getPrompt()}${label} (empty to cancel): `)).trim();
  if (!answer) {
    return null;
  }
  const value = Number(answer);
  if (!Number.isFinite(value) || value < 1 || value > max) {
    return null;
  }
  return value;
}

async function promptYesNo(message: string): Promise<boolean> {
  const answer = (await askLine(`  ${getPrompt()}${message}`)).trim().toLowerCase();
  return answer === "y" || answer === "yes";
}

async function askLine(prompt: string): Promise<string> {
  const rl = readline.createInterface({ input, output });
  try {
    return await rl.question(prompt);
  } finally {
    rl.close();
  }
}

function splitArgs(inputLine: string): string[] {
  const args: string[] = [];
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

function parseLocalArgs(args: string[]): { query: string; minBytes: number | null } {
  let minBytes: number | null = null;
  const parts: string[] = [];

  for (let i = 0; i < args.length; i += 1) {
    const token = args[i];
    if (token === "--min-size" || token === "--min" || token === "-m") {
      const candidate = args[i + 1];
      const parsed = tryParseToBytes(candidate);
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

async function showLocalFilesPaged(files: Array<{ name: string; size: string; path: string }>): Promise<void> {
  if (files.length === 0) return;

  const totalPages = Math.max(1, Math.ceil(files.length / LOCAL_PAGE_SIZE));
  let page = 0;

  while (true) {
    const start = page * LOCAL_PAGE_SIZE;
    const current = files.slice(start, start + LOCAL_PAGE_SIZE);
    printLocalFiles(current, {
      startIndex: start,
      totalCount: files.length,
      page: page + 1,
      totalPages,
    });

    if (totalPages <= 1) {
      return;
    }

    const answer = (await askLine(
      `  ${getPrompt()}Page ${page + 1}/${totalPages} | n-next, p-prev, f-first, l-last, # jump, q-quit: `,
    )).trim().toLowerCase();

    if (!answer || answer === "q" || answer === "quit" || answer === "c") {
      return;
    }

    if (/^\d+$/.test(answer)) {
      const target = Number(answer);
      if (target >= 1 && target <= totalPages) {
        page = target - 1;
      } else {
        printWarning(`Page out of range: 1-${totalPages}`);
      }
      continue;
    }

    if (answer === "n" || answer === "j" || answer === "next") {
      if (page < totalPages - 1) {
        page += 1;
      } else {
        printWarning("Already at last page");
      }
      continue;
    }

    if (answer === "p" || answer === "k" || answer === "prev" || answer === "previous") {
      if (page > 0) {
        page -= 1;
      } else {
        printWarning("Already at first page");
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

    printWarning("Unknown key. Use n/p/f/l/#/q");
  }
}

function maskSecret(value: string | null): string {
  if (!value) {
    return "-";
  }
  if (value.length <= 2) {
    return "**";
  }
  return "*".repeat(Math.min(value.length, 8));
}

async function handleConfigCommand(context: AppContext, args: string[]): Promise<void> {
  const { loc, config } = context;
  if (args.length === 0) {
    printInfo(loc.get("usage_config"));
    return;
  }

  const action = (args[0] ?? "").toLowerCase();
  if (action === "show") {
    printConfig([
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
    printInfo(loc.get("usage_config"));
    return;
  }

  const service = normalizeConfigService(setMode ? args[1] : args[0]);
  if (!service) {
    printInfo(loc.get("usage_config"));
    return;
  }
  const key = normalizeConfigKey(service, setMode ? args[2] : args[1]);
  if (!key) {
    printInfo(loc.get("usage_config"));
    return;
  }
  const value = (setMode ? args.slice(3) : args.slice(2)).join(" ").trim();
  if (!value) {
    printInfo(loc.get("usage_config"));
    return;
  }

  if (!applyConfigUpdate(config, service, key, value)) {
    printInfo(loc.get("usage_config"));
    return;
  }

  saveConfig(config);
  printSuccess(loc.get("config_updated"));
}

async function enrichJavInfoFieldsForTelemetry(
  services: AppContext["services"],
  detail: JavSearchResult,
  fallbackJavId: string,
): Promise<JavSearchResult> {
  if (!isJavInfoFieldMissing(detail)) {
    return detail;
  }

  try {
    let refreshed: JavSearchResult | null = null;
    const detailUrl = normalizeText(detail.detailUrl);
    if (detailUrl) {
      refreshed = await services.javDbProvider.getDetail(detailUrl);
    } else {
      const normalizedId = normalizeJavId(detail.javId || fallbackJavId);
      if (normalizedId) {
        refreshed = await services.javDbProvider.search(normalizedId);
      }
    }

    if (!refreshed) {
      return detail;
    }

    return mergeJavInfo(detail, refreshed, fallbackJavId);
  } catch {
    return detail;
  }
}

function isJavInfoFieldMissing(detail: JavSearchResult): boolean {
  return !normalizeText(detail.releaseDate)
    || !normalizeText(detail.detailUrl)
    || !normalizeStringList(detail.actors).length
    || !normalizeStringList(detail.categories).length;
}

function mergeJavInfo(base: JavSearchResult, extra: JavSearchResult, fallbackJavId: string): JavSearchResult {
  return {
    ...base,
    javId: normalizeJavId(base.javId || extra.javId || fallbackJavId),
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

function normalizeText(value?: string | null): string | null {
  if (typeof value !== "string") {
    return null;
  }
  const trimmed = value.trim();
  return trimmed || null;
}

function normalizeStringList(values?: string[] | null): string[] {
  if (!Array.isArray(values)) {
    return [];
  }
  const set = new Set<string>();
  for (const value of values) {
    const normalized = normalizeText(value);
    if (normalized) {
      set.add(normalized);
    }
  }
  return Array.from(set);
}

type ConfigService = "everything" | "qbittorrent" | "javdb";
type ConfigKey = "baseurl" | "username" | "password";

function normalizeConfigService(raw?: string): ConfigService | null {
  const value = (raw ?? "").toLowerCase();
  if (value === "everything" || value === "ev") return "everything";
  if (value === "qb" || value === "qbittorrent") return "qbittorrent";
  if (value === "javdb") return "javdb";
  return null;
}

function normalizeConfigKey(service: ConfigService, raw?: string): ConfigKey | null {
  const value = (raw ?? "").toLowerCase();
  if (value === "url" || value === "baseurl") return "baseurl";
  if (service !== "javdb" && (value === "user" || value === "username")) return "username";
  if (service !== "javdb" && (value === "pass" || value === "password")) return "password";
  return null;
}

function applyConfigUpdate(
  config: AppContext["config"],
  service: ConfigService,
  key: ConfigKey,
  value: string,
): boolean {
  if (service === "everything") {
    if (key === "baseurl") config.everything.baseUrl = value;
    else if (key === "username") config.everything.userName = value;
    else if (key === "password") config.everything.password = value;
    else return false;
    return true;
  }

  if (service === "qbittorrent") {
    if (key === "baseurl") config.qBittorrent.baseUrl = value;
    else if (key === "username") config.qBittorrent.userName = value;
    else if (key === "password") config.qBittorrent.password = value;
    else return false;
    return true;
  }

  if (service === "javdb") {
    if (key !== "baseurl") return false;
    config.javDb.baseUrl = value;
    return true;
  }

  return false;
}

function getConfigValue(config: AppContext["config"], service: ConfigService, key: ConfigKey): string | null {
  if (service === "everything") {
    if (key === "baseurl") return config.everything.baseUrl;
    if (key === "username") return config.everything.userName;
    if (key === "password") return config.everything.password;
    return null;
  }
  if (service === "qbittorrent") {
    if (key === "baseurl") return config.qBittorrent.baseUrl;
    if (key === "username") return config.qBittorrent.userName;
    if (key === "password") return config.qBittorrent.password;
    return null;
  }
  if (service === "javdb") {
    return key === "baseurl" ? config.javDb.baseUrl : null;
  }
  return null;
}

async function runInteractiveConfigSet(context: AppContext, serviceArg?: string, keyArg?: string): Promise<void> {
  const { loc, config } = context;
  const isZh = loc.currentLocale === "zh";

  const services: Array<{ id: ConfigService; label: string }> = [
    { id: "everything", label: "Everything" },
    { id: "qbittorrent", label: "qBittorrent" },
    { id: "javdb", label: "JavDb" },
  ];

  let service = normalizeConfigService(serviceArg);
  if (!service) {
    printInfo(isZh ? "请选择要配置的服务:" : "Select service to configure:");
    services.forEach((item, i) => {
      console.log(`  ${i + 1}. ${item.label}`);
    });
    const serviceIdx = await promptIndexWithLabel(
      services.length,
      isZh ? "服务序号" : "Service #",
    );
    if (!serviceIdx) {
      return;
    }
    service = services[serviceIdx - 1].id;
  }

  const keys = getConfigKeysForService(service);
  let key = normalizeConfigKey(service, keyArg);
  if (!key) {
    printInfo(isZh ? "请选择要修改的配置项:" : "Select key to update:");
    const currentLabel = isZh ? "当前值" : "current";
    keys.forEach((item, i) => {
      const current = getConfigValue(config, service, item.key);
      const display = item.key === "password" ? maskSecret(current) : (current || "-");
      console.log(`  ${i + 1}. ${item.label} (${currentLabel}: ${display})`);
    });
    const keyIdx = await promptIndexWithLabel(
      keys.length,
      isZh ? "配置项序号" : "Key #",
    );
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
  const newValue = (await askLine(`  ${getPrompt()}${valuePrompt}`)).trim();
  if (!newValue) {
    return;
  }

  const confirm = await promptYesNo(
    isZh
      ? `确认更新 ${service}.${key} ? (y/N) `
      : `Apply update to ${service}.${key}? (y/N) `,
  );
  if (!confirm) {
    return;
  }

  if (!applyConfigUpdate(config, service, key, newValue)) {
    printInfo(loc.get("usage_config"));
    return;
  }

  saveConfig(config);
  printSuccess(loc.get("config_updated"));
}

function getConfigKeysForService(service: ConfigService): Array<{ key: ConfigKey; label: string }> {
  if (service === "javdb") {
    return [{ key: "baseurl", label: "BaseUrl" }];
  }
  return [
    { key: "baseurl", label: "BaseUrl" },
    { key: "username", label: "UserName" },
    { key: "password", label: "Password" },
  ];
}

async function runTestCurl(context: AppContext): Promise<void> {
  const { config } = context;
  const javDbCfg = config.javDb;
  const urls = Array.from(new Set([javDbCfg.baseUrl, ...javDbCfg.mirrorUrls]
    .map((u) => (u ?? "").trim().replace(/\/+$/, ""))
    .filter((u) => u.length > 0)));

  printHealthResults([]);  // header-like

  console.log("");
  printInfo("JavDB curl-impersonate Diagnostic");
  console.log("");

  if (!javDbCfg.curlImpersonate.enabled) {
    printWarning("JavDb.CurlImpersonate.Enabled is false in config.");
    printInfo("This diagnostic still tries to call curl-impersonate directly.");
  }

  const fetcher = new CurlImpersonateFetcher(javDbCfg.curlImpersonate);
  let anySuccess = false;
  const cookieHeader = "over18=1; locale=zh";

  const results: Array<{ name: string; healthy: boolean; message: string }> = [];

  for (const url of urls) {
    const result = await fetcher.get(url, null, cookieHeader, 15000);
    if (result.status >= 200 && result.status < 300) {
      anySuccess = true;
      results.push({ name: url, healthy: true, message: `HTTP ${result.status}` });
    } else {
      const error = result.error ? ` error=${result.error}` : "";
      results.push({ name: url, healthy: false, message: `HTTP ${result.status}${error}` });
    }
  }

  printHealthResults(results);

  if (anySuccess) {
    printSuccess("At least one JavDB URL is accessible via curl-impersonate.");
  } else {
    printError("All JavDB URLs failed via curl-impersonate.");
  }
}
