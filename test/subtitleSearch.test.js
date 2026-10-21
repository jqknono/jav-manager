const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");

const { parseSearchResults, parseDetailPage } = require("../apps/cli/dist/apps/client/src/data/subtitlecat.js");
const { parseIndexSearchResults } = require("../apps/cli/dist/apps/client/src/data/subtitleIndex.js");
const { SubtitleSearchService } = require("../dist/services");
const {
  pickPreferredLanguage,
  scoreSubtitleMatch,
  sortSubtitleItems,
} = require("../dist/utils/subtitleSearch");

const sampleSearchHtml = `
<table class="table sub-table">
  <tbody>
    <tr>
      <td><a href="subs/1707/ssis-001-zhTW.html">ssis-001-zhTW</a> (translated from Korean)</td>
      <td class="sub-table__metric"><span class="sub-table__metric-label">Size</span><span class="sub-table__metric-value">56 KB</span></td>
      <td class="sub-table__metric"><span class="sub-table__metric-label">Downloads</span><span class="sub-table__metric-value">4<span class="sub-table__metric-unit"> downloads</span></span></td>
      <td class="sub-table__metric"><span class="sub-table__metric-label">Languages</span><span class="sub-table__metric-value">4<span class="sub-table__metric-unit"> languages</span></span></td>
    </tr>
    <tr>
      <td><a href="subs/252/SSIS-001.html">SSIS-001</a> (translated from Korean)</td>
      <td class="sub-table__metric"><span class="sub-table__metric-label">Size</span><span class="sub-table__metric-value">87 KB</span></td>
      <td class="sub-table__metric"><span class="sub-table__metric-label">Downloads</span><span class="sub-table__metric-value">60<span class="sub-table__metric-unit"> downloads</span></span></td>
      <td class="sub-table__metric"><span class="sub-table__metric-label">Languages</span><span class="sub-table__metric-value">60<span class="sub-table__metric-unit"> languages</span></span></td>
    </tr>
    <tr>
      <td><a href="subs/805/The.Lord.of.the.Rings.S02E02.html">The Lord of the Rings</a> (translated from English)</td>
      <td class="sub-table__metric"><span class="sub-table__metric-label">Size</span><span class="sub-table__metric-value">51 KB</span></td>
      <td class="sub-table__metric"><span class="sub-table__metric-label">Downloads</span><span class="sub-table__metric-value">2<span class="sub-table__metric-unit"> downloads</span></span></td>
      <td class="sub-table__metric"><span class="sub-table__metric-label">Languages</span><span class="sub-table__metric-value">2<span class="sub-table__metric-unit"> languages</span></span></td>
    </tr>
  </tbody>
</table>
`;

const sampleDetailHtml = `
<div class="sub-single">
  <span><img src="/assets/flags/cn.png" alt="zh-CN" class="flag"></span>
  <span>Chinese (Simplified)</span>
  <span><a id="download_zh-CN" href="/subs/490/SSIS-001.zh-zh-CN.srt" class="green-link">Download</a></span>
</div>
<div class="sub-single">
  <span><img src="/assets/flags/tw.png" alt="zh-TW" class="flag"></span>
  <span>Chinese (Traditional)</span>
  <span><a id="download_zh-TW" href="/subs/490/SSIS-001.zh-zh-TW.srt" class="green-link">Download</a></span>
</div>
<div class="sub-single">
  <span><img src="/assets/flags/en.png" alt="en" class="flag"></span>
  <span>English</span>
  <span><a id="download_en" href="/subs/489/SSIS-001.zh-en.srt" class="green-link">Download</a></span>
</div>
<button onclick="translate_from_server_folder('ja', 'SSIS-001.zh-orig.srt', '/subs/252/')"></button>
`;

test("scoreSubtitleMatch ranks exact JAV IDs above unrelated titles", () => {
  assert.equal(scoreSubtitleMatch("SSIS-001", "SSIS-001"), 100);
  assert.equal(scoreSubtitleMatch("SSIS-001", "ssis-001-zhTW"), 90);
  assert.equal(scoreSubtitleMatch("SSIS-001", "The Lord of the Rings"), 0);
});

test("SubtitleCat search parser keeps JAV ID rows and extracts metrics", () => {
  const items = parseSearchResults(sampleSearchHtml, "https://www.subtitlecat.com", "SSIS-001");
  assert.equal(items.length, 3);
  assert.equal(items[1].title, "SSIS-001");
  assert.equal(items[1].detailUrl, "https://www.subtitlecat.com/subs/252/SSIS-001.html");
  assert.equal(items[1].size, 87 * 1024);
  assert.equal(items[1].downloads, 60);
  assert.equal(items[1].languageCount, 60);
  assert.equal(items[1].sourceLanguage, "Korean");
  assert.equal(items[1].matchScore, 100);
});

