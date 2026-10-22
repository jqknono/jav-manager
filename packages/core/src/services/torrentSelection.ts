import { TorrentInfo } from "@jav-manager/domain";
import { calculateAndSort } from "@jav-manager/shared-utils";

export class TorrentSelectionService {
  private hideOtherTorrents: boolean;

  constructor(hideOtherTorrents: boolean) {
    this.hideOtherTorrents = hideOtherTorrents;
  }

  selectBest(torrents: TorrentInfo[]): TorrentInfo | null {
    if (torrents.length === 0) {
      return null;
    }
    return this.getSortedTorrents(torrents)[0] ?? null;
  }

  getSortedTorrents(torrents: TorrentInfo[]): TorrentInfo[] {
    if (torrents.length === 0) {
      return torrents;
    }
    const sorted = calculateAndSort(torrents);
    if (!this.hideOtherTorrents) {
      return sorted;
    }
    return sorted.filter((torrent) => torrent.hasUncensoredMarker || torrent.hasSubtitle || torrent.hasHd);
  }
}
