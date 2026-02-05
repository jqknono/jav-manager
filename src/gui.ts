import express from "express";
import { AppContext } from "./context";
import { saveConfig } from "./config";
import { LocalizationService } from "./localization";
import { TorrentInfo, UncensoredMarkerType } from "./models";
import { normalizeJavId } from "./utils/torrentNameParser";

const defaultPort = 4860;

export function startGuiServer(context: AppContext, port: number = defaultPort): void {
  const app = express();
  app.use(express.urlencoded({ extended: true }));

  app.get("/", async (req, res) => {
    const query = typeof req.query.q === "string" ? req.query.q : "";
    const searchLocal = req.query.local !== "0";
    const searchRemote = req.query.remote !== "0";
    const status = "";
    res.send(renderSearchPage(context.loc, { query, searchLocal, searchRemote, status }));
  });

  app.post("/search", async (req, res) => {
    const query = String(req.body.query ?? "");
    const searchLocal = Boolean(req.body.searchLocal);
    const searchRemote = Boolean(req.body.searchRemote);
    const normalized = normalizeJavId(query);

    let status = context.loc.get("gui_status_searching");
    let localFiles: string[] = [];
    let torrents: TorrentInfo[] = [];

    if (normalized) {
      try {
        if (searchLocal) {
          const files = await context.services.localFileCheckService.checkLocalFiles(normalized);
          localFiles = files.map((file) => `${file.fileName} - ${file.fullPath}`);
        }
        if (searchRemote) {
          const searchResult = await context.services.javSearchService.searchOnly(normalized, false);
          torrents = searchResult.availableTorrents;
        }
        status = context.loc.get("gui_status_ready");
      } catch (error) {
        status = error instanceof Error ? error.message : context.loc.get("gui_status_download_failed");
      }
    }

    res.send(renderSearchPage(context.loc, { query, searchLocal, searchRemote, status, localFiles, torrents, javId: normalized }));
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
        status = context.loc.get("gui_status_download_added");
      } catch (error) {
        status = error instanceof Error ? error.message : context.loc.get("gui_status_download_failed");
      }
    }

    res.send(renderSearchPage(context.loc, { query: javId, searchLocal: true, searchRemote: true, status }));
  });

  app.get("/downloads", async (_, res) => {
    const torrents = await context.services.downloadService.getDownloads();
    res.send(renderDownloadsPage(context.loc, torrents));
  });

  app.get("/settings", (_, res) => {
    res.send(renderSettingsPage(context.loc, context));
  });

  app.post("/settings", async (req, res) => {
    applySettings(context, req.body);
    saveConfig(context.config);
    res.send(renderSettingsPage(context.loc, context, context.loc.get("gui_settings_saved")));
  });

  app.listen(port, () => {
    console.log(`GUI running at http://localhost:${port}`);
  });
}

function renderSearchPage(
  loc: LocalizationService,
  data: {
    query: string;
    searchLocal: boolean;
    searchRemote: boolean;
    status: string;
    localFiles?: string[];
    torrents?: TorrentInfo[];
    javId?: string;
  }
): string {
  const localFiles = data.localFiles ?? [];
  const torrents = data.torrents ?? [];

  const localSection = localFiles.length
    ? renderCard(loc.get("gui_section_local_files"), `<ul>${localFiles.map((file) => `<li>${escapeHtml(file)}</li>`).join("")}</ul>`)
    : "";

  const torrentRows = torrents
    .map(
      (torrent) => `<tr>
        <td>${escapeHtml(torrent.title)}</td>
        <td>${formatSize(torrent.size)}</td>
        <td>
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
      </tr>`
    )
    .join("");

  const torrentSection = torrents.length
    ? renderCard(
        loc.get("gui_section_torrents"),
        `<table>${tableHeader(["Title", "Size", ""])}<tbody>${torrentRows}</tbody></table>`
      )
    : "";

  return renderLayout(
    loc,
    loc.get("gui_nav_search"),
    `
      ${renderStatus(loc, data.status)}
      ${renderCard(
        loc.get("gui_nav_search"),
        `<form method="post" action="/search">
          ${inputField("JAV ID", "query", data.query, "e.g. ABC-123")}
          <div class="row">
            ${checkbox("Search local", "searchLocal", data.searchLocal)}
            ${checkbox("Search remote", "searchRemote", data.searchRemote)}
          </div>
          ${button(loc.get("gui_search_button"), "submit")}
        </form>`
      )}
      ${localSection}
      ${torrentSection}
    `
  );
}

