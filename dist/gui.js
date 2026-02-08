"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.startGuiServer = startGuiServer;
const express_1 = __importDefault(require("express"));
const node_os_1 = __importDefault(require("node:os"));
const config_1 = require("./config");
const models_1 = require("./models");
const torrentNameParser_1 = require("./utils/torrentNameParser");
const telemetryEndpoints_1 = require("./utils/telemetryEndpoints");
const defaultPort = 4860;
const defaultHost = "0.0.0.0";
function startGuiServer(context, port = defaultPort, host = defaultHost) {
    const app = (0, express_1.default)();
    app.use(express_1.default.urlencoded({ extended: true }));
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
        const normalized = (0, torrentNameParser_1.normalizeJavId)(query);
        let status = context.loc.get("gui_status_searching");
        let localFiles = [];
        let torrents = [];
        const warnings = [];
        if (normalized) {
            context.services.telemetryService.trackSearch(normalized);
            if (searchLocal) {
                try {
                    const files = await context.services.localFileCheckService.checkLocalFiles(normalized);
                    localFiles = files.map((file) => `${file.fileName} - ${file.fullPath}`);
                }
                catch (error) {
                    warnings.push(formatSearchError(context.loc, error));
                }
            }
            if (searchRemote) {
                try {
                    const searchResult = await context.services.javSearchService.searchOnly(normalized, false);
                    torrents = searchResult.availableTorrents;
                }
                catch (error) {
                    warnings.push(formatSearchError(context.loc, error));
                }
            }
            status = warnings.length ? warnings.join("; ") : context.loc.get("gui_status_ready");
        }
        res.send(renderSearchPage(context.loc, externalLinks, { query, searchLocal, searchRemote, status, localFiles, torrents, javId: normalized }));
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
                const torrent = {
                    title,
                    magnetLink,
                    size,
                    hasHd,
                    hasSubtitle,
                    hasUncensoredMarker: hasUncensored,
                    uncensoredMarkerType: hasUncensored
                        ? hasSubtitle
                            ? models_1.UncensoredMarkerType.UC
                            : models_1.UncensoredMarkerType.U
                        : models_1.UncensoredMarkerType.None,
                    seeders: 0,
                    leechers: 0,
                    sourceSite: "JavDB",
                    dlSpeed: 0,
                    eta: 0,
                    weightScore: 0,
                };
                await context.services.downloadService.addDownload(torrent);
                context.services.telemetryService.trackDownload(javId || (0, torrentNameParser_1.normalizeJavId)(title));
                status = context.loc.get("gui_status_download_added");
            }
            catch (error) {
                status = error instanceof Error ? error.message : context.loc.get("gui_status_download_failed");
            }
        }
        res.send(renderSearchPage(context.loc, externalLinks, { query: javId, searchLocal: true, searchRemote: true, status }));
    });
    app.get("/downloads", async (_, res) => {
        let torrents = [];
        let status = "";
        try {
            torrents = await context.services.downloadService.getDownloads();
        }
        catch (error) {
            status = formatDownloadsError(context.loc, error);
        }
        res.send(renderDownloadsPage(context.loc, externalLinks, torrents, status));
    });
    app.get("/settings", (_, res) => {
        res.send(renderSettingsPage(context.loc, externalLinks, context));
    });
    app.post("/settings", async (req, res) => {
        applySettings(context, req.body);
        (0, config_1.saveConfig)(context.config);
        res.send(renderSettingsPage(context.loc, externalLinks, context, context.loc.get("gui_settings_saved")));
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
function getGuiUrls(host, port) {
    const urls = [];
    const normalizedHost = (host ?? "").trim();
    const isAllInterfaces = normalizedHost === "0.0.0.0" || normalizedHost === "::" || normalizedHost === "";
    // Always show localhost as a friendly default for the same machine.
    urls.push(`http://localhost:${port}`);
    if (!isAllInterfaces) {
        urls.push(`http://${normalizedHost}:${port}`);
        return Array.from(new Set(urls));
    }
    // Also show LAN IPs when listening on all interfaces.
    const nets = node_os_1.default.networkInterfaces();
    for (const iface of Object.values(nets)) {
        for (const addr of iface ?? []) {
            if (!addr || addr.internal)
                continue;
            if (addr.family !== "IPv4")
                continue;
            // Skip link-local.
            if (addr.address.startsWith("169.254."))
                continue;
            urls.push(`http://${addr.address}:${port}`);
        }
    }
    return Array.from(new Set(urls));
}
function getGuiExternalLinks(context) {
    const repo = String(context.config.update?.gitHubRepo ?? "").trim();
    const repoUrl = repo ? `https://github.com/${repo}` : "https://github.com/jqknono/jav-manager";
    const cloudflareUiUrl = (0, telemetryEndpoints_1.getBaseEndpoint)(context.config.telemetry?.endpoint);
    return { repoUrl, cloudflareUiUrl };
}
function renderSearchPage(loc, links, data) {
    const localFiles = data.localFiles ?? [];
    const torrents = data.torrents ?? [];
    const localSection = localFiles.length
        ? renderCard(loc.get("gui_section_local_files"), `<ul class="file-list">${localFiles.map((file) => `<li>${escapeHtml(file)}</li>`).join("")}</ul>`)
        : "";
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
            ${hidden("javId", data.javId ?? data.query)}
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
        ? renderCard(`${loc.get("gui_section_torrents")} ${torrentCount}`, `<div class="table-wrap"><table>${tableHeader([loc.get("gui_table_title"), loc.get("gui_table_size"), ""])}<tbody>${torrentRows}</tbody></table></div>`, false)
        : "";
    return renderLayout(loc, loc.get("gui_nav_search"), `
      ${renderStatus(loc, data.status)}
      ${renderCard("", `<form method="post" action="/search" class="search-form">
          <div class="search-row">
            ${inputField(loc.get("gui_label_jav_id"), "query", data.query, loc.get("gui_placeholder_jav_id"))}
            ${button(loc.get("gui_search_button"), "submit")}
          </div>
          <div class="row">
            ${checkbox(loc.get("gui_label_search_local"), "searchLocal", data.searchLocal)}
            ${checkbox(loc.get("gui_label_search_remote"), "searchRemote", data.searchRemote)}
          </div>
        </form>`)}
      ${localSection}
      ${torrentSection}
    `, "/", links);
}
function renderDownloadsPage(loc, links, torrents, status) {
    const rows = torrents
        .map((torrent) => `<tr>
        <td class="td-title">${escapeHtml(torrent.name ?? torrent.title)}</td>
        <td><code>${escapeHtml(torrent.state ?? "-")}</code></td>
        <td class="td-size"><code>${formatSize(torrent.size)}</code></td>
      </tr>`)
        .join("");
    const dlCount = torrents.length ? `<span class="count">${torrents.length}</span>` : "";
    const statusHtml = status ? renderStatus(loc, status) : "";
    const content = `
    ${statusHtml}
    ${renderCard(`${loc.get("gui_nav_downloads")} ${dlCount}`, `<div class="table-wrap"><table>${tableHeader([
        loc.get("gui_table_name"),
        loc.get("gui_table_state"),
        loc.get("gui_table_size"),
    ])}<tbody>${rows}</tbody></table></div>`, false)}
  `;
    return renderLayout(loc, loc.get("gui_nav_downloads"), content, "/downloads", links);
}
function formatDownloadsError(loc, error) {
    const message = error instanceof Error ? error.message : loc.get("gui_status_download_failed");
    // Convert common config errors into actionable UI hints.
    if (/qBittorrent\.BaseUrl\s+is\s+empty/i.test(message)) {
        const settingsLabel = loc.get("gui_nav_settings");
        return `${loc.get("gui_status_download_failed")}: ${loc.getFormat("gui_error_qb_not_configured", settingsLabel)}`;
    }
    return `${loc.get("gui_status_download_failed")}: ${message}`;
}
function formatSearchError(loc, error) {
    const message = error instanceof Error ? error.message : loc.get("gui_status_download_failed");
    // Convert common config errors into actionable UI hints.
    if (/Everything\.BaseUrl\s+is\s+empty/i.test(message)) {
        const settingsLabel = loc.get("gui_nav_settings");
        return loc.getFormat("gui_error_everything_not_configured", settingsLabel);
    }
    return message || loc.get("gui_status_download_failed");
}
function renderSettingsPage(loc, links, context, status) {
    const cfg = context.config;
    return renderLayout(loc, loc.get("gui_nav_settings"), `
      ${renderStatus(loc, status ?? "")}
      <form method="post" action="/settings" class="settings-grid">
        ${renderCard(loc.get("gui_settings_section_everything"), `
          ${inputField(loc.get("gui_field_base_url"), "everythingBaseUrl", cfg.everything.baseUrl)}
          ${inputField(loc.get("gui_field_username"), "everythingUserName", cfg.everything.userName ?? "")}
          ${inputField(loc.get("gui_field_password"), "everythingPassword", cfg.everything.password ?? "", "", "password")}
        `)}
        ${renderCard(loc.get("gui_settings_section_qbittorrent"), `
          ${inputField(loc.get("gui_field_base_url"), "qbBaseUrl", cfg.qBittorrent.baseUrl)}
          ${inputField(loc.get("gui_field_username"), "qbUserName", cfg.qBittorrent.userName ?? "")}
          ${inputField(loc.get("gui_field_password"), "qbPassword", cfg.qBittorrent.password ?? "", "", "password")}
        `)}
        ${renderCard(loc.get("gui_settings_section_javdb"), `
          ${inputField(loc.get("gui_field_base_url"), "javDbBaseUrl", cfg.javDb.baseUrl)}
          ${inputField(loc.get("gui_field_mirror_urls"), "javDbMirrorUrls", cfg.javDb.mirrorUrls.join(","))}
        `)}
        ${renderCard(loc.get("gui_settings_section_download"), `
          ${inputField(loc.get("gui_field_default_save_path"), "defaultSavePath", cfg.download.defaultSavePath)}
          ${inputField(loc.get("gui_field_default_category"), "defaultCategory", cfg.download.defaultCategory)}
          ${inputField(loc.get("gui_field_default_tags"), "defaultTags", cfg.download.defaultTags)}
        `)}
        ${renderCard(loc.get("gui_settings_section_language"), `
          ${selectField("", "language", cfg.console.language, [
        { value: "en", label: "English" },
        { value: "zh", label: "中文" },
    ])}
        `)}
        <div class="settings-action">
          ${button(loc.get("gui_settings_save"), "submit")}
        </div>
      </form>
    `, "/settings", links);
}
function applySettings(context, body) {
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
    const language = body.language === "zh" ? "zh" : "en";
    cfg.console.language = language;
    context.loc.setLanguage(language);
}
function renderLayout(loc, title, content, activePath = "/", links) {
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
    const brandAttrs = links?.repoUrl ? ` target="_blank" rel="noopener noreferrer"` : "";
    const actions = links
        ? `
      <div class="nav-actions">
        <a class="nav-action" href="${escapeHtml(links.cloudflareUiUrl)}" target="_blank" rel="noopener noreferrer">
          <span class="nav-action-icon">↗</span>${escapeHtml(loc.get("gui_nav_cloudflare"))}
        </a>
      </div>
    `
        : "";
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
  </body>
  </html>`;
}
function renderTorrentBadges(torrent) {
    const badges = [];
    if (torrent.hasHd)
        badges.push(`<span class="badge badge-hd">HD</span>`);
    if (torrent.hasSubtitle)
        badges.push(`<span class="badge badge-sub">SUB</span>`);
    if (torrent.hasUncensoredMarker)
        badges.push(`<span class="badge badge-uc">${torrent.uncensoredMarkerType === models_1.UncensoredMarkerType.UC ? "UC" : "U"}</span>`);
    return badges.length ? `<span class="badges">${badges.join("")}</span>` : "";
}
function renderCard(title, body, escTitle = true) {
    const heading = title ? `<h2>${escTitle ? escapeHtml(title) : title}</h2>` : "";
    return `<section class="card">
    ${heading}
    <div class="card-body">${body}</div>
  </section>`;
}
function renderStatus(loc, status) {
    if (!status) {
        return "";
    }
    const isWarning = status !== loc.get("gui_status_ready") && status !== loc.get("gui_status_searching");
    const cls = isWarning ? "status status-warn" : "status";
    return `<div class="${cls}">${escapeHtml(status)}</div>`;
}
function inputField(label, name, value, placeholder = "", type = "text") {
    const labelHtml = label ? `<span class="field-label">${escapeHtml(label)}</span>` : "";
    return `
    <label class="field">
      ${labelHtml}
      <input type="${type}" name="${escapeHtml(name)}" value="${escapeHtml(value)}" placeholder="${escapeHtml(placeholder)}" />
    </label>
  `;
}
function checkbox(label, name, checked) {
    return `
    <label class="checkbox">
      <input type="checkbox" name="${escapeHtml(name)}" ${checked ? "checked" : ""} />
      <span>${escapeHtml(label)}</span>
    </label>
  `;
}
function selectField(label, name, value, options) {
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
function button(label, type) {
    return `<button class="button" type="${type}">${escapeHtml(label)}</button>`;
}
function tableHeader(headers) {
    const cols = headers.map((header) => `<th>${escapeHtml(header)}</th>`).join("");
    return `<thead><tr>${cols}</tr></thead>`;
}
function hidden(name, value) {
    return `<input type="hidden" name="${escapeHtml(name)}" value="${escapeHtml(value)}" />`;
}
function escapeHtml(value) {
    return value
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#39;");
}
function formatSize(bytes) {
    if (bytes <= 0)
        return "-";
    if (bytes >= 1024 * 1024 * 1024)
        return `${(bytes / 1024 / 1024 / 1024).toFixed(2)} GB`;
    if (bytes >= 1024 * 1024)
        return `${(bytes / 1024 / 1024).toFixed(2)} MB`;
    return `${(bytes / 1024).toFixed(2)} KB`;
}
function baseStyles() {
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

    .nav-actions {
      margin-left: auto;
      display: flex;
      gap: 0.35rem;
      align-items: center;
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
      max-width: 64rem;
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
      align-self: flex-start;
      transition: filter 0.15s, transform 0.1s;
      letter-spacing: 0.01em;
    }
    .button:hover { filter: brightness(1.15); }
    .button:active { transform: scale(0.97); }

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
      width: 4.5rem;
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
    .file-list li {
      padding: 0.45rem 0;
      border-bottom: 1px solid var(--c-border);
      font-size: 0.82rem;
      font-family: var(--font-mono);
      word-break: break-all;
      color: var(--c-text-dim);
    }
    .file-list li:last-child { border-bottom: none; }

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
    }

    /* — Responsive — */
    @media (max-width: 640px) {
      .container { padding: 0.75rem; }
      .nav {
        padding: 0.6rem 0.75rem;
        height: auto;
        flex-wrap: wrap;
        gap: 0.4rem;
      }
      .nav-brand { margin-right: 0.75rem; }
      .nav-links { flex-wrap: wrap; }
      .nav-actions {
        margin-left: 0;
        width: 100%;
        justify-content: flex-start;
        flex-wrap: wrap;
      }
      .search-form .search-row { flex-direction: column; }
      .search-form .search-row .button { align-self: stretch; }
      .settings-grid { grid-template-columns: 1fr; }
    }
  `;
}
