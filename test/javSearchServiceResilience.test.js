const test = require("node:test");
const assert = require("node:assert/strict");

const { JavSearchService, ServiceAvailability } = require("../packages/core/dist/services");

function makeLoc() {
  return {
    get: (k) => k,
    getFormat: (k, ...args) => [k, ...args].join(" "),
    setLanguage: () => undefined,
  };
}

test("selected torrent returns its magnet link for the client", async () => {
  const serviceAvailability = new ServiceAvailability();
  const svc = new JavSearchService({}, {}, serviceAvailability, makeLoc(), null);

  const torrent = {
    title: "ABC-123",
    magnetLink: "magnet:?xt=urn:btih:deadbeef",
    size: 123,
    seeders: 0,
    leechers: 0,
    sourceSite: "JavDB",
    hasSubtitle: false,
    hasUncensoredMarker: false,
    uncensoredMarkerType: 0,
    hasHd: false,
    dlSpeed: 0,
    eta: 0,
    weightScore: 0,
  };
  const result = await svc.processSelectedTorrent("ABC-123", torrent);

  assert.equal(result.success, true);
  assert.equal(result.magnetLink, torrent.magnetLink);
  assert.ok(result.messages.includes("magnet_ready"));
});
