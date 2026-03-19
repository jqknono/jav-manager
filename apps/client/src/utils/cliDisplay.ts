/**
 * CLI display utilities — rich terminal output via ANSI escape sequences.
 *
 * Zero external dependencies. Works on modern terminals (Windows Terminal,
 * iTerm2, most Linux terminals). Gracefully degrades when NO_COLOR is set.
 */

// ─── ANSI primitives ────────────────────────────────────────────────

const isColorDisabled = (): boolean =>
  !!process.env.NO_COLOR || process.env.TERM === "dumb";

function esc(code: string): string {
  return isColorDisabled() ? "" : `\x1b[${code}m`;
}

// Reset
const R = (): string => esc("0");

// Styles
const BOLD = (): string => esc("1");
const DIM = (): string => esc("2");
const ITALIC = (): string => esc("3");
const UNDERLINE = (): string => esc("4");

// Foreground colors
const FG_BLACK = (): string => esc("30");
const FG_RED = (): string => esc("31");
const FG_GREEN = (): string => esc("32");
const FG_YELLOW = (): string => esc("33");
const FG_BLUE = (): string => esc("34");
const FG_MAGENTA = (): string => esc("35");
const FG_CYAN = (): string => esc("36");
const FG_WHITE = (): string => esc("37");
const FG_GRAY = (): string => esc("90");

// Bright foreground
const FG_BRIGHT_RED = (): string => esc("91");
const FG_BRIGHT_GREEN = (): string => esc("92");
const FG_BRIGHT_YELLOW = (): string => esc("93");
const FG_BRIGHT_BLUE = (): string => esc("94");
const FG_BRIGHT_MAGENTA = (): string => esc("95");
const FG_BRIGHT_CYAN = (): string => esc("96");
const FG_BRIGHT_WHITE = (): string => esc("97");

// Background colors
const BG_BLACK = (): string => esc("40");
const BG_RED = (): string => esc("41");
const BG_GREEN = (): string => esc("42");
const BG_YELLOW = (): string => esc("43");
const BG_BLUE = (): string => esc("44");
const BG_MAGENTA = (): string => esc("45");
const BG_CYAN = (): string => esc("46");

// ─── Semantic helpers ───────────────────────────────────────────────

export function c(text: string, ...codes: Array<() => string>): string {
  if (isColorDisabled()) return text;
  return codes.map((fn) => fn()).join("") + text + R();
}

