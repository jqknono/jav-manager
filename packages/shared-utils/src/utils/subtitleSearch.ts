import { SubtitleLanguageOption, SubtitleSearchItem } from "@jav-manager/domain";
import { isValidJavId, normalizeJavId } from "./torrentNameParser";
import { tryParseToBytes } from "./sizeParser";

const preferredLanguageRank: Record<string, number> = {
  "zh-cn": 100,
  zh: 95,
  "zh-tw": 90,
  ja: 40,
  en: 30,
};

export function parseSubtitleSize(text: string): number {
  const normalized = String(text ?? "").replace(/size/i, "").trim();
  return tryParseToBytes(normalized) ?? 0;
}

export function parseCount(text: string): number {
  const match = String(text ?? "").replace(/,/g, "").match(/(\d+)/);
  return match ? Number(match[1]) : 0;
}

export function extractSourceLanguage(text: string): string {
  const match = String(text ?? "").match(/translated from\s+([A-Za-z]+(?:\s+[A-Za-z]+)*)/i);
  return match?.[1]?.trim() ?? "";
}

export function isChineseLanguageCode(code: string): boolean {
  const normalized = normalizeLanguageCode(code);
  return normalized === "zh" || normalized.startsWith("zh-");
}

export function normalizeLanguageCode(code: string): string {
  return String(code ?? "").trim().toLowerCase().replace(/_/g, "-");
}

export function languagePreferenceScore(code: string, isOriginal = false): number {
  const normalized = normalizeLanguageCode(code);
  if (preferredLanguageRank[normalized] !== undefined) {
    return preferredLanguageRank[normalized] + (isOriginal ? 5 : 0);
  }
  if (normalized.startsWith("zh")) {
    return 85 + (isOriginal ? 5 : 0);
  }
  return isOriginal ? 20 : 0;
}

export function scoreSubtitleMatch(javId: string, title: string): number {
  const normalizedId = normalizeJavId(javId);
  if (!normalizedId) {
    return 0;
  }

  const compactId = normalizedId.replace(/-/g, "");
  const compactTitle = String(title ?? "").toUpperCase().replace(/[^A-Z0-9]/g, "");
  if (!compactTitle.includes(compactId)) {
    return 0;
  }
  if (compactTitle === compactId) {
    return 100;
  }
  if (compactTitle.startsWith(compactId)) {
    return 90;
  }
  return 75;
}

export function isExactJavSubtitle(javId: string, title: string): boolean {
  return scoreSubtitleMatch(javId, title) >= 75;
}

export function pickPreferredLanguage(item: SubtitleSearchItem, preferredCodes: string[] = ["zh-CN", "zh", "zh-TW"]): SubtitleLanguageOption | null {
  if (!item.languages.length) {
    return null;
  }

  const preferred = preferredCodes.map(normalizeLanguageCode);
  const ranked = [...item.languages].sort((left, right) => {
    const leftPreferred = preferred.indexOf(normalizeLanguageCode(left.code));
    const rightPreferred = preferred.indexOf(normalizeLanguageCode(right.code));
    const leftRank = leftPreferred >= 0 ? leftPreferred : 100;
    const rightRank = rightPreferred >= 0 ? rightPreferred : 100;
    if (leftRank !== rightRank) {
      return leftRank - rightRank;
    }
    if (left.isOriginal !== right.isOriginal) {
      return left.isOriginal ? -1 : 1;
    }
    return languagePreferenceScore(right.code, right.isOriginal) - languagePreferenceScore(left.code, left.isOriginal);
  });

  const preferredMatch = ranked.find((language) => preferred.includes(normalizeLanguageCode(language.code)));
  return preferredMatch ?? ranked[0] ?? null;
}

export function sortSubtitleItems(items: SubtitleSearchItem[]): SubtitleSearchItem[] {
  return [...items].sort((left, right) => {
    if (left.matchScore !== right.matchScore) {
      return right.matchScore - left.matchScore;
    }

    const leftChinese = left.languages.some((language) => isChineseLanguageCode(language.code));
    const rightChinese = right.languages.some((language) => isChineseLanguageCode(language.code));
    if (leftChinese !== rightChinese) {
      return leftChinese ? -1 : 1;
    }
    if (left.downloads !== right.downloads) {
      return right.downloads - left.downloads;
    }
    if (left.languageCount !== right.languageCount) {
      return right.languageCount - left.languageCount;
    }
    return left.title.localeCompare(right.title);
  });
}

export function buildSubtitleFileName(javId: string, languageCode: string, source: string): string {
  const id = normalizeJavId(javId) || "subtitle";
  const language = normalizeLanguageCode(languageCode) || "und";
  const sourceSlug = String(source ?? "subtitle")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "") || "subtitle";
  return `${id}.${sourceSlug}.${language}.srt`;
}

export function sanitizeFileName(value: string): string {
  return String(value ?? "")
    .trim()
    .replace(/[<>:"/\\|?*\u0000-\u001f]/g, "_")
    .replace(/\s+/g, " ");
}

export function resolveContentFileName(contentDisposition: string | null | undefined, fallback: string): string {
  const raw = String(contentDisposition ?? "");
  const utfMatch = raw.match(/filename\*=UTF-8''([^;]+)/i);
  if (utfMatch?.[1]) {
    try {
      return sanitizeFileName(decodeURIComponent(utfMatch[1]));
    } catch {
      return sanitizeFileName(utfMatch[1]);
    }
  }
  const quotedMatch = raw.match(/filename="([^"]+)"/i);
  if (quotedMatch?.[1]) {
    return sanitizeFileName(quotedMatch[1]);
  }
  const plainMatch = raw.match(/filename=([^;]+)/i);
  if (plainMatch?.[1]) {
    return sanitizeFileName(plainMatch[1].trim());
  }
  return sanitizeFileName(fallback);
}

export function looksLikeSrt(content: Uint8Array): boolean {
  const sample = new TextDecoder("utf-8", { fatal: false }).decode(content.subarray(0, 2048));
  if (!sample.trim()) {
    return false;
  }
  return /\d+\s*\r?\n\d{2}:\d{2}:\d{2}[,\.]\d{3}\s*-->\s*\d{2}:\d{2}:\d{2}[,\.]\d{3}/.test(sample);
}

export function normalizeSubtitleQuery(javId: string): string {
  const normalized = normalizeJavId(javId);
  return isValidJavId(normalized) ? normalized : String(javId ?? "").trim().toUpperCase();
}
