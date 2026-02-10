import express from "express";
import os from "node:os";
import { AppContext } from "./context";
import { saveConfig } from "./config";
import { LocalizationService } from "./localization";
import { JavSearchResult, LocalFileInfo, TorrentInfo, UncensoredMarkerType } from "./models";
import { EverythingHttpClient } from "./data/everything";
import { JavDbWebScraper } from "./data/javdb";
import { QBittorrentApiClient } from "./data/qbittorrent";
import { normalizeJavId } from "./utils/torrentNameParser";
import { openContainingFolder } from "./utils/platformShell";

const defaultPort = 4860;
const defaultHost = "0.0.0.0";

export function startGuiServer(context: AppContext, port: number = defaultPort, host: string = defaultHost): void {
  const app = express();
  app.use(express.urlencoded({ extended: true }));
  app.use(express.json());
  const externalLinks = getGuiExternalLinks(context);

  app.get("/", async (req, res) => {
    const query = typeof req.query.q === "string" ? req.query.q : "";
    const searchLocal = req.query.local !== "0";
    const searchRemote = req.query.remote !== "0";
    const status = "";
    res.send(renderSearchPage(context.loc, externalLinks, { query, searchLocal, searchRemote, status }));
  });

  app.post("/search", async (req, res) => {
    const query = String(req.body.query ?? "");
    const searchLocal = Boolean(req.body.searchLocal);
    const searchRemote = Boolean(req.body.searchRemote);
    const normalized = normalizeJavId(query);

    let localFiles: LocalFileInfo[] = [];
    let candidates: JavSearchResult[] = [];
    const warnings: string[] = [];

    if (normalized) {
      context.services.telemetryService.trackSearch(normalized);

      if (searchLocal) {
        try {
          localFiles = await context.services.localFileCheckService.checkLocalFiles(normalized);
        } catch (error) {
          warnings.push(formatLocalSearchError(context.loc, error));
        }
      }

      if (searchRemote) {
        try {
          candidates = await context.services.javDbProvider.searchCandidates(normalized);
        } catch (error) {
          warnings.push(formatRemoteSearchError(context.loc, error));
        }
      }
    }

    const status = warnings.length
      ? warnings.join("; ")
      : buildCompletionStatus(context.loc, searchLocal, searchRemote);

    res.send(
      renderSearchPage(context.loc, externalLinks, {
        query,
        searchLocal,
        searchRemote,
        status,
        localFiles,
        candidates,
        javId: normalized,
      })
    );
  });

  app.get("/detail", async (req, res) => {
    const detailUrl = typeof req.query.url === "string" ? req.query.url : "";
    const javId = typeof req.query.javId === "string" ? req.query.javId : "";
    const query = typeof req.query.q === "string" ? req.query.q : "";
    const searchLocal = req.query.local !== "0";
    const searchRemote = req.query.remote !== "0";

    if (!detailUrl) {
      res.redirect("/");
      return;
    }

    let detail: JavSearchResult | null = null;
    let status = "";
    try {
      detail = await context.services.javDbProvider.getDetail(detailUrl);
      if (detail && !detail.javId) {
        detail.javId = javId || normalizeJavId(detail.title);
      }
      if (detail) {
        context.services.telemetryClient.tryReport(detail);
        if (context.services.cacheProvider && detail.torrents.length > 0) {
          try { await context.services.cacheProvider.save(detail); } catch { /* ignore */ }
        }
      }
      status = context.loc.get("gui_status_search_complete");
    } catch (error) {
      status = formatRemoteSearchError(context.loc, error);
    }

    const torrents = detail
      ? context.services.torrentSelectionService.getSortedTorrents(detail.torrents)
      : [];

    res.send(
      renderDetailPage(context.loc, externalLinks, {
        query,
        searchLocal,
        searchRemote,
        status,
        detail,
        torrents,
        javId: javId || detail?.javId || "",
      })
    );
  });

  app.post("/download", async (req, res) => {
    const javId = String(req.body.javId ?? "");
    const title = String(req.body.title ?? "");
    const magnetLink = String(req.body.magnetLink ?? "");
    const size = Number(req.body.size ?? 0);
    const hasHd = req.body.hasHd === "1";
    const hasSubtitle = req.body.hasSubtitle === "1";
    const hasUncensored = req.body.hasUncensoredMarker === "1";

    let status = context.loc.get("gui_status_download_failed");
    if (magnetLink) {
      try {
        const torrent: TorrentInfo = {
          title,
          magnetLink,
          size,
          hasHd,
          hasSubtitle,
          hasUncensoredMarker: hasUncensored,
          uncensoredMarkerType: hasUncensored
            ? hasSubtitle
              ? UncensoredMarkerType.UC
              : UncensoredMarkerType.U
            : UncensoredMarkerType.None,
          seeders: 0,
          leechers: 0,
          sourceSite: "JavDB",
          dlSpeed: 0,
          eta: 0,
          weightScore: 0,
        };

        await context.services.downloadService.addDownload(torrent);
        context.services.telemetryService.trackDownload(javId || normalizeJavId(title));
        status = context.loc.get("gui_status_download_added");
      } catch (error) {
        status = error instanceof Error ? error.message : context.loc.get("gui_status_download_failed");
      }
    }

    const next = javId ? `/?q=${encodeURIComponent(javId)}` : "/";
    res.redirect(next);
  });

  // Render downloads page immediately, then load qBittorrent data asynchronously on the client.
  // This avoids UI jank when switching to the "Downloads" tab.
  app.get("/downloads", (_, res) => {
    res.send(renderDownloadsPage(context.loc, externalLinks));
  });

  app.get("/api/downloads", async (_, res) => {
    try {
      const torrents = await context.services.downloadService.getDownloads();
      res.json({ ok: true, torrents });
    } catch (error) {
      res.json({ ok: false, torrents: [], error: formatDownloadsError(context.loc, error) });
    }
  });

  app.get("/settings", (_, res) => {
    res.send(renderSettingsPage(context.loc, externalLinks, context));
  });

  app.post("/settings", async (req, res) => {
    applySettings(context, req.body);
    saveConfig(context.config);
    res.send(renderSettingsPage(context.loc, externalLinks, context, context.loc.get("gui_settings_saved")));
  });

  app.post("/api/test-all", async (req, res) => {
    try {
      const toNullable = (v: unknown): string | null => {
        const s = String(v ?? "").trim();
        return s ? s : null;
      };

      const everythingCfg = {
        baseUrl: String(req.body?.everythingBaseUrl ?? ""),
        userName: toNullable(req.body?.everythingUserName),
        password: toNullable(req.body?.everythingPassword),
      };
      const qbCfg = {
        baseUrl: String(req.body?.qbBaseUrl ?? ""),
        userName: toNullable(req.body?.qbUserName),
        password: toNullable(req.body?.qbPassword),
      };
      const javDbBaseUrl = String(req.body?.javDbBaseUrl ?? "");
      const javDbMirrorUrls = String(req.body?.javDbMirrorUrls ?? "")
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean);
      const javDbCfg = {
        ...context.config.javDb,
        baseUrl: javDbBaseUrl,
        mirrorUrls: javDbMirrorUrls,
      };

      const checkers = [
        new EverythingHttpClient(everythingCfg),
        new QBittorrentApiClient(qbCfg),
        new JavDbWebScraper(javDbCfg),
      ];

      const results = await Promise.all(checkers.map((c) => c.checkHealth()));
      context.services.serviceAvailability.updateFrom(results);

      res.json({
        results: results.map((r) => ({
          name: r.serviceName,
          ok: r.isHealthy,
          message: r.message,
          url: r.url ?? "",
        })),
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error";
      res.json({ results: [], error: message });
    }
  });

  app.post("/api/open-file", async (req, res) => {
    const filePath = String(req.body.path ?? "");
    if (!filePath) {
      res.json({ ok: false });
      return;
    }
    try {
      const open = (await import("open")).default;
      await open(filePath);
      res.json({ ok: true });
    } catch {
      res.json({ ok: false });
    }
  });

  app.post("/api/open-folder", async (req, res) => {
    const filePath = String(req.body.path ?? "");
    if (!filePath) {
      res.json({ ok: false });
      return;
    }
    try {
      await openContainingFolder(filePath);
      res.json({ ok: true });
    } catch {
      res.json({ ok: false });
    }
  });

  app.listen(port, host, () => {
    const urls = getGuiUrls(host, port);
    if (urls.length === 1) {
      console.log(`GUI running at ${urls[0]}`);
      return;
    }
    console.log("GUI running at:");
    for (const u of urls) {
      console.log(`  ${u}`);
    }
  });
}

function getGuiUrls(host: string, port: number): string[] {
  const urls: string[] = [];

  const normalizedHost = (host ?? "").trim();
  const isAllInterfaces = normalizedHost === "0.0.0.0" || normalizedHost === "::" || normalizedHost === "";

  // Always show localhost as a friendly default for the same machine.
  urls.push(`http://localhost:${port}`);

  if (!isAllInterfaces) {
    urls.push(`http://${normalizedHost}:${port}`);
    return Array.from(new Set(urls));
  }

  // Also show LAN IPs when listening on all interfaces.
  const nets = os.networkInterfaces();
  for (const iface of Object.values(nets)) {
    for (const addr of iface ?? []) {
      if (!addr || addr.internal) continue;
      if (addr.family !== "IPv4") continue;
      // Skip link-local.
      if (addr.address.startsWith("169.254.")) continue;
      urls.push(`http://${addr.address}:${port}`);
    }
  }

  return Array.from(new Set(urls));
}

type GuiExternalLinks = {
  repoUrl: string;
  cloudflareUiUrl: string;
  javDbUrl: string;
  everythingUrl: string;
  qBittorrentUrl: string;
};

function getGuiExternalLinks(context: AppContext): GuiExternalLinks {
  const repo = String(context.config.update?.gitHubRepo ?? "").trim();
  const repoUrl = repo ? `https://github.com/${repo}` : "https://github.com/jqknono/jav-manager";
  const cloudflareUiUrl = "https://jav-manager.techfetch.dev/";
  return {
    repoUrl,
    cloudflareUiUrl,
    javDbUrl: context.loc.get("gui_link_javdb"),
    everythingUrl: context.loc.get("gui_link_everything"),
    qBittorrentUrl: context.loc.get("gui_link_qbittorrent"),
  };
}

function buildCompletionStatus(loc: LocalizationService, searchLocal: boolean, searchRemote: boolean): string {
  if (searchLocal && searchRemote) return loc.get("gui_status_local_and_remote_complete");
  if (searchLocal) return loc.get("gui_status_local_search_complete");
  if (searchRemote) return loc.get("gui_status_remote_search_complete");
  return loc.get("gui_status_search_complete");
}

function renderSearchPage(
  loc: LocalizationService,
  links: GuiExternalLinks,
  data: {
    query: string;
    searchLocal: boolean;
    searchRemote: boolean;
    status: string;
    localFiles?: LocalFileInfo[];
    candidates?: JavSearchResult[];
    javId?: string;
  }
): string {
  const localFiles = data.localFiles ?? [];
  const candidates = data.candidates ?? [];

  const localSection = localFiles.length
    ? renderCard(
        loc.get("gui_section_local_files"),
        `<ul class="file-list">${localFiles
          .map(
            (file) =>
              `<li class="file-item">
                <span class="file-info">${escapeHtml(file.fileName)} <code class="file-size">${formatSize(file.size)}</code></span>
                <span class="file-path">${escapeHtml(file.fullPath)}</span>
                <span class="file-actions">
                  <button class="btn-sm" onclick="openFile('${escapeJs(file.fullPath)}')">${escapeHtml(loc.get("gui_open_file"))}</button>
                  <button class="btn-sm btn-secondary" onclick="openFolder('${escapeJs(file.fullPath)}')">${escapeHtml(loc.get("gui_open_folder"))}</button>
                </span>
              </li>`
          )
          .join("")}</ul>`
      )
    : "";

  const candidateRows = candidates
    .map((item, idx) => {
      const javId = item.javId || normalizeJavId(item.title);
      const detailHref = `/detail?url=${encodeURIComponent(item.detailUrl)}&javId=${encodeURIComponent(javId)}&q=${encodeURIComponent(data.query)}`;
      const rowClass = idx === 0 ? "torrent-row torrent-best" : "torrent-row";
      const actors = item.actors?.length ? item.actors.join(", ") : "-";
      return `<tr class="${rowClass}">
        <td><code>${escapeHtml(javId)}</code></td>
        <td class="td-title">${escapeHtml(item.title)}</td>
        <td>${escapeHtml(item.releaseDate ?? "-")}</td>
        <td class="td-actors">${escapeHtml(actors)}</td>
        <td class="td-action"><a href="${escapeHtml(detailHref)}" class="button btn-sm">${escapeHtml(loc.get("gui_select_detail"))}</a></td>
      </tr>`;
    })
    .join("");

  const candidateCount = candidates.length ? `<span class="count">${candidates.length}</span>` : "";
  const candidateSection = candidates.length
    ? renderCard(
        `${loc.get("gui_search_results")} ${candidateCount}`,
        `<div class="table-wrap"><table>${tableHeader([
          "ID",
          loc.get("gui_table_title"),
          loc.get("gui_table_date"),
          loc.get("gui_table_actors"),
          "",
        ])}<tbody>${candidateRows}</tbody></table></div>`,
        false
      )
    : "";

  return renderLayout(
    loc,
    loc.get("gui_nav_search"),
    `
      ${renderStatus(loc, data.status)}
      ${renderCard(
        "",
        `<form method="post" action="/search" class="search-form" id="searchForm">
          <div class="search-row">
            ${inputField(loc.get("gui_label_jav_id"), "query", data.query, loc.get("gui_placeholder_jav_id"))}
            ${button(loc.get("gui_search_button"), "submit")}
          </div>
          <div class="row">
            ${checkbox(loc.get("gui_label_search_local"), "searchLocal", data.searchLocal)}
            ${checkbox(loc.get("gui_label_search_remote"), "searchRemote", data.searchRemote)}
          </div>
        </form>`
      )}
      <div id="searchSpinner" class="spinner-wrap" style="display:none;">
        <div class="spinner"></div>
        <span class="spinner-text">${escapeHtml(loc.get("gui_status_searching"))}</span>
      </div>
      ${localSection}
      ${candidateSection}
    `,
    "/",
    links
  );
}

function renderDetailPage(
  loc: LocalizationService,
  links: GuiExternalLinks,
  data: {
    query: string;
    searchLocal: boolean;
    searchRemote: boolean;
    status: string;
    detail: JavSearchResult | null;
    torrents: TorrentInfo[];
    javId: string;
  }
): string {
  const detail = data.detail;
  const torrents = data.torrents;

  const backHref = `/?q=${encodeURIComponent(data.query)}`;
  const backButton = `<a href="${escapeHtml(backHref)}" class="button btn-secondary" style="margin-bottom:0.75rem;display:inline-flex;align-items:center;gap:0.3rem;"><span style="font-size:1.1em;">&#8592;</span> ${escapeHtml(loc.get("gui_back_to_results"))}</a>`;

  let infoSection = "";
  if (detail) {
    const actors = detail.actors?.length ? detail.actors.join(", ") : "-";
    const categories = detail.categories?.length ? detail.categories.join(", ") : "-";
    const coverHtml = detail.coverUrl
      ? `<div class="detail-cover"><img src="${escapeHtml(detail.coverUrl)}" alt="cover" loading="lazy" /></div>`
      : "";
    infoSection = renderCard(
      `${escapeHtml(data.javId)} — ${escapeHtml(detail.title)}`,
      `<div class="detail-layout">
        ${coverHtml}
        <div class="detail-meta">
          <dl class="meta-list">
            <dt>${escapeHtml(loc.get("gui_table_date"))}</dt><dd>${escapeHtml(detail.releaseDate ?? "-")}</dd>
            <dt>${escapeHtml(loc.get("gui_table_actors"))}</dt><dd>${escapeHtml(actors)}</dd>
            <dt>Categories</dt><dd>${escapeHtml(categories)}</dd>
            <dt>Maker</dt><dd>${escapeHtml(detail.maker || "-")}</dd>
            <dt>Publisher</dt><dd>${escapeHtml(detail.publisher || "-")}</dd>
            ${detail.series ? `<dt>Series</dt><dd>${escapeHtml(detail.series)}</dd>` : ""}
            ${detail.duration > 0 ? `<dt>Duration</dt><dd>${detail.duration} min</dd>` : ""}
          </dl>
        </div>
      </div>`,
      false
    );
  }

  const torrentRows = torrents
    .map((torrent, idx) => {
      const badges = renderTorrentBadges(torrent);
      const rowClass = idx === 0 ? "torrent-row torrent-best" : "torrent-row";
      return `<tr class="${rowClass}">
        <td class="td-title">
          <span class="torrent-name">${escapeHtml(torrent.title)}</span>
          ${badges}
        </td>
        <td class="td-size"><code>${formatSize(torrent.size)}</code></td>
        <td class="td-action">
          <form method="post" action="/download">
            ${hidden("javId", data.javId)}
            ${hidden("title", torrent.title)}
            ${hidden("magnetLink", torrent.magnetLink)}
            ${hidden("size", String(torrent.size))}
            ${hidden("hasHd", torrent.hasHd ? "1" : "0")}
            ${hidden("hasSubtitle", torrent.hasSubtitle ? "1" : "0")}
            ${hidden("hasUncensoredMarker", torrent.hasUncensoredMarker ? "1" : "0")}
            ${button(loc.get("gui_download_button"), "submit")}
          </form>
        </td>
      </tr>`;
    })
    .join("");

  const torrentCount = torrents.length ? `<span class="count">${torrents.length}</span>` : "";
  const torrentSection = torrents.length
    ? renderCard(
        `${loc.get("gui_section_torrents")} ${torrentCount}`,
        `<div class="table-wrap"><table>${tableHeader([loc.get("gui_table_title"), loc.get("gui_table_size"), ""])}<tbody>${torrentRows}</tbody></table></div>`,
        false
      )
    : "";

  return renderLayout(
    loc,
    loc.get("gui_nav_search"),
    `
      ${backButton}
      ${renderStatus(loc, data.status)}
      ${infoSection}
      ${torrentSection}
    `,
    "/",
    links
  );
}

function renderDownloadsPage(loc: LocalizationService, links: GuiExternalLinks, status?: string): string {
  const statusHtml = status ? renderStatus(loc, status) : "";
  const content = `
    <div id="downloadsRoot">
      <div id="downloadsStatus" aria-live="polite">${statusHtml}</div>
      ${renderCard(
        `${loc.get("gui_nav_downloads")} <span id="downloadsCount" class="count" style="display:none;"></span>`,
        `
          <div id="downloadsLoading" class="spinner-wrap" aria-hidden="true">
            <div class="spinner" title="Loading"></div>
          </div>
          <div class="table-wrap" id="downloadsTableWrap" style="display:none;">
            <table>${tableHeader([
              loc.get("gui_table_name"),
              loc.get("gui_table_state"),
              loc.get("gui_table_size"),
            ])}<tbody id="downloadsTbody"></tbody></table>
          </div>
        `,
        false
      )}
    </div>
  `;

  return renderLayout(loc, loc.get("gui_nav_downloads"), content, "/downloads", links);
}

function formatDownloadsError(loc: LocalizationService, error: unknown): string {
  const message = error instanceof Error ? error.message : loc.get("gui_status_download_failed");
  // Convert common config errors into actionable UI hints.
  if (/qBittorrent\.BaseUrl\s+is\s+empty/i.test(message)) {
    const settingsLabel = loc.get("gui_nav_settings");
    return `${loc.get("gui_status_download_failed")}: ${loc.getFormat("gui_error_qb_not_configured", settingsLabel)}`;
  }
  return `${loc.get("gui_status_download_failed")}: ${message}`;
}

function formatLocalSearchError(loc: LocalizationService, error: unknown): string {
  const message = error instanceof Error ? error.message : "Unknown error";
  if (/Everything\.BaseUrl\s+is\s+empty/i.test(message)) {
    const settingsLabel = loc.get("gui_nav_settings");
    return loc.getFormat("gui_error_everything_not_configured", settingsLabel);
  }
  return loc.getFormat("gui_error_local_search", message);
}

function formatRemoteSearchError(loc: LocalizationService, error: unknown): string {
  const message = error instanceof Error ? error.message : "Unknown error";
  return loc.getFormat("gui_error_remote_search", message);
}

function renderSettingsPage(loc: LocalizationService, links: GuiExternalLinks, context: AppContext, status?: string): string {
  const cfg = context.config;

  const extLink = (url: string, label: string) =>
    `<a class="card-ext-link" href="${escapeHtml(url)}" target="_blank" rel="noopener noreferrer" title="${escapeHtml(label)}" aria-label="${escapeHtml(label)}">↗</a>`;

  return renderLayout(
    loc,
    loc.get("gui_nav_settings"),
    `
      ${renderStatus(loc, status ?? "")}
      <div id="testResults" class="test-results" style="display:none;"></div>
      <form method="post" action="/settings" class="settings-grid">
        ${renderCard(
          `${loc.get("gui_settings_section_everything")} ${extLink(links.everythingUrl, loc.get("gui_nav_everything"))}`,
          `${inputField(loc.get("gui_field_base_url"), "everythingBaseUrl", cfg.everything.baseUrl)}
          ${inputField(loc.get("gui_field_username"), "everythingUserName", cfg.everything.userName ?? "")}
          ${inputField(loc.get("gui_field_password"), "everythingPassword", cfg.everything.password ?? "", "", "password")}`,
          false
        )}
        ${renderCard(
          `${loc.get("gui_settings_section_qbittorrent")} ${extLink(links.qBittorrentUrl, loc.get("gui_nav_qbittorrent"))}`,
          `${inputField(loc.get("gui_field_base_url"), "qbBaseUrl", cfg.qBittorrent.baseUrl)}
          ${inputField(loc.get("gui_field_username"), "qbUserName", cfg.qBittorrent.userName ?? "")}
          ${inputField(loc.get("gui_field_password"), "qbPassword", cfg.qBittorrent.password ?? "", "", "password")}`,
          false
        )}
        ${renderCard(
          `${loc.get("gui_settings_section_javdb")} ${extLink(links.javDbUrl, loc.get("gui_nav_javdb"))}`,
          `${inputField(loc.get("gui_field_base_url"), "javDbBaseUrl", cfg.javDb.baseUrl)}
          ${inputField(loc.get("gui_field_mirror_urls"), "javDbMirrorUrls", cfg.javDb.mirrorUrls.join(","))}`,
          false
        )}
        ${renderCard(loc.get("gui_settings_section_download"), `
          ${inputField(loc.get("gui_field_default_save_path"), "defaultSavePath", cfg.download.defaultSavePath)}
          ${inputField(loc.get("gui_field_default_category"), "defaultCategory", cfg.download.defaultCategory)}
          ${inputField(loc.get("gui_field_default_tags"), "defaultTags", cfg.download.defaultTags)}
        `)}
        ${renderCard(loc.get("gui_settings_section_language"), `
          ${selectField("", "language", cfg.console.language, [
            { value: "en", label: "English" },
            { value: "zh", label: "繁體中文" },
            { value: "ja", label: "日本語" },
            { value: "ko", label: "한국어" },
          ])}
        `)}
        <div class="settings-action">
          <button type="button" class="button btn-secondary btn-test" id="testAllBtn" onclick="testAll(this)">${escapeHtml(loc.get("gui_settings_test"))}</button>
          ${button(loc.get("gui_settings_save"), "submit")}
        </div>
      </form>
    `,
    "/settings",
    links
  );
}

function applySettings(context: AppContext, body: Record<string, string>): void {
  const cfg = context.config;
  cfg.everything.baseUrl = String(body.everythingBaseUrl ?? cfg.everything.baseUrl);
  cfg.everything.userName = body.everythingUserName ? String(body.everythingUserName) : null;
  cfg.everything.password = body.everythingPassword ? String(body.everythingPassword) : null;

  cfg.qBittorrent.baseUrl = String(body.qbBaseUrl ?? cfg.qBittorrent.baseUrl);
  cfg.qBittorrent.userName = body.qbUserName ? String(body.qbUserName) : null;
  cfg.qBittorrent.password = body.qbPassword ? String(body.qbPassword) : null;

  cfg.javDb.baseUrl = String(body.javDbBaseUrl ?? cfg.javDb.baseUrl);
  cfg.javDb.mirrorUrls = body.javDbMirrorUrls
    ? String(body.javDbMirrorUrls)
        .split(",")
        .map((value) => value.trim())
        .filter(Boolean)
    : [];

  cfg.download.defaultSavePath = String(body.defaultSavePath ?? cfg.download.defaultSavePath);
  cfg.download.defaultCategory = String(body.defaultCategory ?? cfg.download.defaultCategory);
  cfg.download.defaultTags = String(body.defaultTags ?? cfg.download.defaultTags);

  const language = body.language === "zh" ? "zh" : body.language === "ja" ? "ja" : body.language === "ko" ? "ko" : "en";
  cfg.console.language = language;
  context.loc.setLanguage(language);
}

function renderLayout(
  loc: LocalizationService,
  title: string,
  content: string,
  activePath = "/",
  links?: GuiExternalLinks
): string {
  const navItems = [
    { href: "/", label: loc.get("gui_nav_search"), icon: "&#9906;" },
    { href: "/downloads", label: loc.get("gui_nav_downloads"), icon: "&#8615;" },
    { href: "/settings", label: loc.get("gui_nav_settings"), icon: "&#9881;" },
  ];
  const navLinks = navItems
    .map((item) => {
      const active = item.href === activePath ? " active" : "";
      return `<a href="${item.href}" class="nav-link${active}"><span class="nav-icon">${item.icon}</span>${escapeHtml(item.label)}</a>`;
    })
    .join("");

  const brandHref = links?.repoUrl ? escapeHtml(links.repoUrl) : "/";
  const brandAttrs = links?.repoUrl ? ` target="_blank" rel="noopener noreferrer" title="GitHub"` : "";

  const themeButton = `<button type="button" id="themeToggle" class="nav-action nav-action-button" onclick="toggleTheme()" title="Dark/Light">${escapeHtml(loc.get("gui_theme_dark"))}</button>`;

  const cloudflareLink = links?.cloudflareUiUrl
    ? `<a class="nav-action" href="${escapeHtml(links.cloudflareUiUrl)}" target="_blank" rel="noopener noreferrer">
        <span class="nav-action-icon">↗</span>${escapeHtml(loc.get("gui_nav_cloudflare"))}
      </a>`
    : "";

  const actions = `<div class="nav-actions">${themeButton}${cloudflareLink}</div>`;

  return `<!doctype html>
  <html lang="${loc.currentLocale}">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${escapeHtml(title)} — ${escapeHtml(loc.get("gui_title"))}</title>
    <link rel="preconnect" href="https://fonts.googleapis.com" />
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
    <link href="https://fonts.googleapis.com/css2?family=DM+Mono:wght@400;500&family=Outfit:wght@300;400;500;600;700&display=swap" rel="stylesheet" />
    <style>${baseStyles()}</style>
  </head>
  <body>
    <nav class="nav">
      <a href="${brandHref}" class="nav-brand"${brandAttrs}>${escapeHtml(loc.get("gui_title"))}</a>
      <div class="nav-links">${navLinks}</div>
      ${actions}
    </nav>
    <main class="container">
      ${content}
    </main>
    <nav class="tabbar" aria-label="Tabs">
      ${navLinks}
    </nav>
    <script>${clientScript(loc)}</script>
  </body>
  </html>`;
}

function renderTorrentBadges(torrent: TorrentInfo): string {
  const badges: string[] = [];
  if (torrent.hasHd) badges.push(`<span class="badge badge-hd">HD</span>`);
  if (torrent.hasSubtitle) badges.push(`<span class="badge badge-sub">SUB</span>`);
  if (torrent.hasUncensoredMarker) badges.push(`<span class="badge badge-uc">${torrent.uncensoredMarkerType === UncensoredMarkerType.UC ? "UC" : "U"}</span>`);
  return badges.length ? `<span class="badges">${badges.join("")}</span>` : "";
}

function renderCard(title: string, body: string, escTitle = true): string {
  const heading = title ? `<h2>${escTitle ? escapeHtml(title) : title}</h2>` : "";
  return `<section class="card">
    ${heading}
    <div class="card-body">${body}</div>
  </section>`;
}

function renderStatus(loc: LocalizationService, status: string): string {
  if (!status) {
    return "";
  }
  const completionKeys = [
    "gui_status_search_complete",
    "gui_status_local_search_complete",
    "gui_status_remote_search_complete",
    "gui_status_local_and_remote_complete",
    "gui_status_searching",
  ];
  const isOk = completionKeys.some((k) => status === loc.get(k));
  const cls = isOk ? "status" : "status status-warn";
  return `<div class="${cls}">${escapeHtml(status)}</div>`;
}

function inputField(label: string, name: string, value: string, placeholder = "", type = "text"): string {
  const labelHtml = label ? `<span class="field-label">${escapeHtml(label)}</span>` : "";
  return `
    <label class="field">
      ${labelHtml}
      <input type="${type}" name="${escapeHtml(name)}" value="${escapeHtml(value)}" placeholder="${escapeHtml(
    placeholder
  )}" />
    </label>
  `;
}

function checkbox(label: string, name: string, checked: boolean): string {
  return `
    <label class="checkbox">
      <input type="checkbox" name="${escapeHtml(name)}" ${checked ? "checked" : ""} />
      <span>${escapeHtml(label)}</span>
    </label>
  `;
}

function selectField(label: string, name: string, value: string, options: Array<{ value: string; label: string }>): string {
  const optionHtml = options
    .map((option) => {
      const selected = option.value === value ? "selected" : "";
      return `<option value="${escapeHtml(option.value)}" ${selected}>${escapeHtml(option.label)}</option>`;
    })
    .join("");

  const labelHtml = label ? `<span class="field-label">${escapeHtml(label)}</span>` : "";
  return `
    <label class="field">
      ${labelHtml}
      <select name="${escapeHtml(name)}">${optionHtml}</select>
    </label>
  `;
}

function button(label: string, type: "submit" | "button"): string {
  return `<button class="button" type="${type}">${escapeHtml(label)}</button>`;
}

function tableHeader(headers: string[]): string {
  const cols = headers.map((header) => `<th>${escapeHtml(header)}</th>`).join("");
  return `<thead><tr>${cols}</tr></thead>`;
}

function hidden(name: string, value: string): string {
  return `<input type="hidden" name="${escapeHtml(name)}" value="${escapeHtml(value)}" />`;
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function escapeJs(value: string): string {
  return value.replace(/\\/g, "\\\\").replace(/'/g, "\\'").replace(/"/g, '\\"');
}

function formatSize(bytes: number): string {
  if (bytes <= 0) return "-";
  if (bytes >= 1024 * 1024 * 1024) return `${(bytes / 1024 / 1024 / 1024).toFixed(2)} GB`;
  if (bytes >= 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(2)} MB`;
  return `${(bytes / 1024).toFixed(2)} KB`;
}

function clientScript(loc: LocalizationService): string {
  const themeDark = escapeJs(loc.get("gui_theme_dark"));
  const themeLight = escapeJs(loc.get("gui_theme_light"));
  const downloadFailed = escapeJs(loc.get("gui_status_download_failed"));
  return `
    function ready(fn) {
      if (document.readyState !== 'loading') fn();
      else document.addEventListener('DOMContentLoaded', fn);
    }

    // Theme
    var THEME_LABEL_DARK = '${themeDark}';
    var THEME_LABEL_LIGHT = '${themeLight}';
    var DL_FAILED = '${downloadFailed}';
    function updateThemeToggle(theme) {
      var btn = document.getElementById('themeToggle');
      if (!btn) return;
      var label = (theme === 'light') ? THEME_LABEL_LIGHT : THEME_LABEL_DARK;
      btn.textContent = label;
      btn.setAttribute('title', THEME_LABEL_DARK + '/' + THEME_LABEL_LIGHT);
      btn.setAttribute('aria-label', THEME_LABEL_DARK + '/' + THEME_LABEL_LIGHT);
    }
    function applyTheme(theme) {
      if (!theme) return;
      document.documentElement.dataset.theme = theme;
      try { localStorage.setItem('gui.theme', theme); } catch (e) {}
      updateThemeToggle(theme);
    }

    function initTheme() {
      var stored = null;
      try { stored = localStorage.getItem('gui.theme'); } catch (e) {}
      if (stored === 'light' || stored === 'dark') {
        applyTheme(stored);
        return;
      }
      var prefersLight = false;
      try { prefersLight = window.matchMedia && window.matchMedia('(prefers-color-scheme: light)').matches; } catch (e) {}
      applyTheme(prefersLight ? 'light' : 'dark');
    }

    function toggleTheme() {
      var current = document.documentElement.dataset.theme || 'dark';
      applyTheme(current === 'light' ? 'dark' : 'light');
    }

    // Persist checkbox state in session
    function bindCheckbox(name, storageKey) {
      var el = document.querySelector('input[type=checkbox][name=\"' + name + '\"]');
      if (!el) return;
      var stored = null;
      try { stored = sessionStorage.getItem(storageKey); } catch (e) {}
      if (stored === '1' || stored === '0') {
        el.checked = stored === '1';
      } else {
        try { sessionStorage.setItem(storageKey, el.checked ? '1' : '0'); } catch (e) {}
      }
      el.addEventListener('change', function() {
        try { sessionStorage.setItem(storageKey, el.checked ? '1' : '0'); } catch (e) {}
      });
    }

    function escapeHtml(s) {
      return String(s || '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/\"/g, '&quot;')
        .replace(/'/g, '&#39;');
    }

    function formatSize(bytes) {
      bytes = Number(bytes) || 0;
      if (bytes <= 0) return '-';
      if (bytes >= 1024 * 1024 * 1024) return (bytes / 1024 / 1024 / 1024).toFixed(2) + ' GB';
      if (bytes >= 1024 * 1024) return (bytes / 1024 / 1024).toFixed(2) + ' MB';
      return (bytes / 1024).toFixed(2) + ' KB';
    }

    function showDownloadsError(message) {
      var container = document.getElementById('downloadsStatus');
      if (!container) return;
      container.innerHTML = '<div class=\"status status-warn\">' + escapeHtml(message) + '</div>';
    }

    function clearDownloadsStatus() {
      var container = document.getElementById('downloadsStatus');
      if (!container) return;
      container.innerHTML = '';
    }

    function loadDownloads() {
      var root = document.getElementById('downloadsRoot');
      if (!root) return;

      var loading = document.getElementById('downloadsLoading');
      var tableWrap = document.getElementById('downloadsTableWrap');
      if (loading) loading.style.display = 'flex';
      if (tableWrap) tableWrap.style.display = 'none';

      fetch('/api/downloads', { cache: 'no-store' })
        .then(function(r) { return r.json(); })
        .then(function(data) {
          if (!data || !data.ok) {
            showDownloadsError((data && data.error) ? data.error : DL_FAILED);
            return;
          }

          clearDownloadsStatus();

          var torrents = data.torrents || [];
          var countEl = document.getElementById('downloadsCount');
          if (countEl) {
            countEl.textContent = String(torrents.length || 0);
            countEl.style.display = torrents.length ? 'inline-flex' : 'none';
          }

          var body = document.getElementById('downloadsTbody');
          if (body) {
            var html = '';
            for (var i = 0; i < torrents.length; i++) {
              var t = torrents[i] || {};
              var name = t.name || t.title || '';
              var state = t.state || '-';
              html += '<tr>'
                + '<td class=\"td-title\">' + escapeHtml(name) + '</td>'
                + '<td><code>' + escapeHtml(state) + '</code></td>'
                + '<td class=\"td-size\"><code>' + escapeHtml(formatSize(t.size)) + '</code></td>'
                + '</tr>';
            }
            body.innerHTML = html;
          }

          if (tableWrap) tableWrap.style.display = 'block';
        })
        .catch(function() {
          showDownloadsError(DL_FAILED);
        })
        .finally(function() {
          if (loading) loading.style.display = 'none';
        });
    }

    // Search spinner + init hooks
    ready(function() {
      initTheme();
      bindCheckbox('searchLocal', 'gui.searchLocal');
      bindCheckbox('searchRemote', 'gui.searchRemote');

      var form = document.getElementById('searchForm');
      if (form) {
        form.addEventListener('submit', function() {
          var spinner = document.getElementById('searchSpinner');
          if (spinner) spinner.style.display = 'flex';
        });
      }

      // Defer downloads loading so the tab/page can render first.
      if (document.getElementById('downloadsRoot')) {
        setTimeout(loadDownloads, 0);
      }
    });

    // Test all services connectivity (uses current form values)
    function testAll(btn) {
      var orig = btn.textContent;
      btn.disabled = true;
      btn.textContent = '...';
      var container = document.getElementById('testResults');
      container.style.display = 'none';
      container.innerHTML = '';

      var getValue = function(name) {
        var el = document.querySelector('[name=\"' + name + '\"]');
        return el && typeof el.value === 'string' ? el.value : '';
      };
      var payload = {
        everythingBaseUrl: getValue('everythingBaseUrl'),
        everythingUserName: getValue('everythingUserName'),
        everythingPassword: getValue('everythingPassword'),
        qbBaseUrl: getValue('qbBaseUrl'),
        qbUserName: getValue('qbUserName'),
        qbPassword: getValue('qbPassword'),
        javDbBaseUrl: getValue('javDbBaseUrl'),
        javDbMirrorUrls: getValue('javDbMirrorUrls'),
      };

      fetch('/api/test-all', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      })
      .then(function(r) { return r.json(); })
      .then(function(data) {
        btn.disabled = false;
        btn.textContent = orig;
        if (!data.results || !data.results.length) {
          container.innerHTML = '<div class="test-item test-fail">No services found</div>';
          container.style.display = 'block';
          return;
        }
        var html = '';
        for (var i = 0; i < data.results.length; i++) {
          var r = data.results[i];
          var cls = r.ok ? 'test-ok' : 'test-fail';
          var icon = r.ok ? '✓' : '✗';
          var msg = r.message || (r.ok ? 'OK' : 'Failed');
          html += '<div class="test-item ' + cls + '"><span class="test-icon">' + icon + '</span><strong>' + r.name + '</strong> <span class="test-msg">' + msg + '</span></div>';
        }
        container.innerHTML = html;
        container.style.display = 'block';
      })
      .catch(function() {
        btn.disabled = false;
        btn.textContent = orig;
        container.innerHTML = '<div class="test-item test-fail">Request failed</div>';
        container.style.display = 'block';
      });
    }

    // Open file / folder
    function openFile(filePath) {
      fetch('/api/open-file', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ path: filePath })
      }).catch(function(){});
    }
    function openFolder(filePath) {
      fetch('/api/open-folder', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ path: filePath })
      }).catch(function(){});
    }
  `;
}

function baseStyles(): string {
  return `
    /* — Design tokens — */
    :root {
      --c-bg: #0c0e12;
      --c-surface: #14171e;
      --c-surface-hi: #1a1e28;
      --c-border: #242a36;
      --c-border-hi: #2f3747;
      --c-text: #d8dbe4;
      --c-text-dim: #7a8298;
      --c-text-bright: #f0f1f5;
      --c-accent: #3b82f6;
      --c-accent-dim: rgba(59,130,246,0.12);
      --c-green: #22c55e;
      --c-amber: #f59e0b;
      --c-rose: #f43f5e;
      --c-cyan: #06b6d4;
      --font-body: "Outfit", system-ui, sans-serif;
      --font-mono: "DM Mono", "Consolas", monospace;
      --radius: 0.5rem;
      --radius-lg: 0.75rem;
      font-size: 15px;
      color-scheme: dark;
    }

    :root[data-theme="light"] {
      --c-bg: #f6f7fb;
      --c-surface: #ffffff;
      --c-surface-hi: #f0f3fa;
      --c-border: #d6deef;
      --c-border-hi: #c3cde4;
      --c-text: #1f2937;
      --c-text-dim: #51607a;
      --c-text-bright: #0f172a;
      --c-accent: #2563eb;
      --c-accent-dim: rgba(37,99,235,0.12);
      --c-green: #16a34a;
      --c-amber: #d97706;
      --c-rose: #dc2626;
      --c-cyan: #0891b2;
      color-scheme: light;
    }

    /* — Reset — */
    *, *::before, *::after { box-sizing: border-box; }
    body {
      font-family: var(--font-body);
      font-weight: 400;
      margin: 0;
      background: var(--c-bg);
      color: var(--c-text);
      line-height: 1.55;
      -webkit-font-smoothing: antialiased;
    }

    /* — Navigation — */
    .nav {
      display: flex;
      align-items: center;
      gap: 0.25rem;
      padding: 0 1.5rem;
      height: 3.25rem;
      background: var(--c-surface);
      border-bottom: 1px solid var(--c-border);
      position: sticky;
      top: 0;
      z-index: 50;
    }
    .nav-brand {
      font-family: var(--font-mono);
      font-weight: 500;
      font-size: 0.85rem;
      color: var(--c-text-bright);
      text-decoration: none;
      letter-spacing: 0.04em;
      margin-right: 1.5rem;
      opacity: 0.85;
    }
    .nav-brand:hover { opacity: 1; }
    .nav-links { display: flex; gap: 0.125rem; }
    .nav-link {
      display: flex;
      align-items: center;
      gap: 0.35rem;
      padding: 0.4rem 0.75rem;
      border-radius: var(--radius);
      color: var(--c-text-dim);
      text-decoration: none;
      font-size: 0.82rem;
      font-weight: 500;
      transition: color 0.15s, background 0.15s;
    }
    .nav-link:hover { color: var(--c-text); background: var(--c-surface-hi); }
    .nav-link.active { color: var(--c-text-bright); background: var(--c-accent-dim); }
    .nav-icon { font-size: 0.95rem; line-height: 1; }

    /* — Mobile tabbar (hidden on desktop) — */
    .tabbar { display: none; }

    .nav-actions {
      margin-left: auto;
      display: flex;
      gap: 0.35rem;
      align-items: center;
      flex-wrap: wrap;
    }
    .nav-action {
      display: flex;
      align-items: center;
      gap: 0.35rem;
      padding: 0.35rem 0.65rem;
      border-radius: var(--radius);
      border: 1px solid var(--c-border);
      background: var(--c-bg);
      color: var(--c-text-dim);
      text-decoration: none;
      font-size: 0.78rem;
      font-weight: 500;
      transition: color 0.15s, background 0.15s, border-color 0.15s;
    }
    .nav-action-button {
      appearance: none;
      -webkit-appearance: none;
      cursor: pointer;
      font-family: var(--font-body);
    }
    .nav-action:hover {
      color: var(--c-text-bright);
      background: var(--c-surface-hi);
      border-color: var(--c-border-hi);
    }
    .nav-action-icon {
      font-family: var(--font-mono);
      font-size: 0.82rem;
      opacity: 0.9;
    }

    /* — Layout — */
    .container {
      max-width: min(110rem, 96vw);
      margin: 0 auto;
      padding: 1.25rem 1.5rem 3rem;
      display: flex;
      flex-direction: column;
      align-items: stretch;
      gap: 1rem;
      animation: fadeUp 0.3s ease-out;
    }
    @keyframes fadeUp {
      from { opacity: 0; transform: translateY(0.5rem); }
      to { opacity: 1; transform: translateY(0); }
    }

    /* — Card — */
    .card {
      background: var(--c-surface);
      padding: 1.25rem;
      border-radius: var(--radius-lg);
      border: 1px solid var(--c-border);
    }
    .card h2 {
      margin: 0 0 0.875rem 0;
      font-size: 0.82rem;
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 0.06em;
      color: var(--c-text-dim);
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 0.5rem;
    }
    .card-body {
      display: flex;
      flex-direction: column;
      gap: 0.6rem;
    }

    /* — Count badge in headings — */
    .count {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      min-width: 1.35rem;
      height: 1.15rem;
      padding: 0 0.35rem;
      border-radius: 99px;
      background: var(--c-accent-dim);
      color: var(--c-accent);
      font-family: var(--font-mono);
      font-size: 0.65rem;
      font-weight: 500;
      vertical-align: middle;
      margin-left: 0.35rem;
    }

    /* — Search form — */
    .search-form .search-row {
      display: flex;
      gap: 0.75rem;
      align-items: flex-end;
    }
    .search-form .search-row .field { flex: 1; }
    .search-form .search-row .button {
      height: 2.5rem;
      align-self: flex-end;
      flex-shrink: 0;
    }
    .search-form .search-row input { height: 2.5rem; }
    .search-form .row { margin-top: 0.6rem; }

    /* — Form elements — */
    .field {
      display: flex;
      flex-direction: column;
      gap: 0.3rem;
    }
    .field-label {
      font-size: 0.75rem;
      font-weight: 500;
      color: var(--c-text-dim);
      text-transform: uppercase;
      letter-spacing: 0.04em;
    }
    .field input, .field select {
      padding: 0.55rem 0.75rem;
      border-radius: var(--radius);
      border: 1px solid var(--c-border);
      background: var(--c-bg);
      color: var(--c-text-bright);
      font-family: var(--font-body);
      font-size: 0.875rem;
      width: 100%;
      outline: none;
      transition: border-color 0.15s, box-shadow 0.15s;
    }
    .field input:focus, .field select:focus {
      border-color: var(--c-accent);
      box-shadow: 0 0 0 2px var(--c-accent-dim);
    }
    .field input::placeholder { color: var(--c-text-dim); opacity: 0.6; }
    .row {
      display: flex;
      align-items: center;
      gap: 0.75rem;
      flex-wrap: wrap;
    }
    .checkbox {
      display: flex;
      gap: 0.4rem;
      align-items: center;
      font-size: 0.8rem;
      color: var(--c-text-dim);
      cursor: pointer;
      user-select: none;
    }
    .checkbox input[type="checkbox"] {
      width: 0.95rem;
      height: 0.95rem;
      accent-color: var(--c-accent);
      cursor: pointer;
    }

    /* — Button — */
    .button {
      padding: 0.5rem 1.1rem;
      border-radius: var(--radius);
      border: none;
      background: var(--c-accent);
      color: #fff;
      font-family: var(--font-body);
      font-size: 0.8rem;
      font-weight: 600;
      cursor: pointer;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      line-height: 1;
      transition: filter 0.15s, transform 0.1s;
      letter-spacing: 0.01em;
      text-decoration: none;
    }
    .button:hover { filter: brightness(1.15); }
    .button:active { transform: scale(0.97); }
    .btn-sm {
      padding: 0.3rem 0.7rem;
      font-size: 0.72rem;
    }
    .btn-secondary {
      background: var(--c-surface-hi);
      color: var(--c-text);
      border: 1px solid var(--c-border);
    }
    .btn-secondary:hover {
      background: var(--c-border);
      filter: none;
    }
    .btn-test {
      min-width: 5rem;
      transition: background 0.2s, color 0.2s;
    }
    .btn-test-ok {
      background: rgba(34,197,94,0.2) !important;
      color: var(--c-green) !important;
      border-color: var(--c-green) !important;
    }
    .btn-test-fail {
      background: rgba(244,63,94,0.2) !important;
      color: var(--c-rose) !important;
      border-color: var(--c-rose) !important;
    }

    /* — Status — */
    .status {
      padding: 0.6rem 0.9rem;
      border-radius: var(--radius);
      background: var(--c-accent-dim);
      font-size: 0.8rem;
      font-weight: 500;
      border-left: 3px solid var(--c-accent);
      color: var(--c-text);
    }
    .status-warn {
      background: rgba(245,158,11,0.08);
      border-left-color: var(--c-amber);
      color: #fbbf24;
    }

    /* — Spinner — */
    .spinner-wrap {
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 0.75rem;
      padding: 1.5rem;
    }
    .spinner {
      width: 1.5rem;
      height: 1.5rem;
      border: 2px solid var(--c-border);
      border-top-color: var(--c-accent);
      border-radius: 50%;
      animation: spin 0.7s linear infinite;
    }
    @keyframes spin {
      to { transform: rotate(360deg); }
    }
    .spinner-text {
      font-size: 0.85rem;
      color: var(--c-text-dim);
    }

    /* — Table — */
    .table-wrap { overflow-x: auto; }
    table { width: 100%; border-collapse: collapse; }
    thead th {
      text-align: left;
      padding: 0 0.5rem 0.6rem;
      font-size: 0.68rem;
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 0.06em;
      color: var(--c-text-dim);
      border-bottom: 1px solid var(--c-border);
    }
    td {
      padding: 0.65rem 0.5rem;
      font-size: 0.82rem;
      border-bottom: 1px solid var(--c-border);
      vertical-align: middle;
    }
    tr:last-child td { border-bottom: none; }
    .td-title {
      display: flex;
      align-items: baseline;
      gap: 0.5rem;
    }
    .td-actors {
      max-width: 12rem;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
      color: var(--c-text-dim);
    }
    .torrent-name {
      flex: 1;
      min-width: 0;
      word-break: break-all;
      line-height: 1.4;
    }
    .td-size {
      white-space: nowrap;
      width: 6rem;
      color: var(--c-text-dim);
    }
    .td-size code, td code {
      font-family: var(--font-mono);
      font-size: 0.78rem;
      background: var(--c-surface-hi);
      padding: 0.15rem 0.4rem;
      border-radius: 0.25rem;
    }
    .td-action {
      white-space: nowrap;
      text-align: right;
      width: 5.5rem;
    }
    .td-action form { display: inline; }
    .td-action .button {
      padding: 0.3rem 0.7rem;
      font-size: 0.72rem;
      align-self: auto;
    }

    /* — Torrent row highlight — */
    .torrent-best td {
      background: var(--c-accent-dim);
    }
    .torrent-best td:first-child {
      border-left: 2px solid var(--c-accent);
    }
    .torrent-row:not(.torrent-best):hover td {
      background: var(--c-surface-hi);
    }

    /* — Badges — */
    .badges {
      flex: none;
      display: inline-flex;
      gap: 0.25rem;
      margin-left: 0;
      vertical-align: middle;
    }
    .badge {
      display: inline-block;
      padding: 0.1rem 0.4rem;
      border-radius: 0.2rem;
      font-family: var(--font-mono);
      font-size: 0.6rem;
      font-weight: 500;
      letter-spacing: 0.04em;
      line-height: 1.4;
      vertical-align: middle;
    }
    .badge-hd { background: rgba(6,182,212,0.15); color: var(--c-cyan); }
    .badge-sub { background: rgba(34,197,94,0.15); color: var(--c-green); }
    .badge-uc { background: rgba(244,63,94,0.15); color: var(--c-rose); }

    /* — File list — */
    .file-list {
      list-style: none;
      padding: 0;
      margin: 0;
    }
    .file-item {
      display: grid;
      grid-template-columns: minmax(0, 1fr) auto;
      grid-template-rows: auto auto;
      column-gap: 0.75rem;
      row-gap: 0.25rem;
      align-items: center;
      padding: 0.55rem 0;
      border-bottom: 1px solid var(--c-border);
    }
    .file-item:last-child { border-bottom: none; }
    .file-info {
      font-size: 0.82rem;
      font-weight: 500;
      color: var(--c-text-bright);
      display: flex;
      align-items: center;
      gap: 0.5rem;
      flex-wrap: wrap;
      grid-column: 1;
      grid-row: 1;
    }
    .file-size {
      font-family: var(--font-mono);
      font-size: 0.72rem;
      background: var(--c-surface-hi);
      padding: 0.1rem 0.35rem;
      border-radius: 0.2rem;
      color: var(--c-text-dim);
    }
    .file-path {
      min-width: 0;
      font-family: var(--font-mono);
      font-size: 0.75rem;
      color: var(--c-text-dim);
      word-break: break-all;
      white-space: normal;
      grid-column: 1;
      grid-row: 2;
    }
    .file-actions {
      display: flex;
      gap: 0.3rem;
      flex-shrink: 0;
      grid-column: 2;
      grid-row: 1 / span 2;
      justify-self: end;
      white-space: nowrap;
    }
    .file-actions .button, .file-actions .btn-sm { white-space: nowrap; }

    /* — Detail page — */
    .detail-layout {
      display: flex;
      gap: 1.25rem;
    }
    .detail-cover {
      flex-shrink: 0;
      width: 14rem;
      max-height: 20rem;
      overflow: hidden;
      border-radius: var(--radius);
    }
    .detail-cover img {
      width: 100%;
      height: auto;
      object-fit: cover;
      border-radius: var(--radius);
    }
    .detail-meta {
      flex: 1;
      min-width: 0;
    }
    .meta-list {
      display: grid;
      grid-template-columns: auto 1fr;
      gap: 0.3rem 1rem;
      margin: 0;
    }
    .meta-list dt {
      font-size: 0.75rem;
      font-weight: 600;
      color: var(--c-text-dim);
      text-transform: uppercase;
      letter-spacing: 0.04em;
      padding-top: 0.15rem;
    }
    .meta-list dd {
      font-size: 0.85rem;
      margin: 0;
      color: var(--c-text);
      word-break: break-word;
    }

    /* — Settings grid — */
    .settings-grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(20rem, 1fr));
      gap: 1rem;
    }
    .settings-action {
      grid-column: 1 / -1;
      display: flex;
      justify-content: flex-end;
      align-items: center;
      gap: 0.5rem;
    }
    .settings-action .button { align-self: center; height: 2.5rem; }

    /* — Card external link — */
    .card-ext-link {
      display: inline-flex;
      align-items: center;
      gap: 0.2rem;
      font-size: 0.7rem;
      font-weight: 400;
      text-transform: none;
      letter-spacing: 0;
      color: var(--c-text-dim);
      text-decoration: none;
      opacity: 0.8;
      transition: opacity 0.15s, color 0.15s;
      vertical-align: middle;
      margin-left: 0.4rem;
    }
    .card-ext-link:hover {
      opacity: 1;
      color: var(--c-accent);
    }

    /* — Test results — */
    .test-results {
      display: flex;
      flex-direction: column;
      gap: 0.35rem;
    }
    .test-item {
      display: flex;
      align-items: center;
      gap: 0.5rem;
      padding: 0.45rem 0.75rem;
      border-radius: var(--radius);
      font-size: 0.8rem;
      font-weight: 500;
    }
    .test-item strong {
      min-width: 6rem;
    }
    .test-msg {
      font-weight: 400;
      color: var(--c-text-dim);
      font-family: var(--font-mono);
      font-size: 0.75rem;
    }
    .test-icon {
      font-size: 0.9rem;
      flex-shrink: 0;
    }
    .test-ok {
      background: rgba(34,197,94,0.08);
      border-left: 3px solid var(--c-green);
      color: var(--c-green);
    }
    .test-ok .test-msg { color: var(--c-green); }
    .test-fail {
      background: rgba(244,63,94,0.08);
      border-left: 3px solid var(--c-rose);
      color: var(--c-rose);
    }
    .test-fail .test-msg { color: var(--c-rose); }

    /* — Responsive — */
    @media (max-width: 640px) {
      .container {
        padding: 0.75rem;
        padding-bottom: calc(0.75rem + 4.25rem); /* room for bottom tabbar */
      }
      .nav {
        padding: 0.6rem 0.75rem;
        height: auto;
        gap: 0.4rem;
      }
      .nav-brand { margin-right: 0.75rem; }
      .nav-links { display: none; }
      .nav-actions {
        margin-left: auto;
        width: auto;
        justify-content: flex-end;
        flex-wrap: wrap;
      }

      /* Put tabs at the bottom on mobile */
      .tabbar {
        display: flex;
        position: fixed;
        left: 0;
        right: 0;
        bottom: 0;
        z-index: 60;
        padding: 0.35rem 0.5rem 0.35rem;
        padding-bottom: calc(0.35rem + env(safe-area-inset-bottom));
        background: var(--c-surface);
        border-top: 1px solid var(--c-border);
        justify-content: space-around;
        gap: 0.25rem;
      }
      .tabbar .nav-link {
        flex: 1;
        justify-content: center;
        flex-direction: column;
        gap: 0.15rem;
        padding: 0.4rem 0.35rem;
        font-size: 0.7rem;
        text-align: center;
      }
      .tabbar .nav-icon { font-size: 1.05rem; }

      /* Search form: left align JAV ID label + input on mobile */
      .search-form .search-row {
        flex-direction: column;
        align-items: stretch;
      }
      .search-form .search-row .button { align-self: stretch; }
      .search-form .field-label { text-align: left; }
      .settings-grid { grid-template-columns: 1fr; }
      .detail-layout { flex-direction: column; }
      .detail-cover { width: 100%; max-height: 16rem; }
    }

    @media (max-width: 480px) {
      .file-item {
        grid-template-columns: 1fr;
        grid-template-rows: auto auto auto;
      }
      .file-actions {
        grid-column: 1;
        grid-row: 3;
        justify-self: start;
      }
    }
  `;
}
