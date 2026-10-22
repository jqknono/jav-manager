import readline from "node:readline/promises";
import { stdin as input, stdout as output } from "node:process";
import { AppContext } from "./context";
import { LocalizationService } from "./localization";
import { JavSearchResult } from "../../../packages/shared/src/models";
import { saveConfig } from "./config";
import { AppName, getVersion } from "./utils/appInfo";
import { isValidJavId, normalizeJavId } from "../../../packages/shared/src/utils/torrentNameParser";
import {
  printBanner,
  printHelp,
  printSearchResultList,
  printTorrentList,
  printHealthResults,
  printConfig,
  printCacheStats,
  printSearching,
  printSubtitleList,
  printSuccess,
  printError,
  printWarning,
  printInfo,
  getPrompt,
  formatSize,
} from "./utils/cliDisplay";

const lightweightCommands = new Set([
  "help",
  "h",
  "--help",
  "-h",
  "version",
  "v",
  "--version",
  "-v",
  "lang",
  "language",
  "lg",
  "cfg",
  "config",
  "cf",
  "cs",
]);

export function isLightweightCliCommand(args: string[]): boolean {
  const cmd = String(args[0] ?? "").trim().toLowerCase();
  return lightweightCommands.has(cmd);
}

export async function runCli(context: AppContext, args: string[]): Promise<void> {
  const { loc, services } = context;

  if (args.length > 0 && isLightweightCliCommand(args)) {
    await runCommand(context, args, true);
    return;
  }

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

    const raw = String(args[1] ?? "").trim().toLowerCase();
    const language = raw === "en" ? "en" : raw === "ja" ? "ja" : raw === "ko" ? "ko" : "zh";
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

  if (cmd === "sub" || cmd === "subtitle" || cmd === "zimu" || cmd === "zm") {
    if (args.length < 2) {
      printInfo(loc.get("help_subtitle"));
      return;
    }
    const javId = normalizeJavId(args.slice(1).join(" "));
    await handleSubtitleSearch(context, javId, autoConfirm);
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

async function handleSubtitleSearch(context: AppContext, javId: string, autoConfirm: boolean): Promise<void> {
  const { loc, services } = context;

  if (!isValidJavId(javId)) {
    printError(loc.getFormat("invalid_jav_id", javId));
    return;
  }

  if (!context.config.subtitle.enabled) {
    printWarning(loc.get("subtitle_disabled"));
    return;
  }

  printSearching(javId);
  let result;
  try {
    result = await services.subtitleSearchService.search(javId);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    printError(message);
    return;
  }

  if (result.items.length === 0) {
    for (const message of result.messages) {
      printWarning(message);
    }
    printWarning(loc.get("no_subtitles_found"));
    return;
  }

  printSubtitleList(
    result.javId,
    result.items.map((item) => ({
      title: item.title,
      source: item.source,
      size: item.size > 0 ? formatSize(item.size) : "-",
      downloads: item.downloads > 0 ? String(item.downloads) : "-",
      languages: item.languages.length
        ? item.languages.map((language) => language.code).join(" ")
        : (item.languageCount > 0 ? String(item.languageCount) : "-"),
    })),
  );

  const selectedIndex = autoConfirm ? 1 : await promptIndex(result.items.length);
  if (!selectedIndex) {
    return;
  }

  const selected = result.items[selectedIndex - 1];
  try {
    const downloaded = await services.subtitleSearchService.downloadPreferred(selected, result.javId);
    printSuccess(loc.getFormat("subtitle_downloaded", downloaded.savedPath));
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    printError(message);
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
      javId: item.javId || normalizeJavId(item.titleZh ?? item.title),
      title: (loc.currentLocale === "zh" ? (item.titleZh ?? item.title) : item.title),
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
      const fetchedDetail = await services.javDbProvider.getDetail(detail.detailUrl);
      detail = mergeJavInfo(selectedCandidate, fetchedDetail, javId);
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
  const processResult = await services.javSearchService.processSelectedTorrent(detail.javId, selectedTorrent);
  if (processResult.success && processResult.magnetLink) {
    for (const message of processResult.messages) {
      printSuccess(message);
    }
    printInfo(processResult.magnetLink);
    return;
  }

  for (const message of processResult.messages) {
    printWarning(message);
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
    return "说明：UC=无码，SUB=字幕，HD=高清";
  }
  return "Legend: UC=Uncensored, SUB=Subtitles, HD=High Definition";
}

function showHelp(loc: LocalizationService): void {
  const isZh = loc.currentLocale === "zh";

  const commands = [
    { cmd: "<JAV-ID> / j <id>", desc: isZh ? "搜索并获取磁力链接" : "Search and get magnet link", category: isZh ? "搜索" : "Search" },
    { cmd: "search <id> / s", desc: isZh ? "搜索并获取磁力链接" : "Search and get magnet link", category: isZh ? "搜索" : "Search" },
    { cmd: "remote <id> / r", desc: isZh ? "仅远程搜索（跳过缓存）" : "Search JavDB only (skip cache)", category: isZh ? "搜索" : "Search" },
    { cmd: "sub <id> / zm", desc: isZh ? "搜索并下载字幕" : "Search and download subtitles", category: isZh ? "搜索" : "Search" },

    { cmd: "cache / c", desc: isZh ? "缓存统计" : "Show cache statistics", category: isZh ? "系统" : "System" },
    { cmd: "health / hc", desc: isZh ? "健康检查" : "Check service health", category: isZh ? "系统" : "System" },
    { cmd: "cfg show / cs", desc: isZh ? "查看设置" : "View current config", category: isZh ? "系统" : "System" },
    { cmd: "cfg set [svc] [key] [value]", desc: isZh ? "设置服务连接（支持交互）" : "Set service connection (interactive supported)", category: isZh ? "系统" : "System" },

    { cmd: "lang <en|zh|ja|ko> / lg", desc: isZh ? "切换语言" : "Switch language", category: isZh ? "其他" : "Other" },
    { cmd: "version / v", desc: isZh ? "显示版本信息" : "Show version", category: isZh ? "其他" : "Other" },
    { cmd: "help / h", desc: isZh ? "显示帮助" : "Show this help", category: isZh ? "其他" : "Other" },
    { cmd: "quit / q", desc: isZh ? "退出交互模式" : "Exit interactive mode", category: isZh ? "其他" : "Other" },
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

async function handleConfigCommand(context: AppContext, args: string[]): Promise<void> {
  const { loc, config } = context;
  if (args.length === 0) {
    printInfo(loc.get("usage_config"));
    return;
  }

  const action = (args[0] ?? "").toLowerCase();
  if (action === "show") {
    printConfig([
      { section: "JavBackend", key: "BaseUrl", value: config.javDb.baseUrl || "-" },
      { section: "Subtitle", key: "BaseUrl", value: config.subtitle.baseUrl || "-" },
      { section: "Subtitle", key: "SavePath", value: config.subtitle.savePath || "-" },
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
    titleZh: normalizeText(base.titleZh) ?? normalizeText(extra.titleZh) ?? undefined,
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

type ConfigService = "javdb" | "subtitle";
type ConfigKey = "baseurl" | "savepath";

function normalizeConfigService(raw?: string): ConfigService | null {
  const value = (raw ?? "").toLowerCase();
  if (value === "javdb" || value === "javbackend" || value === "jb") return "javdb";
  if (value === "subtitle" || value === "sub") return "subtitle";
  return null;
}

function normalizeConfigKey(service: ConfigService, raw?: string): ConfigKey | null {
  const value = (raw ?? "").toLowerCase();
  if (service === "javdb" && (value === "url" || value === "baseurl")) return "baseurl";
  if (service === "subtitle" && (value === "path" || value === "savepath")) return "savepath";
  return null;
}

function applyConfigUpdate(
  config: AppContext["config"],
  service: ConfigService,
  key: ConfigKey,
  value: string,
): boolean {
  if (service === "javdb") {
    if (key !== "baseurl") return false;
    config.javDb.baseUrl = value;
    return true;
  }
  if (service === "subtitle") {
    if (key !== "savepath") return false;
    config.subtitle.savePath = value;
    return true;
  }

  return false;
}

function getConfigValue(config: AppContext["config"], service: ConfigService, key: ConfigKey): string | null {
  if (service === "javdb") {
    return key === "baseurl" ? config.javDb.baseUrl : null;
  }
  if (service === "subtitle") {
    return key === "savepath" ? config.subtitle.savePath : null;
  }
  return null;
}

async function runInteractiveConfigSet(context: AppContext, serviceArg?: string, keyArg?: string): Promise<void> {
  const { loc, config } = context;
  const isZh = loc.currentLocale === "zh";

  const services: Array<{ id: ConfigService; label: string }> = [
    { id: "javdb", label: "JavBackend" },
    { id: "subtitle", label: "Subtitle" },
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
      const display = current || "-";
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
  const currentDisplay = currentValue || "-";
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
  return [{ key: "savepath", label: "SavePath" }];
}
