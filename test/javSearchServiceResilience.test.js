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

test("processSelectedTorrent skips local dedup when Everything throws", async () => {
  const localFileService = {
    checkLocalFiles: async () => {
      throw new Error("Everything.BaseUrl is empty");
    },
  };

  const downloadService = {
    addDownload: async () => true,
  };

  const serviceAvailability = new ServiceAvailability();
  const javDbProvider = {};
  const selectionService = {};
  const telemetryClient = { tryReport: () => undefined };

  const svc = new JavSearchService(
    javDbProvider,
    selectionService,
    localFileService,
    downloadService,
    serviceAvailability,
    makeLoc(),
    telemetryClient,
    null
  );

  const torrent = { title: "ABC-123", magnetLink: "magnet:?xt=urn:btih:deadbeef", size: 123, seeders: 0, leechers: 0, sourceSite: "JavDB", hasSubtitle: false, hasUncensoredMarker: false, uncensoredMarkerType: 0, hasHd: false, dlSpeed: 0, eta: 0, weightScore: 0 };
  const result = await svc.processSelectedTorrent("ABC-123", torrent, false);

  assert.equal(result.success, true);
  assert.equal(result.localDedupSkipped, true);
  assert.equal(result.downloaded, true);
});

test("processSelectedTorrent returns magnet link when downloader throws", async () => {
  const localFileService = { checkLocalFiles: async () => [] };
  const downloadService = {
    addDownload: async () => {
      throw new Error("qBittorrent.BaseUrl is empty");
    },
  };

  const serviceAvailability = new ServiceAvailability();
  const javDbProvider = {};
  const selectionService = {};
  const telemetryClient = { tryReport: () => undefined };

  const svc = new JavSearchService(
    javDbProvider,
    selectionService,
    localFileService,
    downloadService,
    serviceAvailability,
    makeLoc(),
    telemetryClient,
    null
  );

  const torrent = { title: "ABC-123", magnetLink: "magnet:?xt=urn:btih:deadbeef", size: 123, seeders: 0, leechers: 0, sourceSite: "JavDB", hasSubtitle: false, hasUncensoredMarker: false, uncensoredMarkerType: 0, hasHd: false, dlSpeed: 0, eta: 0, weightScore: 0 };
  const result = await svc.processSelectedTorrent("ABC-123", torrent, false);

  assert.equal(result.success, true);
  assert.equal(result.downloadQueueSkipped, true);
  assert.equal(result.magnetLink, torrent.magnetLink);
  assert.ok(result.messages.includes("download_failed"));
});