test("SubtitleCat detail parser maps ready Chinese SRT downloads", () => {
  const base = {
    javId: "SSIS-001",
    title: "SSIS-001",
    source: "SubtitleCat",
    detailUrl: "https://www.subtitlecat.com/subs/252/SSIS-001.html",
    size: 87040,
    downloads: 60,
    languageCount: 60,
    sourceLanguage: "Korean",
    languages: [],
    matchScore: 100,
  };
  const detail = parseDetailPage(sampleDetailHtml, base, "https://www.subtitlecat.com");
  assert.equal(detail.languages.length, 3);
  assert.equal(detail.languages[0].code, "zh-CN");
  assert.equal(detail.languages[0].downloadUrl, "https://www.subtitlecat.com/subs/490/SSIS-001.zh-zh-CN.srt");
  assert.equal(detail.originalDownloadUrl, "https://www.subtitlecat.com/subs/252/SSIS-001.zh-orig.srt");
  assert.equal(pickPreferredLanguage(detail, ["zh-CN", "zh", "zh-TW"])?.code, "zh-CN");
});

test("vertical index parser keeps JAV ID subtitle links", () => {
  const html = `
    <a href="/ssis-001-chs.srt">SSIS-001 简体</a>
    <a href="/about">About</a>
    <a href="/search?q=SSIS-001">SSIS-001</a>
  `;
  const items = parseIndexSearchResults(html, "https://javzimu.com", "Javzimu", "SSIS-001");
  assert.equal(items.length, 1);
  assert.equal(items[0].source, "Javzimu");
  assert.equal(items[0].languages[0].code, "zh-CN");
  assert.equal(items[0].languages[0].downloadUrl, "https://javzimu.com/ssis-001-chs.srt");
});

test("SubtitleSearchService ranks SubtitleCat matches and downloads preferred Chinese SRT", async () => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "jav-manager-sub-"));
  const srt = Buffer.from("1\n00:00:00,000 --> 00:00:01,000\nhello\n");
  const service = new SubtitleSearchService(
    [
      {
        sourceName: "Javzimu",
        search: async () => {
          throw new Error("HTTP 403");
        },
        getDetail: async (item) => item,
        download: async () => ({ fileName: "skip.srt", content: srt }),
      },
      {
        sourceName: "SubtitleCat",
        search: async () => ([
          {
            javId: "SSIS-001",
            title: "The Lord of the Rings",
            source: "SubtitleCat",
            detailUrl: "https://www.subtitlecat.com/subs/805/lotr.html",
            size: 1000,
            downloads: 2,
            languageCount: 2,
            sourceLanguage: "English",
            languages: [],
            matchScore: 0,
          },
          {
            javId: "SSIS-001",
            title: "SSIS-001",
            source: "SubtitleCat",
            detailUrl: "https://www.subtitlecat.com/subs/252/SSIS-001.html",
            size: 87040,
            downloads: 60,
            languageCount: 3,
            sourceLanguage: "Korean",
            languages: [],
            matchScore: 100,
          },
        ]),
        getDetail: async (item) => ({
          ...item,
          languages: [
            { code: "en", label: "English", downloadUrl: "https://www.subtitlecat.com/en.srt", isOriginal: false },
            { code: "zh-CN", label: "Chinese (Simplified)", downloadUrl: "https://www.subtitlecat.com/zh-CN.srt", isOriginal: false },
          ],
        }),
        download: async (url) => {
          assert.equal(url, "https://www.subtitlecat.com/zh-CN.srt");
          return { fileName: "SSIS-001.zh-CN.srt", content: srt };
        },
      },
    ],
    {
      enabled: true,
      baseUrl: "https://www.subtitlecat.com",
      requestTimeout: 1000,
      userAgent: "",
      savePath: tempDir,
      preferredLanguages: ["zh-CN", "zh", "zh-TW"],
      indexSites: [],
    },
    {
      defaultSavePath: "",
      defaultCategory: "jav",
      defaultTags: "jav-manager",
    },
  );

  try {
    const result = await service.search("SSIS-001");
    assert.equal(result.items.length, 1);
    assert.equal(result.items[0].title, "SSIS-001");
    assert.equal(result.messages[0].includes("HTTP 403"), true);

    const downloaded = await service.downloadPreferred(result.items[0], "SSIS-001");
    assert.equal(downloaded.languageCode, "zh-CN");
    assert.equal(downloaded.source, "SubtitleCat");
    assert.equal(fs.existsSync(downloaded.savedPath), true);
    assert.equal(fs.readFileSync(downloaded.savedPath, "utf8").includes("hello"), true);
  } finally {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
});

test("sortSubtitleItems prefers exact ID and Chinese-ready entries", () => {
  const sorted = sortSubtitleItems([
    {
      javId: "SSIS-001",
      title: "ssis-001-zhTW",
      source: "SubtitleCat",
      detailUrl: "a",
      size: 1,
      downloads: 4,
      languageCount: 4,
      sourceLanguage: "Korean",
      languages: [{ code: "zh-TW", label: "zh-TW", downloadUrl: "a", isOriginal: false }],
      matchScore: 90,
    },
    {
      javId: "SSIS-001",
      title: "SSIS-001",
      source: "SubtitleCat",
      detailUrl: "b",
      size: 1,
      downloads: 60,
      languageCount: 3,
      sourceLanguage: "Korean",
      languages: [{ code: "zh-CN", label: "zh-CN", downloadUrl: "b", isOriginal: false }],
      matchScore: 100,
    },
  ]);
  assert.equal(sorted[0].title, "SSIS-001");
});
