const test = require("node:test");
const assert = require("node:assert/strict");

const { parseTorrentName } = require("../dist/utils/torrentNameParser");
const { UncensoredMarkerType } = require("../dist/models");

test("parseTorrentName marks -U suffix as uncensored", () => {
  const parsed = parseTorrentName("STARS-001-U");
  assert.equal(parsed.uncensoredType, UncensoredMarkerType.U);
});

test("parseTorrentName marks -UC suffix as uncensored", () => {
  const parsed = parseTorrentName("STARS-001-UC");
  assert.equal(parsed.uncensoredType, UncensoredMarkerType.UC);
});

test("parseTorrentName does not treat -UHD as uncensored marker", () => {
  const parsed = parseTorrentName("STARS-001-UHD");
  assert.equal(parsed.uncensoredType, UncensoredMarkerType.None);
});
