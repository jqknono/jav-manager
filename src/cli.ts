import readline from "node:readline/promises";
import { stdin as input, stdout as output } from "node:process";
import { AppContext } from "./context";
import { LocalizationService } from "./localization";
import { AppName, getVersion } from "./utils/appInfo";
import { isValidJavId, normalizeJavId } from "./utils/torrentNameParser";
import { tryParseToBytes } from "./utils/sizeParser";
import { CurlImpersonateFetcher } from "./data/curlImpersonateFetcher";

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

  console.log(`${AppName} v${getVersion()}`);
  console.log(loc.get("prompt_input"));

  const rl = readline.createInterface({ input, output });
  while (true) {
    const line = (await rl.question("> ")).trim();
    if (!line) {
      continue;
    }
    if (["quit", "q", "exit"].includes(line.toLowerCase())) {
      break;
    }
    const tokens = splitArgs(line);
    await runCommand(context, tokens, false);
  }
  rl.close();
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

  if (cmd === "--test-curl") {
    await runTestCurl(context);
    return;
  }

  if (["help", "h", "--help", "-h"].includes(cmd)) {
    showHelp(loc);
    return;
  }

  if (["version", "v", "--version", "-v"].includes(cmd)) {
    console.log(`${AppName} ${getVersion()}`);
    return;
  }

  if (cmd === "lang" || cmd === "language") {
    if (args.length < 2) {
      console.log(loc.get("help_lang"));
      return;
    }

    const language = args[1] === "zh" ? "zh" : "en";
    loc.setLanguage(language);
    console.log(`Language: ${language}`);
    return;
  }

  if (cmd === "cfg" || cmd === "config") {
    await handleConfigCommand(context, args.slice(1));
    return;
  }

  if (cmd === "health" || cmd === "hc") {
    const results = await services.healthCheckService.checkAll();
    services.serviceAvailability.updateFrom(results);
    for (const result of results) {
      console.log(`${result.serviceName}: ${result.isHealthy ? loc.get("health_ok") : loc.get("health_fail")} ${result.message}`);
    }
    return;
  }

  if (cmd === "cache" || cmd === "c") {
    const stats = await services.javSearchService.getCacheStatistics();
    if (!stats) {
      console.log(loc.get("cache_disabled"));
      return;
    }
    console.log(loc.getFormat("cache_stats", stats.totalJavCount, stats.totalTorrentCount, stats.databaseSizeBytes));
    return;
  }

  if (cmd === "downloads" || cmd === "t" || cmd === "downloading" || cmd === "d") {
    let torrents = [];
    try {
      torrents = await services.downloadService.getDownloads();
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error";
      console.log(message);
      return;
    }
    const downloadingOnly = cmd === "d" || cmd === "downloading";
    const filtered = downloadingOnly
      ? torrents.filter((t) => t.state && /downloading|stalleddl|metadl/i.test(t.state))
      : torrents;

    for (const torrent of filtered) {
      console.log(`${torrent.name ?? torrent.title} - ${formatSize(torrent.size)} - ${torrent.state ?? "unknown"}`);
    }
    return;
  }

  if (cmd === "local" || cmd === "l") {
    if (args.length < 2) {
      console.log(loc.get("help_local"));
      return;
    }
    const { query, minBytes } = parseLocalArgs(args.slice(1));
    if (!query) {
      console.log(loc.get("help_local"));
      return;
    }

    const normalized = normalizeJavId(query);
    let results = [];
    try {
      results = await services.everythingProvider.search(normalized);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error";
      console.log(message);
      return;
    }
    const filtered = results.filter((file) => (minBytes ? file.size >= minBytes : true));
    if (!filtered.length) {
      console.log(loc.get("no_search_results"));
      return;
    }

    for (const file of filtered) {
      console.log(`${file.fileName} - ${formatSize(file.size)} - ${file.fullPath}`);
    }
    return;
  }

  if (cmd === "remote" || cmd === "r") {
    const javId = normalizeJavId(args.slice(1).join(" "));
    await handleSearch(context, javId, autoConfirm, true);
    return;
  }

  if (cmd === "search" || cmd === "s") {
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
    console.log(loc.getFormat("invalid_jav_id", javId));
    return;
  }

  console.log(loc.getFormat("searching", javId));
  const searchResult = await services.javSearchService.searchOnly(javId, forceRemote);

  if (!searchResult.success || searchResult.availableTorrents.length === 0) {
    console.log(loc.get("no_torrents_found"));
    return;
  }

  searchResult.availableTorrents.forEach((torrent, index) => {
    console.log(`${index + 1}. ${torrent.title} (${formatSize(torrent.size)})`);
  });

  const selected = autoConfirm ? 1 : await promptIndex(searchResult.availableTorrents.length);
  if (!selected) {
    return;
  }

  const selectedTorrent = searchResult.availableTorrents[selected - 1];
  const processResult = await services.javSearchService.processSelectedTorrent(javId, selectedTorrent, false);

  if (processResult.localFilesFound) {
    console.log(loc.get("local_files_found"));
    processResult.localFiles.forEach((file) => {
      console.log(`${file.fileName} - ${formatSize(file.size)} - ${file.fullPath}`);
    });
    if (!autoConfirm) {
      const proceed = await promptYesNo("Download anyway? (y/N) ");
      if (!proceed) {
        return;
      }
      await services.javSearchService.processSelectedTorrent(javId, selectedTorrent, true);
    }
    return;
  }

  if (processResult.downloaded) {
    console.log(loc.get("download_added"));
    return;
  }

  if (processResult.magnetLink) {
    console.log(`${loc.get("download_failed")} ${processResult.magnetLink}`);
  }
}

