import { TorrentInfo } from "../models";

export function calculateWeight(torrent: TorrentInfo): number {
  let score = 0;
  if (torrent.hasHd) score += 1;
  if (torrent.hasUncensoredMarker) score += 1;
  if (torrent.hasSubtitle) score += 1;
  torrent.weightScore = score;
  return score;
}

export function calculateAndSort(torrents: TorrentInfo[]): TorrentInfo[] {
  for (const torrent of torrents) {
    calculateWeight(torrent);
  }

  return torrents
    .slice()
    .sort((a, b) => {
      if (a.hasUncensoredMarker !== b.hasUncensoredMarker) {
        return a.hasUncensoredMarker ? -1 : 1;
      }
      if (a.hasSubtitle !== b.hasSubtitle) {
        return a.hasSubtitle ? -1 : 1;
      }
      if (a.hasHd !== b.hasHd) {
        return a.hasHd ? -1 : 1;
      }
      if (a.weightScore !== b.weightScore) {
        return b.weightScore - a.weightScore;
      }
      return b.size - a.size;
    });
}
