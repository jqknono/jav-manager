export type TitleVariants = {
  // Original title (typically Japanese for JavDB).
  title: string;
  // Translated title (typically Chinese when JavDB locale is zh).
  titleZh?: string;
};

const ORIGINAL_TITLE_MARKERS = [
  "顯示原標題",
  "显示原标题",
  "Show original title",
  "Show Original Title",
];

function containsKana(s: string): boolean {
  for (const ch of Array.from(s)) {
    const cp = ch.codePointAt(0) ?? 0;
    // Hiragana, Katakana, Halfwidth Katakana
    if ((cp >= 0x3040 && cp <= 0x309f) || (cp >= 0x30a0 && cp <= 0x30ff) || (cp >= 0xff65 && cp <= 0xff9f)) {
      return true;
    }
  }
  return false;
}

function splitOnce(haystack: string, needle: string): { left: string; right: string } | null {
  const idx = haystack.indexOf(needle);
  if (idx < 0) return null;
  return {
    left: haystack.slice(0, idx),
    right: haystack.slice(idx + needle.length),
  };
}

export function splitTitleVariants(rawTitle: string): TitleVariants {
  const normalized = (rawTitle ?? "").replace(/\s+/g, " ").trim();
  if (!normalized) return { title: "" };

  for (const marker of ORIGINAL_TITLE_MARKERS) {
    const parts = splitOnce(normalized, marker);
    if (!parts) continue;

    const a = parts.left.trim();
    const b = parts.right.trim();

    // If we only got one meaningful side, just drop the marker.
    if (!a || !b) {
      const title = (a || b || "").trim();
      return { title };
    }

    // Heuristic: the side with kana is likely the original Japanese title.
    const aKana = containsKana(a);
    const bKana = containsKana(b);

    if (bKana && !aKana) return { title: b, titleZh: a };
    if (aKana && !bKana) return { title: a, titleZh: b };

    // Fallback: JavDB typically renders zh title before the marker, original after.
    return { title: b, titleZh: a };
  }

  return { title: normalized };
}

