const test = require("node:test");
const assert = require("node:assert/strict");

const { calculateWeight, calculateAndSort } = require("../dist/utils/weightCalculator");
const { UncensoredMarkerType } = require("../dist/models");

function createTorrent(overrides = {}) {
  return {
    title: "ABC-123",
    magnetLink: "magnet:?xt=urn:btih:deadbeef",
    size: 100,
    hasUncensoredMarker: false,
    uncensoredMarkerType: UncensoredMarkerType.None,
    hasSubtitle: false,
    hasHd: false,
    seeders: 0,
    leechers: 0,
    sourceSite: "JavDB",
    dlSpeed: 0,
    eta: 0,
    weightScore: 0,
    ...overrides,
  };
}

test("calculateWeight uses UC=5, SUB=3, HD=1", () => {
  assert.equal(calculateWeight(createTorrent({ hasUncensoredMarker: true })), 5);
  assert.equal(calculateWeight(createTorrent({ hasSubtitle: true })), 3);
  assert.equal(calculateWeight(createTorrent({ hasHd: true })), 1);
  assert.equal(calculateWeight(createTorrent({ hasUncensoredMarker: true, hasSubtitle: true, hasHd: true })), 9);
});

test("calculateWeight treats -U/-UC in title as uncensored", () => {
  assert.equal(calculateWeight(createTorrent({ title: "ABC-123-U" })), 5);
  assert.equal(calculateWeight(createTorrent({ title: "ABC-123-UC" })), 5);
});

test("calculateAndSort orders by score descending", () => {
  const hdOnly = createTorrent({ title: "HD", hasHd: true, size: 500 });
  const subAndHd = createTorrent({ title: "SUB+HD", hasSubtitle: true, hasHd: true, size: 400 });
  const ucOnly = createTorrent({ title: "UC", hasUncensoredMarker: true, size: 300 });

  const sorted = calculateAndSort([hdOnly, subAndHd, ucOnly]);
  assert.deepEqual(
    sorted.map((t) => t.title),
    ["UC", "SUB+HD", "HD"]
  );
});
