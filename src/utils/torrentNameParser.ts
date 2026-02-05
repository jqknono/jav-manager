import { UncensoredMarkerType } from "../models";

const uncensoredRegex = /-(?:UC|U)(?=$|[^A-Za-z0-9])/i;

export function parseTorrentName(torrentName: string): {
  uncensoredType: UncensoredMarkerType;
  hasSubtitle: boolean;
} {
  let uncensoredType = UncensoredMarkerType.None;
  const hasSubtitle = false;

  const match = torrentName.match(uncensoredRegex);
  if (match) {
    const marker = match[0].toUpperCase();
    if (marker === "-UC") {
      uncensoredType = UncensoredMarkerType.UC;
    } else if (marker === "-U") {
      uncensoredType = UncensoredMarkerType.U;
    }
  }

  if (
    uncensoredType === UncensoredMarkerType.None &&
    (torrentName.toLowerCase().includes("无码") ||
      torrentName.toLowerCase().includes("無碼") ||
      torrentName.toLowerCase().includes("uncensored"))
  ) {
    uncensoredType = UncensoredMarkerType.U;
  }

  return { uncensoredType, hasSubtitle };
}

export function normalizeJavId(javId: string): string {
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

export function isValidJavId(javId: string): boolean {
  return /^[A-Z0-9]+-\d+$/i.test(javId);
}
