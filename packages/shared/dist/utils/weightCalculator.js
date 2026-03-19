"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.calculateWeight = calculateWeight;
exports.calculateAndSort = calculateAndSort;
const UC_SCORE = 5;
const SUB_SCORE = 3;
const HD_SCORE = 1;
const titleUncensoredRegex = /-(?:UC|U)(?=$|[^A-Za-z0-9])/i;
function calculateWeight(torrent) {
    const hasUncensored = torrent.hasUncensoredMarker || titleUncensoredRegex.test(torrent.title);
    let score = 0;
    if (hasUncensored)
        score += UC_SCORE;
    if (torrent.hasSubtitle)
        score += SUB_SCORE;
    if (torrent.hasHd)
        score += HD_SCORE;
    // Keep derived field consistent with marker fallback, so downstream logic uses the same view.
    torrent.hasUncensoredMarker = hasUncensored;
    torrent.weightScore = score;
    return score;
}
function calculateAndSort(torrents) {
    for (const torrent of torrents) {
        calculateWeight(torrent);
    }
    return torrents
        .slice()
        .sort((a, b) => {
        if (a.weightScore !== b.weightScore) {
            return b.weightScore - a.weightScore;
        }
        if (a.size !== b.size) {
            return b.size - a.size;
        }
        return a.title.localeCompare(b.title);
    });
}
