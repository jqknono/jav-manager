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

test("searchOnly reports javinfo telemetry for remote result", async () => {
  const reports = [];
  const telemetryClient = {
    tryReport: (result) => reports.push(result.javId),
  };

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
    telemetryClient,
    null,
  );

  const result = await svc.searchOnly("MIAA-710", true);
  assert.equal(result.success, true);
  assert.deepEqual(reports, ["MIAA-710"]);
});
