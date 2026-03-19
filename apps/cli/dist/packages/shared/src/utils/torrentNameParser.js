"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.parseTorrentName = parseTorrentName;
exports.normalizeJavId = normalizeJavId;
exports.isValidJavId = isValidJavId;
const models_1 = require("../models");
const uncensoredRegex = /-(?:UC|U)(?=$|[^A-Za-z0-9])/i;
function parseTorrentName(torrentName) {
    let uncensoredType = models_1.UncensoredMarkerType.None;
    const hasSubtitle = false;
    const match = torrentName.match(uncensoredRegex);
    if (match) {
        const marker = match[0].toUpperCase();
        if (marker === "-UC") {
            uncensoredType = models_1.UncensoredMarkerType.UC;
        }
        else if (marker === "-U") {
            uncensoredType = models_1.UncensoredMarkerType.U;
        }
    }
    if (uncensoredType === models_1.UncensoredMarkerType.None &&
        (torrentName.toLowerCase().includes("无码") ||
            torrentName.toLowerCase().includes("無碼") ||
            torrentName.toLowerCase().includes("uncensored"))) {
        uncensoredType = models_1.UncensoredMarkerType.U;
    }
    return { uncensoredType, hasSubtitle };
}
function normalizeJavId(javId) {
    const normalized = javId.trim().replace(/_/g, "-").toUpperCase();
    const noSpaces = normalized.replace(/\s+/g, "");
    if (/^[A-Z0-9]+-\d+$/.test(noSpaces)) {
        return noSpaces;
    }
    const extractable = normalized.replace(/[^A-Z0-9-]+/g, " ");
    const match = extractable.match(/\b[A-Z0-9]+-\d+\b/);
    if (match) {
        return match[0];
    }
    return noSpaces;
}
function isValidJavId(javId) {
    return /^[A-Z0-9]+-\d+$/i.test(javId);
}
