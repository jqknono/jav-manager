const test = require("node:test");
const assert = require("node:assert/strict");

const { JavSearchService, ServiceAvailability } = require("../dist/services");

function makeLoc() {
  return {
    get: (k) => k,
    getFormat: (k, ...args) => [k, ...args].join(" "),
    setLanguage: () => undefined,
  };
}

function createSearchResult(javId) {
  return {
    javId,
    title: javId,
    coverUrl: "",
    releaseDate: "",
    duration: 0,
    director: "",
    maker: "",
    publisher: "",
    series: "",
    actors: [],
    categories: [],
    torrents: [
      {
        title: javId,
        magnetLink: "magnet:?xt=urn:btih:deadbeef",
        size: 1024,
        hasSubtitle: false,
        hasUncensoredMarker: false,
        uncensoredMarkerType: "None",
        hasHd: false,
        seeders: 0,
        leechers: 0,
        sourceSite: "JavDB",
        dlSpeed: 0,
        eta: 0,
        weightScore: 0,
      },
    ],
    detailUrl: "",
    dataSource: "Remote",
  };
}

test("searchOnly does not report javinfo telemetry during search", async () => {
  const svc = new JavSearchService(
    {
      search: async (javId) => createSearchResult(javId),
    },
    {
      getSortedTorrents: (torrents) => torrents,
    },
    {
      checkLocalFiles: async () => [],
    },
    {
      addDownload: async () => true,
    },
    new ServiceAvailability(),
    makeLoc(),
    null,
  );

  const result = await svc.searchOnly("MIAA-710", true);
  assert.equal(result.success, true);
});

test("process does not fetch detail just for telemetry reporting", async () => {
  let detailCalls = 0;

  const cached = createSearchResult("MIAA-711");
  cached.dataSource = "Local";
  cached.releaseDate = "";
  cached.actors = [];
  cached.categories = [];
  cached.detailUrl = "https://javdb.com/v/abc";

  const detail = {
    ...cached,
    releaseDate: "2026-02-06",
    actors: ["Actor A"],
    categories: ["Drama"],
    detailUrl: "https://javdb.com/v/abc",
  };

  const svc = new JavSearchService(
    {
      search: async () => detail,
      getDetail: async () => {
        detailCalls += 1;
        return detail;
      },
    },
    {
      selectBest: (torrents) => torrents[0] ?? null,
      getSortedTorrents: (torrents) => torrents,
    },
    {
      checkLocalFiles: async () => [],
    },
    {
      addDownload: async () => true,
    },
    new ServiceAvailability(),
    makeLoc(),
    {
      get: async () => cached,
      save: async () => undefined,
      updateTorrents: async () => undefined,
      exists: async () => true,
      delete: async () => undefined,
      getStatistics: async () => ({ totalJavCount: 0, totalTorrentCount: 0, databaseSizeBytes: 0 }),
      initialize: async () => undefined,
    },
  );

  const result = await svc.process("MIAA-711", true, false);
  assert.equal(result.success, true);
  assert.equal(result.downloaded, true);
  assert.equal(detailCalls, 0);
});