// Strip ANSI codes for width calculations
function stripAnsi(s: string): string {
  return s.replace(/\x1b\[[0-9;]*m/g, "");
}

function visibleLength(s: string): number {
  const plain = stripAnsi(s);
  let width = 0;
  for (const ch of Array.from(plain)) {
    width += charWidth(ch);
  }
  return width;
}

function padEnd(s: string, width: number): string {
  const vl = visibleLength(s);
  return vl >= width ? s : s + " ".repeat(width - vl);
}

function padStart(s: string, width: number): string {
  const vl = visibleLength(s);
  return vl >= width ? s : " ".repeat(width - vl) + s;
}

function centerPad(s: string, width: number): string {
  const vl = visibleLength(s);
  if (vl >= width) return s;
  const left = Math.floor((width - vl) / 2);
  const right = width - vl - left;
  return " ".repeat(left) + s + " ".repeat(right);
}

function truncateText(s: string, width: number): string {
  if (width <= 0) return "";
  if (visibleLength(s) <= width) return s;

  const chars = Array.from(s);
  if (width <= 3) {
    let out = "";
    let used = 0;
    for (const ch of chars) {
      const w = charWidth(ch);
      if (used + w > width) break;
      out += ch;
      used += w;
    }
    return out;
  }

  const target = width - 3;
  let out = "";
  let used = 0;
  for (const ch of chars) {
    const w = charWidth(ch);
    if (used + w > target) break;
    out += ch;
    used += w;
  }
  return `${out}...`;
}

function wrapText(s: string, width: number): string[] {
  if (width <= 0) return [""];
  if (!s) return [""];
  if (visibleLength(s) <= width) return [s];

  const lines: string[] = [];
  let line = "";
  let used = 0;
  for (const ch of Array.from(s)) {
    const w = charWidth(ch);
    // If the next character doesn't fit, start a new line.
    // If the line is empty, still emit the char even if it exceeds width (avoids infinite loops).
    if (line && used + w > width) {
      lines.push(line);
      line = "";
      used = 0;
    }
    line += ch;
    used += w;
  }
  if (line) lines.push(line);
  return lines.length > 0 ? lines : [""];
}

function charWidth(ch: string): number {
  const codePoint = ch.codePointAt(0);
  if (!codePoint) return 0;
  if (isControl(codePoint) || isCombining(codePoint)) return 0;
  return isFullWidth(codePoint) ? 2 : 1;
}

function isControl(codePoint: number): boolean {
  return (codePoint >= 0 && codePoint < 32) || (codePoint >= 0x7f && codePoint < 0xa0);
}

function isCombining(codePoint: number): boolean {
  return (
    (codePoint >= 0x0300 && codePoint <= 0x036f) || // Combining Diacritical Marks
    (codePoint >= 0x1ab0 && codePoint <= 0x1aff) || // Combining Diacritical Marks Extended
    (codePoint >= 0x1dc0 && codePoint <= 0x1dff) || // Combining Diacritical Marks Supplement
    (codePoint >= 0x20d0 && codePoint <= 0x20ff) || // Combining Diacritical Marks for Symbols
    (codePoint >= 0xfe20 && codePoint <= 0xfe2f)    // Combining Half Marks
  );
}

function isFullWidth(codePoint: number): boolean {
  return (
    codePoint >= 0x1100 && (
      codePoint <= 0x115f || // Hangul Jamo
      codePoint === 0x2329 ||
      codePoint === 0x232a ||
      (codePoint >= 0x2e80 && codePoint <= 0xa4cf && codePoint !== 0x303f) || // CJK ... Yi
      (codePoint >= 0xac00 && codePoint <= 0xd7a3) || // Hangul Syllables
      (codePoint >= 0xf900 && codePoint <= 0xfaff) || // CJK Compatibility Ideographs
      (codePoint >= 0xfe10 && codePoint <= 0xfe19) || // Vertical forms
      (codePoint >= 0xfe30 && codePoint <= 0xfe6f) || // CJK Compatibility Forms + Small Form Variants
      (codePoint >= 0xff00 && codePoint <= 0xff60) || // Fullwidth Forms
      (codePoint >= 0xffe0 && codePoint <= 0xffe6) ||
      (codePoint >= 0x1f300 && codePoint <= 0x1f64f) || // Emojis
      (codePoint >= 0x1f900 && codePoint <= 0x1f9ff) ||
      (codePoint >= 0x20000 && codePoint <= 0x3fffd)
    )
  );
}

// ─── Box-drawing characters (Unicode) ───────────────────────────────

const BOX = {
  tl: "\u250C", // ┌
  tr: "\u2510", // ┐
  bl: "\u2514", // └
  br: "\u2518", // ┘
  h: "\u2500",  // ─
  v: "\u2502",  // │
  lT: "\u251C", // ├
  rT: "\u2524", // ┤
  tT: "\u252C", // ┬
  bT: "\u2534", // ┴
  cross: "\u253C", // ┼

  // Double-line variants for emphasis
  dh: "\u2550", // ═
  dv: "\u2551", // ║
  dtl: "\u2554", // ╔
  dtr: "\u2557", // ╗
  dbl: "\u255A", // ╚
  dbr: "\u255D", // ╝
  dlT: "\u2560", // ╠
  drT: "\u2563", // ╣
} as const;

// ─── Terminal width ─────────────────────────────────────────────────

function getTermWidth(): number {
  return process.stdout.columns || 80;
}

function clampWidth(desired: number): number {
  return Math.min(desired, getTermWidth());
}

// ─── Public components ──────────────────────────────────────────────

/**
 * Print the app banner at startup.
 */
export function printBanner(appName: string, version: string): void {
  const w = clampWidth(56);
  const inner = w - 4; // inside the double-line box

  const titleText = `${appName} v${version}`;
  const subtitle = "Content Management CLI";

  const top = `${c(BOX.dtl + BOX.dh.repeat(w - 2) + BOX.dtr, FG_CYAN)}`;
  const bot = `${c(BOX.dbl + BOX.dh.repeat(w - 2) + BOX.dbr, FG_CYAN)}`;
  const mid = `${c(BOX.dlT + BOX.dh.repeat(w - 2) + BOX.drT, FG_CYAN)}`;
  const vb = c(BOX.dv, FG_CYAN);
  const empty = `${vb} ${" ".repeat(inner)} ${vb}`;

  console.log("");
  console.log(top);
  console.log(empty);
  console.log(`${vb} ${centerPad(c(titleText, BOLD, FG_BRIGHT_WHITE), inner)} ${vb}`);
  console.log(`${vb} ${centerPad(c(subtitle, DIM, FG_GRAY), inner)} ${vb}`);
  console.log(empty);
  console.log(mid);

  // Minimal keyboard hints
  const hints = [
    `${c("JAV-ID", FG_BRIGHT_CYAN)} search & download`,
    `${c("help", FG_BRIGHT_CYAN)}   show commands`,
    `${c("quit", FG_BRIGHT_CYAN)}   exit`,
  ];

  for (const hint of hints) {
    console.log(`${vb} ${padEnd("  " + hint, inner)} ${vb}`);
  }
  console.log(bot);
  console.log("");
}

/**
 * Print structured help with category groupings.
 */
export function printHelp(commands: Array<{ cmd: string; desc: string; category: string }>): void {
  const w = clampWidth(62);
  const inner = w - 4;

  const headerLine = c(BOX.h.repeat(w), FG_CYAN);
  console.log("");
  console.log(headerLine);
  console.log(c("  COMMANDS", BOLD, FG_BRIGHT_WHITE));
  console.log(headerLine);

  // Group by category
  const categories = new Map<string, Array<{ cmd: string; desc: string }>>();
  for (const item of commands) {
    if (!categories.has(item.category)) {
      categories.set(item.category, []);
    }
    categories.get(item.category)!.push({ cmd: item.cmd, desc: item.desc });
  }

  for (const [cat, items] of categories) {
    console.log("");
    console.log(`  ${c(cat, BOLD, FG_YELLOW)}`);
    for (const item of items) {
      const cmdPart = c(item.cmd, FG_BRIGHT_CYAN);
      console.log(`    ${padEnd(cmdPart, 22)} ${c(item.desc, FG_WHITE)}`);
    }
  }

  console.log("");
  console.log(headerLine);
  console.log("");
}

/**
 * Display search results as a formatted, numbered table.
 */
export function printTorrentList(
  javId: string,
  torrents: Array<{ title: string; size: string; tags: string[] }>,
  legend?: string,
): void {
  if (torrents.length === 0) return;

  const totalWidth = getTermWidth();
  let idxW = 3;
  let sizeW = 10;
  let tagsW = 14;
  const colCount = 4;
  const baseOverhead = 2 + 1 + colCount * 2 + (colCount - 1) + 2; // indent + borders/padding
  let titleW = totalWidth - baseOverhead - idxW - sizeW - tagsW;
  if (titleW < 16) {
    tagsW = 10;
    titleW = totalWidth - baseOverhead - idxW - sizeW - tagsW;
  }
  if (titleW < 16) {
    sizeW = 8;
    titleW = totalWidth - baseOverhead - idxW - sizeW - tagsW;
  }
  titleW = Math.max(16, titleW);

  const top = c(
    BOX.tl + BOX.h.repeat(idxW + 2) + BOX.tT + BOX.h.repeat(titleW + 2) + BOX.tT + BOX.h.repeat(sizeW + 2) + BOX.tT + BOX.h.repeat(tagsW + 2) + BOX.tr,
    FG_GRAY
  );
  const mid = c(
    BOX.lT + BOX.h.repeat(idxW + 2) + BOX.cross + BOX.h.repeat(titleW + 2) + BOX.cross + BOX.h.repeat(sizeW + 2) + BOX.cross + BOX.h.repeat(tagsW + 2) + BOX.rT,
    FG_GRAY
  );
  const bot = c(
    BOX.bl + BOX.h.repeat(idxW + 2) + BOX.bT + BOX.h.repeat(titleW + 2) + BOX.bT + BOX.h.repeat(sizeW + 2) + BOX.bT + BOX.h.repeat(tagsW + 2) + BOX.br,
    FG_GRAY
  );

  console.log("");
  console.log(`  ${c("Results for", DIM, FG_GRAY)} ${c(javId, BOLD, FG_BRIGHT_WHITE)}`);
  console.log(`  ${top}`);
  console.log(
    `  ${c(BOX.v, FG_GRAY)} ${padStart(c("#", BOLD, FG_BRIGHT_WHITE), idxW)} ${c(BOX.v, FG_GRAY)} ${padEnd(c("Title", BOLD, FG_BRIGHT_WHITE), titleW)} ${c(BOX.v, FG_GRAY)} ${padEnd(c("Size", BOLD, FG_BRIGHT_WHITE), sizeW)} ${c(BOX.v, FG_GRAY)} ${padEnd(c("Tags", BOLD, FG_BRIGHT_WHITE), tagsW)} ${c(BOX.v, FG_GRAY)}`
  );
  console.log(`  ${mid}`);

  for (let i = 0; i < torrents.length; i++) {
    const t = torrents[i];
    const idx = String(i + 1);
    const title = truncateText(t.title, titleW);
    const size = t.size !== "-" ? t.size : "-";
    const tags = truncateText(t.tags.join(" "), tagsW);
    console.log(
      `  ${c(BOX.v, FG_GRAY)} ${padStart(c(idx, FG_GRAY), idxW)} ${c(BOX.v, FG_GRAY)} ${padEnd(c(title, FG_WHITE), titleW)} ${c(BOX.v, FG_GRAY)} ${padEnd(c(size, FG_BRIGHT_YELLOW), sizeW)} ${c(BOX.v, FG_GRAY)} ${padEnd(c(tags, FG_WHITE), tagsW)} ${c(BOX.v, FG_GRAY)}`
    );
  }

  console.log(`  ${bot}`);
  if (legend) {
    console.log(`  ${c(legend, DIM, FG_GRAY)}`);
  }
}

/**
 * Display searchable candidate items before showing torrents.
 */
export function printSearchResultList(
  query: string,
  items: Array<{ javId: string; title: string; source: string }>,
): void {
  if (items.length === 0) return;

  const totalWidth = getTermWidth();
  let idxW = 3;
  let javIdW = 12;
  let sourceW = 8;
  const colCount = 4;
  const baseOverhead = 2 + 1 + colCount * 2 + (colCount - 1) + 2; // indent + borders/padding
  let titleW = totalWidth - baseOverhead - idxW - javIdW - sourceW;
  if (titleW < 18) {
    javIdW = 10;
    sourceW = 6;
    titleW = totalWidth - baseOverhead - idxW - javIdW - sourceW;
  }
  titleW = Math.max(18, titleW);

  const top = c(
    BOX.tl + BOX.h.repeat(idxW + 2) + BOX.tT + BOX.h.repeat(javIdW + 2) + BOX.tT + BOX.h.repeat(sourceW + 2) + BOX.tT + BOX.h.repeat(titleW + 2) + BOX.tr,
    FG_GRAY
  );
  const mid = c(
    BOX.lT + BOX.h.repeat(idxW + 2) + BOX.cross + BOX.h.repeat(javIdW + 2) + BOX.cross + BOX.h.repeat(sourceW + 2) + BOX.cross + BOX.h.repeat(titleW + 2) + BOX.rT,
    FG_GRAY
  );
  const bot = c(
    BOX.bl + BOX.h.repeat(idxW + 2) + BOX.bT + BOX.h.repeat(javIdW + 2) + BOX.bT + BOX.h.repeat(sourceW + 2) + BOX.bT + BOX.h.repeat(titleW + 2) + BOX.br,
    FG_GRAY
  );

  console.log("");
  console.log(`  ${c("SEARCH RESULTS", BOLD, FG_BRIGHT_WHITE)} ${c(`(${items.length})`, DIM, FG_GRAY)} ${c(`for ${query}`, DIM, FG_GRAY)}`);
  console.log(`  ${top}`);
  console.log(
    `  ${c(BOX.v, FG_GRAY)} ${padStart(c("#", BOLD, FG_BRIGHT_WHITE), idxW)} ${c(BOX.v, FG_GRAY)} ${padEnd(c("JAV-ID", BOLD, FG_BRIGHT_WHITE), javIdW)} ${c(BOX.v, FG_GRAY)} ${padEnd(c("Source", BOLD, FG_BRIGHT_WHITE), sourceW)} ${c(BOX.v, FG_GRAY)} ${padEnd(c("Title", BOLD, FG_BRIGHT_WHITE), titleW)} ${c(BOX.v, FG_GRAY)}`
  );
  console.log(`  ${mid}`);

  for (let i = 0; i < items.length; i++) {
    const item = items[i];
    const idx = String(i + 1);
    const id = truncateText(item.javId || "-", javIdW);
    const source = truncateText(item.source || "-", sourceW);
    const titleLines = wrapText(item.title || "", titleW);

    for (let lineIdx = 0; lineIdx < titleLines.length; lineIdx++) {
      const showMeta = lineIdx === 0;
      const idxCell = showMeta ? padStart(c(idx, FG_GRAY), idxW) : padStart("", idxW);
      const idCell = showMeta ? padEnd(c(id, FG_BRIGHT_CYAN, BOLD), javIdW) : padEnd("", javIdW);
      const sourceCell = showMeta ? padEnd(c(source, FG_GRAY), sourceW) : padEnd("", sourceW);
      const titleCell = padEnd(c(titleLines[lineIdx] ?? "", FG_WHITE), titleW);
      console.log(
        `  ${c(BOX.v, FG_GRAY)} ${idxCell} ${c(BOX.v, FG_GRAY)} ${idCell} ${c(BOX.v, FG_GRAY)} ${sourceCell} ${c(BOX.v, FG_GRAY)} ${titleCell} ${c(BOX.v, FG_GRAY)}`
      );
    }
  }

  console.log(`  ${bot}`);
}

/**
 * Format a torrent tag badge.
 */
function formatTag(tag: string): string {
  const upper = tag.toUpperCase();
  if (upper.includes("UC") || upper.includes("UNCENSOR")) {
    return c(` ${tag} `, BG_MAGENTA, FG_BRIGHT_WHITE, BOLD);
  }
  if (upper.includes("SUB") || upper.includes("字幕")) {
    return c(` ${tag} `, BG_CYAN, FG_BLACK, BOLD);
  }
  if (upper.includes("HD") || upper.includes("4K") || upper.includes("1080")) {
    return c(` ${tag} `, BG_BLUE, FG_BRIGHT_WHITE, BOLD);
  }
  return c(` ${tag} `, BG_BLACK, FG_GRAY);
}

/**
 * Print health check results with status indicators.
 */
export function printHealthResults(results: Array<{ name: string; healthy: boolean; message: string }>): void {
  const w = clampWidth(60);
  const line = c(BOX.h.repeat(w), FG_GRAY);

  console.log("");
  console.log(`  ${c("SERVICE HEALTH", BOLD, FG_BRIGHT_WHITE)}`);
  console.log(line);

  for (const r of results) {
    const icon = r.healthy
      ? c("\u25CF", FG_BRIGHT_GREEN)  // ●
      : c("\u25CF", FG_BRIGHT_RED);   // ●
    const status = r.healthy
      ? c("OK", FG_BRIGHT_GREEN)
      : c("FAIL", FG_BRIGHT_RED, BOLD);
    const name = padEnd(c(r.name, FG_WHITE), 20);
    const msg = r.message ? c(r.message, DIM, FG_GRAY) : "";
    console.log(`  ${icon} ${name} ${status}  ${msg}`);
  }

  console.log(line);
  console.log("");
}

/**
 * Print config as a structured key-value display.
 */
export function printConfig(entries: Array<{ section: string; key: string; value: string; masked?: boolean }>): void {
  const w = clampWidth(60);
  const line = c(BOX.h.repeat(w), FG_GRAY);

  console.log("");
  console.log(`  ${c("CONFIGURATION", BOLD, FG_BRIGHT_WHITE)}`);
  console.log(line);

  let lastSection = "";
  for (const entry of entries) {
    if (entry.section !== lastSection) {
      if (lastSection) console.log("");
      console.log(`  ${c(entry.section, BOLD, FG_YELLOW)}`);
      lastSection = entry.section;
    }
    const key = padEnd(c(entry.key, FG_CYAN), 18);
    const val = entry.masked
      ? c(entry.value, DIM, FG_GRAY)
      : (entry.value === "-" ? c("-", DIM, FG_GRAY) : c(entry.value, FG_WHITE));
    console.log(`    ${key} ${val}`);
  }

  console.log(line);
  console.log("");
}

/**
 * Print cache statistics.
 */
export function printCacheStats(totalJav: number, totalTorrents: number, sizeBytes: number): void {
  const w = clampWidth(50);
  const line = c(BOX.h.repeat(w), FG_GRAY);

  console.log("");
  console.log(`  ${c("CACHE STATISTICS", BOLD, FG_BRIGHT_WHITE)}`);
  console.log(line);
  console.log(`    ${c("Items", FG_CYAN)}      ${c(String(totalJav), FG_BRIGHT_WHITE, BOLD)}`);
  console.log(`    ${c("Torrents", FG_CYAN)}   ${c(String(totalTorrents), FG_BRIGHT_WHITE, BOLD)}`);
  console.log(`    ${c("Size", FG_CYAN)}       ${c(formatBytes(sizeBytes), FG_BRIGHT_YELLOW)}`);
  console.log(line);
  console.log("");
}

/**
 * Print a download list.
 */
export function printDownloadList(downloads: Array<{ name: string; size: string; state: string }>): void {
  if (downloads.length === 0) {
    printInfo("No active downloads");
    return;
  }

  const w = clampWidth(80);
  const line = c(BOX.h.repeat(w), FG_GRAY);

  console.log("");
  console.log(`  ${c("DOWNLOADS", BOLD, FG_BRIGHT_WHITE)} ${c(`(${downloads.length})`, DIM, FG_GRAY)}`);
  console.log(line);

  for (const d of downloads) {
    const stateColor = getStateColor(d.state);
    const icon = getStateIcon(d.state);
    const name = c(d.name, FG_WHITE);
    const size = c(d.size, FG_BRIGHT_YELLOW);
    const state = c(d.state, ...stateColor);

    console.log(`  ${icon} ${name}`);
    console.log(`       ${size}  ${state}`);
  }

  console.log(line);
  console.log("");
}

/**
 * Print local file results.
 */
export function printLocalFiles(
  files: Array<{ name: string; size: string; path: string }>,
  options?: { startIndex?: number; totalCount?: number; page?: number; totalPages?: number },
): void {
  if (files.length === 0) return;

  const startIndex = options?.startIndex ?? 0;
  const totalCount = options?.totalCount ?? files.length;
  const page = options?.page;
  const totalPages = options?.totalPages;

  const totalWidth = getTermWidth();
  let idxW = 3;
  let nameW = 24;
  let sizeW = 10;
  const colCount = 4;
  const baseOverhead = 2 + 1 + colCount * 2 + (colCount - 1) + 2; // indent + borders/padding
  let pathW = totalWidth - baseOverhead - idxW - nameW - sizeW;
  if (pathW < 20) {
    nameW = 18;
    pathW = totalWidth - baseOverhead - idxW - nameW - sizeW;
  }
  if (pathW < 16) {
    sizeW = 8;
    pathW = totalWidth - baseOverhead - idxW - nameW - sizeW;
  }
  pathW = Math.max(16, pathW);

  const top = c(
    BOX.tl + BOX.h.repeat(idxW + 2) + BOX.tT + BOX.h.repeat(nameW + 2) + BOX.tT + BOX.h.repeat(sizeW + 2) + BOX.tT + BOX.h.repeat(pathW + 2) + BOX.tr,
    FG_GRAY
  );
  const mid = c(
    BOX.lT + BOX.h.repeat(idxW + 2) + BOX.cross + BOX.h.repeat(nameW + 2) + BOX.cross + BOX.h.repeat(sizeW + 2) + BOX.cross + BOX.h.repeat(pathW + 2) + BOX.rT,
    FG_GRAY
  );
  const bot = c(
    BOX.bl + BOX.h.repeat(idxW + 2) + BOX.bT + BOX.h.repeat(nameW + 2) + BOX.bT + BOX.h.repeat(sizeW + 2) + BOX.bT + BOX.h.repeat(pathW + 2) + BOX.br,
    FG_GRAY
  );

  console.log("");
  const pageText = page && totalPages ? ` ${c(`Page ${page}/${totalPages}`, DIM, FG_GRAY)}` : "";
  console.log(`  ${c("LOCAL FILES", BOLD, FG_BRIGHT_WHITE)} ${c(`(${totalCount})`, DIM, FG_GRAY)}${pageText}`);
  console.log(`  ${top}`);
  console.log(
    `  ${c(BOX.v, FG_GRAY)} ${padStart(c("#", BOLD, FG_BRIGHT_WHITE), idxW)} ${c(BOX.v, FG_GRAY)} ${padEnd(c("Name", BOLD, FG_BRIGHT_WHITE), nameW)} ${c(BOX.v, FG_GRAY)} ${padEnd(c("Size", BOLD, FG_BRIGHT_WHITE), sizeW)} ${c(BOX.v, FG_GRAY)} ${padEnd(c("Path", BOLD, FG_BRIGHT_WHITE), pathW)} ${c(BOX.v, FG_GRAY)}`
  );
  console.log(`  ${mid}`);

  for (let i = 0; i < files.length; i++) {
    const f = files[i];
    const idx = String(startIndex + i + 1);
    const name = truncateText(f.name || "-", nameW);
    const size = f.size || "-";
    const path = truncateText(f.path || "-", pathW);
    console.log(
      `  ${c(BOX.v, FG_GRAY)} ${padStart(c(idx, FG_GRAY), idxW)} ${c(BOX.v, FG_GRAY)} ${padEnd(c(name, FG_WHITE), nameW)} ${c(BOX.v, FG_GRAY)} ${padEnd(c(size, FG_BRIGHT_YELLOW), sizeW)} ${c(BOX.v, FG_GRAY)} ${padEnd(c(path, DIM, FG_GRAY), pathW)} ${c(BOX.v, FG_GRAY)}`
    );
  }

  console.log(`  ${bot}`);
  console.log("");
}

// ─── Status messages ────────────────────────────────────────────────

export function printSearching(javId: string): void {
  console.log(`  ${c("\u25B6", FG_BRIGHT_CYAN)} ${c("Searching", FG_WHITE)} ${c(javId, BOLD, FG_BRIGHT_WHITE)}${c("...", DIM, FG_GRAY)}`);
}

export function printSuccess(msg: string): void {
  console.log(`  ${c("\u2714", FG_BRIGHT_GREEN)} ${c(msg, FG_GREEN)}`);
}

export function printError(msg: string): void {
  console.log(`  ${c("\u2718", FG_BRIGHT_RED)} ${c(msg, FG_RED)}`);
}

export function printWarning(msg: string): void {
  console.log(`  ${c("\u26A0", FG_BRIGHT_YELLOW)} ${c(msg, FG_YELLOW)}`);
}

export function printInfo(msg: string): void {
  console.log(`  ${c("\u2022", FG_CYAN)} ${c(msg, FG_WHITE)}`);
}

export function printMagnetLink(msg: string, link: string): void {
  console.log(`  ${c("\u26A0", FG_BRIGHT_YELLOW)} ${c(msg, FG_YELLOW)}`);
  console.log(`  ${c(link, FG_BRIGHT_CYAN, BOLD, UNDERLINE)}`);
}

/**
 * Styled prompt string for readline.
 */
export function getPrompt(): string {
  return `${c("\u276F", FG_BRIGHT_CYAN)} `;
}

// ─── Internal helpers ───────────────────────────────────────────────

function formatBytes(bytes: number): string {
  if (bytes <= 0) return "-";
  if (bytes >= 1024 * 1024 * 1024) return `${(bytes / 1024 / 1024 / 1024).toFixed(2)} GB`;
  if (bytes >= 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(2)} MB`;
  return `${(bytes / 1024).toFixed(2)} KB`;
}

export { formatBytes as formatSize };

function getStateColor(state: string): Array<() => string> {
  const lower = state.toLowerCase();
  if (/download|metadl/i.test(lower)) return [FG_BRIGHT_CYAN, BOLD];
  if (/stalled/i.test(lower)) return [FG_BRIGHT_YELLOW];
  if (/upload|seed/i.test(lower)) return [FG_BRIGHT_GREEN];
  if (/pause/i.test(lower)) return [FG_GRAY];
  if (/error|missing/i.test(lower)) return [FG_BRIGHT_RED];
  return [FG_WHITE];
}

function getStateIcon(state: string): string {
  const lower = state.toLowerCase();
  if (/download|metadl/i.test(lower)) return c("\u25BC", FG_BRIGHT_CYAN);  // ▼
  if (/stalled/i.test(lower)) return c("\u25AC", FG_BRIGHT_YELLOW);        // ▬
  if (/upload|seed/i.test(lower)) return c("\u25B2", FG_BRIGHT_GREEN);     // ▲
  if (/pause/i.test(lower)) return c("\u25A0", FG_GRAY);                    // ■
  if (/error|missing/i.test(lower)) return c("\u25CF", FG_BRIGHT_RED);     // ●
  return c("\u25CB", FG_WHITE);                                              // ○
}
