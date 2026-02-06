const test = require("node:test");
const assert = require("node:assert/strict");

const { JavInfoTelemetryClient } = require("../dist/services");

test("JavInfoTelemetryClient sends normalized javinfo payload", async () => {
  const calls = [];
  const originalFetch = global.fetch;
  global.fetch = async (url, init) => {
    calls.push({ url, init });
    return { ok: true };
  };

  try {
    const client = new JavInfoTelemetryClient({
      enabled: true,
      endpoint: "https://example.com",
    });

    client.tryReport({
      javId: "MIAA-710",
      title: "  MIAA-710 Title  ",
      coverUrl: "https://img.example/cover.jpg",
      releaseDate: "2026-02-06T10:11:12.000Z",
      duration: 120,
      director: "",
      maker: "S1",
      publisher: "S1 No.1 Style",
      series: "Series A",
      actors: ["A", "A", " ", "B"],
      categories: ["Tag1", "", "Tag2"],
      detailUrl: "https://javdb.com/v/abc",
      dataSource: "Remote",
      cachedAt: undefined,
      torrents: [
        {
          title: "T1",
          magnetLink: "magnet:?xt=urn:btih:deadbeef",
          torrentUrl: "",
          size: 123,
          hasUncensoredMarker: true,
          uncensoredMarkerType: "UC",
          hasSubtitle: true,
          hasHd: true,
          seeders: 1,
          leechers: 2,
          sourceSite: "JavDB",
          dlSpeed: 0,
          eta: 0,
          weightScore: 9,
        },
      ],
    });

    // wait microtask for fire-and-forget fetch dispatch
    await new Promise((resolve) => setTimeout(resolve, 0));

    assert.equal(calls.length, 1);
    assert.equal(calls[0].url, "https://example.com/api/javinfo");
    const payload = JSON.parse(calls[0].init.body);

    assert.equal(payload.jav_id, "MIAA-710");
    assert.equal(payload.title, "MIAA-710 Title");
    assert.equal(payload.cover_url, "https://img.example/cover.jpg");
    assert.equal(payload.release_date, "2026-02-06");
    assert.equal(payload.duration, 120);
    assert.equal(payload.director, null);
    assert.deepEqual(payload.actors, ["A", "B"]);
    assert.deepEqual(payload.categories, ["Tag1", "Tag2"]);
    assert.equal(payload.detail_url, "https://javdb.com/v/abc");
    assert.equal(payload.torrents[0].magnet_link, "magnet:?xt=urn:btih:deadbeef");
    assert.equal(payload.torrents[0].source_site, "JavDB");
    assert.equal(payload.torrents[0].weight_score, 9);
  } finally {
    global.fetch = originalFetch;
  }
});

test("JavInfoTelemetryClient skips report when javId is empty", async () => {
  const calls = [];
  const originalFetch = global.fetch;
  global.fetch = async (url, init) => {
    calls.push({ url, init });
    return { ok: true };
  };

  try {
    const client = new JavInfoTelemetryClient({
      enabled: true,
      endpoint: "https://example.com",
    });

    client.tryReport({
      javId: " ",
      title: "Title",
      coverUrl: "",
      releaseDate: undefined,
      duration: 0,
      director: "",
      maker: "",
      publisher: "",
      series: "",
      actors: [],
      categories: [],
      detailUrl: "",
      dataSource: "Remote",
      cachedAt: undefined,
      torrents: [],
    });

    await new Promise((resolve) => setTimeout(resolve, 0));
    assert.equal(calls.length, 0);
  } finally {
    global.fetch = originalFetch;
  }
});
