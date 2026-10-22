import { JavSearchResult, TorrentInfo } from "@jav-manager/domain";
import { getJavInfoPostUrl, splitTitleVariants } from "@jav-manager/shared-utils";
import { TelemetryConfig } from "../config";

export class JavInfoTelemetryClient {
  private config: TelemetryConfig;
  private endpoint: string;

  constructor(config: TelemetryConfig) {
    this.config = config;
    this.endpoint = getJavInfoPostUrl(config.endpoint);
  }

  tryReport(result: JavSearchResult): void {
    if (!this.config.enabled) {
      return;
    }
    const javId = normalizeTelemetryText(result.javId);
    if (!javId) {
      return;
    }

    let title = normalizeTelemetryText(result.title);
    let titleZh = normalizeTelemetryText(result.titleZh);

    // Backward-compatible fallback:
    // if caller passed a combined title string (zh + marker + original),
    // split it so storage can keep title/title_zh separately.
    if (!titleZh && title) {
      const split = splitTitleVariants(title);
      const splitTitle = normalizeTelemetryText(split.title);
      const splitTitleZh = normalizeTelemetryText(split.titleZh);
      if (splitTitle) title = splitTitle;
      if (splitTitleZh) titleZh = splitTitleZh;
    }

    const payload = {
      jav_id: javId,
      title,
      title_zh: titleZh,
      cover_url: normalizeTelemetryText(result.coverUrl),
      release_date: normalizeTelemetryDate(result.releaseDate),
      duration: result.duration > 0 ? result.duration : null,
      director: normalizeTelemetryText(result.director),
      maker: normalizeTelemetryText(result.maker),
      publisher: normalizeTelemetryText(result.publisher),
      series: normalizeTelemetryText(result.series),
      actors: normalizeTelemetryList(result.actors),
      categories: normalizeTelemetryList(result.categories),
      torrents: normalizeTelemetryTorrents(result.torrents),
      detail_url: normalizeTelemetryText(result.detailUrl),
    };

    void fetch(this.endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    }).catch(() => undefined);
  }
}

function normalizeTelemetryText(value?: string | null): string | null {
  if (typeof value !== "string") {
    return null;
  }
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}

function normalizeTelemetryDate(value?: string | null): string | null {
  const text = normalizeTelemetryText(value);
  if (!text) {
    return null;
  }

  // Keep already-normalized YYYY-MM-DD.
  if (/^\d{4}-\d{2}-\d{2}$/.test(text)) {
    return text;
  }

  const parsed = new Date(text);
  if (Number.isNaN(parsed.getTime())) {
    return text;
  }
  return parsed.toISOString().slice(0, 10);
}

function normalizeTelemetryList(values?: string[] | null): string[] {
  if (!Array.isArray(values)) {
    return [];
  }

  const deduped = new Set<string>();
  for (const value of values) {
    const normalized = normalizeTelemetryText(value);
    if (normalized) {
      deduped.add(normalized);
    }
  }
  return Array.from(deduped);
}

function normalizeTelemetryTorrents(torrents?: TorrentInfo[] | null): Array<Record<string, unknown>> {
  if (!Array.isArray(torrents)) {
    return [];
  }

  return torrents.map((torrent) => ({
    title: normalizeTelemetryText(torrent.title),
    magnet_link: normalizeTelemetryText(torrent.magnetLink),
    torrent_url: normalizeTelemetryText(torrent.torrentUrl),
    size: typeof torrent.size === "number" && Number.isFinite(torrent.size) ? torrent.size : 0,
    has_uncensored_marker: !!torrent.hasUncensoredMarker,
    uncensored_marker_type: normalizeTelemetryText(String(torrent.uncensoredMarkerType ?? "")),
    has_subtitle: !!torrent.hasSubtitle,
    has_hd: !!torrent.hasHd,
    seeders: typeof torrent.seeders === "number" && Number.isFinite(torrent.seeders) ? torrent.seeders : 0,
    leechers: typeof torrent.leechers === "number" && Number.isFinite(torrent.leechers) ? torrent.leechers : 0,
    source_site: normalizeTelemetryText(torrent.sourceSite),
    weight_score: typeof torrent.weightScore === "number" && Number.isFinite(torrent.weightScore) ? torrent.weightScore : 0,
  }));
}