function renderDownloadsPage(loc: LocalizationService, torrents: TorrentInfo[]): string {
  const rows = torrents
    .map(
      (torrent) => `<tr>
        <td>${escapeHtml(torrent.name ?? torrent.title)}</td>
        <td>${escapeHtml(torrent.state ?? "-")}</td>
        <td>${formatSize(torrent.size)}</td>
      </tr>`
    )
    .join("");

  const content = renderCard(
    loc.get("gui_nav_downloads"),
    `<table>${tableHeader(["Name", "State", "Size"])}<tbody>${rows}</tbody></table>`
  );

  return renderLayout(loc, loc.get("gui_nav_downloads"), content);
}

function renderSettingsPage(loc: LocalizationService, context: AppContext, status?: string): string {
  const cfg = context.config;
  return renderLayout(
    loc,
    loc.get("gui_nav_settings"),
    `
      ${renderStatus(loc, status ?? "")}
      ${renderCard(
        loc.get("gui_nav_settings"),
        `<form method="post" action="/settings">
          <h3>Everything</h3>
          ${inputField("Base URL", "everythingBaseUrl", cfg.everything.baseUrl)}
          ${inputField("User Name", "everythingUserName", cfg.everything.userName ?? "")}
          ${inputField("Password", "everythingPassword", cfg.everything.password ?? "", "", "password")}

          <h3>qBittorrent</h3>
          ${inputField("Base URL", "qbBaseUrl", cfg.qBittorrent.baseUrl)}
          ${inputField("User Name", "qbUserName", cfg.qBittorrent.userName ?? "")}
          ${inputField("Password", "qbPassword", cfg.qBittorrent.password ?? "", "", "password")}

          <h3>JavDB</h3>
          ${inputField("Base URL", "javDbBaseUrl", cfg.javDb.baseUrl)}
          ${inputField("Mirror URLs (comma)", "javDbMirrorUrls", cfg.javDb.mirrorUrls.join(","))}

          <h3>Download</h3>
          ${inputField("Default Save Path", "defaultSavePath", cfg.download.defaultSavePath)}
          ${inputField("Default Category", "defaultCategory", cfg.download.defaultCategory)}
          ${inputField("Default Tags", "defaultTags", cfg.download.defaultTags)}

          <h3>Language</h3>
          ${selectField("language", cfg.console.language, [
            { value: "en", label: "English" },
            { value: "zh", label: "中文" },
          ])}

          ${button(loc.get("gui_settings_save"), "submit")}
        </form>`
      )}
    `
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

  const language = body.language === "zh" ? "zh" : "en";
  cfg.console.language = language;
  context.loc.setLanguage(language);
}

function renderLayout(loc: LocalizationService, title: string, content: string): string {
  return `<!doctype html>
  <html lang="${loc.currentLocale}">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${escapeHtml(title)}</title>
    <style>${baseStyles()}</style>
  </head>
  <body>
    <nav class="nav">
      <div class="nav-title">${escapeHtml(loc.get("gui_title"))}</div>
      <a href="/">${escapeHtml(loc.get("gui_nav_search"))}</a>
      <a href="/downloads">${escapeHtml(loc.get("gui_nav_downloads"))}</a>
      <a href="/settings">${escapeHtml(loc.get("gui_nav_settings"))}</a>
    </nav>
    <main class="container">
      ${content}
    </main>
  </body>
  </html>`;
}

function renderCard(title: string, body: string): string {
  return `<section class="card">
    <h2>${escapeHtml(title)}</h2>
    <div class="card-body">${body}</div>
  </section>`;
}

function renderStatus(loc: LocalizationService, status: string): string {
  if (!status) {
    return "";
  }
  return `<div class="status">${escapeHtml(status)}</div>`;
}

function inputField(label: string, name: string, value: string, placeholder = "", type = "text"): string {
  return `
    <label class="field">
      <span>${escapeHtml(label)}</span>
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

function selectField(name: string, value: string, options: Array<{ value: string; label: string }>): string {
  const optionHtml = options
    .map((option) => {
      const selected = option.value === value ? "selected" : "";
      return `<option value="${escapeHtml(option.value)}" ${selected}>${escapeHtml(option.label)}</option>`;
    })
    .join("");

  return `
    <label class="field">
      <span>${escapeHtml(name)}</span>
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

function formatSize(bytes: number): string {
  if (bytes <= 0) return "-";
  if (bytes >= 1024 * 1024 * 1024) return `${(bytes / 1024 / 1024 / 1024).toFixed(2)} GB`;
  if (bytes >= 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(2)} MB`;
  return `${(bytes / 1024).toFixed(2)} KB`;
}

function baseStyles(): string {
  return `
    :root {
      font-size: 16px;
      color-scheme: light dark;
    }
    body {
      font-family: "Segoe UI", system-ui, sans-serif;
      margin: 0;
      background: #0f1115;
      color: #f4f4f6;
    }
    .nav {
      display: flex;
      align-items: center;
      gap: 1rem;
      padding: 1rem 1.5rem;
      background: #171a21;
      position: sticky;
      top: 0;
    }
    .nav-title {
      font-size: 1.1rem;
      font-weight: 600;
      margin-right: 1rem;
    }
    .nav a {
      color: #e1e4ea;
      text-decoration: none;
      font-size: 0.95rem;
    }
    .container {
      max-width: 72rem;
      margin: 0 auto;
      padding: 1.5rem;
      display: flex;
      flex-direction: column;
      gap: 1.25rem;
    }
    .card {
      background: #1e222b;
      padding: 1.25rem;
      border-radius: 0.8rem;
      box-shadow: 0 0.4rem 1.2rem rgba(0,0,0,0.2);
    }
    .card h2 {
      margin: 0 0 0.75rem 0;
      font-size: 1.1rem;
    }
    .card-body {
      display: flex;
      flex-direction: column;
      gap: 0.9rem;
    }
    .field {
      display: flex;
      flex-direction: column;
      gap: 0.4rem;
    }
    .field input, .field select {
      padding: 0.6rem 0.8rem;
      border-radius: 0.5rem;
      border: 0.08rem solid #2b3140;
      background: #11141a;
      color: #f4f4f6;
      font-size: 0.95rem;
    }
    .row {
      display: flex;
      gap: 1rem;
      flex-wrap: wrap;
    }
    .checkbox {
      display: flex;
      gap: 0.4rem;
      align-items: center;
      font-size: 0.9rem;
    }
    .button {
      padding: 0.6rem 1.2rem;
      border-radius: 0.6rem;
      border: none;
      background: #4c8bf5;
      color: #fff;
      font-weight: 600;
      cursor: pointer;
      align-self: flex-start;
    }
    .status {
      padding: 0.75rem 1rem;
      border-radius: 0.6rem;
      background: rgba(76,139,245,0.15);
      font-size: 0.9rem;
    }
    table {
      width: 100%;
      border-collapse: collapse;
    }
    th, td {
      text-align: left;
      padding: 0.6rem 0.4rem;
      font-size: 0.9rem;
      border-bottom: 0.08rem solid #2b3140;
    }
    @media (max-width: 640px) {
      .container {
        padding: 1rem;
      }
      .nav {
        flex-wrap: wrap;
      }
    }
  `;
}