function showHelp(loc: LocalizationService): void {
  console.log(loc.get("help_title"));
  console.log(`  ${loc.get("help_search")}`);
  console.log(`  ${loc.get("help_local")}`);
  console.log(`  ${loc.get("help_remote")}`);
  console.log(`  ${loc.get("help_cache")}`);
  console.log(`  ${loc.get("help_downloads")}`);
  console.log(`  ${loc.get("help_downloading")}`);
  console.log(`  ${loc.get("help_health")}`);
  console.log(`  ${loc.get("help_lang")}`);
  console.log(`  ${loc.get("help_config")}`);
  console.log(`  ${loc.get("help_version")}`);
  console.log(`  ${loc.get("help_help")}`);
  console.log(`  ${loc.get("help_quit")}`);
  console.log(`  ${loc.get("help_test_curl")}`);
}

async function promptIndex(max: number): Promise<number | null> {
  const rl = readline.createInterface({ input, output });
  const answer = (await rl.question("Select # (empty to cancel): ")).trim();
  rl.close();
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
  const rl = readline.createInterface({ input, output });
  const answer = (await rl.question(message)).trim().toLowerCase();
  rl.close();
  return answer === "y" || answer === "yes";
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

function formatSize(bytes: number): string {
  if (bytes <= 0) {
    return "-";
  }
  if (bytes >= 1024 * 1024 * 1024) {
    return `${(bytes / 1024 / 1024 / 1024).toFixed(2)} GB`;
  }
  if (bytes >= 1024 * 1024) {
    return `${(bytes / 1024 / 1024).toFixed(2)} MB`;
  }
  return `${(bytes / 1024).toFixed(2)} KB`;
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
    console.log(loc.get("usage_config"));
    return;
  }

  const action = (args[0] ?? "").toLowerCase();
  if (action === "show") {
    console.log(`Everything.BaseUrl: ${config.everything.baseUrl || "-"}`);
    console.log(`Everything.UserName: ${config.everything.userName ?? "-"}`);
    console.log(`Everything.Password: ${maskSecret(config.everything.password)}`);
    console.log(`qBittorrent.BaseUrl: ${config.qBittorrent.baseUrl || "-"}`);
    console.log(`qBittorrent.UserName: ${config.qBittorrent.userName ?? "-"}`);
    console.log(`qBittorrent.Password: ${maskSecret(config.qBittorrent.password)}`);
    console.log(`JavDb.BaseUrl: ${config.javDb.baseUrl || "-"}`);
    return;
  }

  if (args.length < 3) {
    console.log(loc.get("usage_config"));
    return;
  }

  const service = action;
  const key = (args[1] ?? "").toLowerCase();
  const value = args.slice(2).join(" ").trim();
  if (!value) {
    console.log(loc.get("usage_config"));
    return;
  }

  if (service === "everything" || service === "ev") {
    if (key === "url" || key === "baseurl") config.everything.baseUrl = value;
    else if (key === "user" || key === "username") config.everything.userName = value;
    else if (key === "pass" || key === "password") config.everything.password = value;
    else {
      console.log(loc.get("usage_config"));
      return;
    }
    console.log(loc.get("config_updated"));
    return;
  }

  if (service === "qb" || service === "qbittorrent") {
    if (key === "url" || key === "baseurl") config.qBittorrent.baseUrl = value;
    else if (key === "user" || key === "username") config.qBittorrent.userName = value;
    else if (key === "pass" || key === "password") config.qBittorrent.password = value;
    else {
      console.log(loc.get("usage_config"));
      return;
    }
    console.log(loc.get("config_updated"));
    return;
  }

  if (service === "javdb") {
    if (key === "url" || key === "baseurl") config.javDb.baseUrl = value;
    else {
      console.log(loc.get("usage_config"));
      return;
    }
    console.log(loc.get("config_updated"));
    return;
  }

  console.log(loc.get("usage_config"));
}

async function runTestCurl(context: AppContext): Promise<void> {
  const { config } = context;
  const javDbCfg = config.javDb;
  const urls = Array.from(new Set([javDbCfg.baseUrl, ...javDbCfg.mirrorUrls]
    .map((u) => (u ?? "").trim().replace(/\/+$/, ""))
    .filter((u) => u.length > 0)));

  console.log("=========================================");
  console.log("JavDB curl-impersonate Diagnostic");
  console.log("=========================================");

  if (!javDbCfg.curlImpersonate.enabled) {
    console.log("Warning: JavDb.CurlImpersonate.Enabled is false in config.");
    console.log("This diagnostic still tries to call curl-impersonate directly.");
  }

  const fetcher = new CurlImpersonateFetcher(javDbCfg.curlImpersonate);
  let anySuccess = false;
  const cookieHeader = "over18=1; locale=zh";

  for (const url of urls) {
    const result = await fetcher.get(url, null, cookieHeader, 15000);
    if (result.status >= 200 && result.status < 300) {
      anySuccess = true;
      console.log(`  ${url} ... OK (HTTP ${result.status})`);
    } else {
      const error = result.error ? ` error=${result.error}` : "";
      console.log(`  ${url} ... FAILED (HTTP ${result.status})${error}`);
    }
  }

  if (anySuccess) {
    console.log("At least one JavDB URL is accessible via curl-impersonate.");
  } else {
    console.log("All JavDB URLs failed via curl-impersonate.");
  }
}
