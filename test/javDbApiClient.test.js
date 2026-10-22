const test = require("node:test");
const assert = require("node:assert/strict");

const { JavDbApiClient } = require("../apps/cli/dist/apps/client/src/data/javdb.js");

function createClient(fetchImpl) {
  return new JavDbApiClient(
    {
      baseUrl: "https://apidd.spthgb.com",
      mirrorUrls: [],
      requestTimeout: 1000,
      userAgent: "",
    },
    fetchImpl,
  );
}

test("JavDbApiClient.searchCandidates uses app api payload", async () => {
  const calls = [];
  const client = createClient(async (url) => {
    calls.push(String(url));
    return new Response(JSON.stringify({
      success: 1,
      data: {
        movies: [
          {
            id: "qDYQzM",
            number: "STARS-804",
            title: "本能で絡み合う極上のランジェリー＆オイリー4本番 神木麗",
            origin_title: "本能で絡み合う極上のランジェリー＆オイリー4本番 神木麗",
            cover_url: "https://tp.cmastd.com/cover.jpg",
            duration: 160,
            release_date: "2023-04-06",
          },
        ],
      },
    }), { status: 200, headers: { "Content-Type": "application/json" } });
  });

  const results = await client.searchCandidates("STARS-804");
  assert.equal(calls[0], "https://apidd.spthgb.com/api/v2/search?q=STARS-804&type=movie");
  assert.equal(results.length, 1);
  assert.equal(results[0].javId, "STARS-804");
  assert.equal(results[0].detailUrl, "https://apidd.spthgb.com/api/v4/movies/qDYQzM");
  assert.equal(results[0].coverUrl, "https://tp.cmastd.com/cover.jpg");
});

test("JavDbApiClient.searchCandidates uses backend proxy path for backend endpoint", async () => {
  const calls = [];
  const client = new JavDbApiClient(
    {
      baseUrl: "http://127.0.0.1:8788",
      mirrorUrls: [],
      requestTimeout: 1000,
      userAgent: "",
    },
    async (url) => {
      calls.push(String(url));
      return new Response(JSON.stringify({
        success: 1,
        data: {
          movies: [
            {
              id: "qDYQzM",
              number: "STARS-804",
              title: "中文标题",
              origin_title: "原始标题",
            },
          ],
        },
      }), { status: 200, headers: { "Content-Type": "application/json" } });
    },
  );

  const results = await client.searchCandidates("STARS-804");
  assert.equal(calls[0], "http://127.0.0.1:8788/api/javdb/app/api/v2/search?q=STARS-804&type=movie");
  assert.equal(results[0].detailUrl, "http://127.0.0.1:8788/api/javdb/app/api/v4/movies/qDYQzM");
});

test("JavDbApiClient.getDetail maps legacy javdb url to app api without requesting javdb.com", async () => {
  const calls = [];
  const client = createClient(async (url) => {
    const raw = String(url);
    calls.push(raw);

    if (raw.includes("/api/v4/movies/qDYQzM")) {
      return new Response(JSON.stringify({
        success: 1,
        data: {
          movie: {
            id: "qDYQzM",
            number: "STARS-804",
            title: "本能で絡み合う極上のランジェリー＆オイリー4本番 神木麗",
            origin_title: "本能で絡み合う極上のランジェリー＆オイリー4本番 神木麗",
            cover_url: "https://tp.cmastd.com/covers/qd/qDYQzM.jpg",
            duration: 160,
            release_date: "2023-04-06",
            director_name: "チク兄",
            maker_name: "SOD Create",
            publisher_name: "SODクリエイト",
            series_name: null,
            tags: [{ name: "乳交" }, { name: "巨乳" }],
            actors: [{ name: "神木麗" }],
          },
        },
      }), { status: 200, headers: { "Content-Type": "application/json" } });
    }

    if (raw.includes("/api/v1/movies/qDYQzM/magnets")) {
      return new Response(JSON.stringify({
        success: 1,
        data: {
          magnets: [
            {
              name: "STARS-804-UC.torrent.无码破解",
              hash: "e6296950dc29f2e225975746b829adb249a8dd3f",
              size: 7460,
              cnsub: true,
              hd: true,
            },
          ],
        },
      }), { status: 200, headers: { "Content-Type": "application/json" } });
    }

    return new Response("not found", { status: 404 });
  });

  const detail = await client.getDetail("https://javdb.com/v/qDYQzM");
  assert.deepEqual(calls, [
    "https://apidd.spthgb.com/api/v4/movies/qDYQzM",
    "https://apidd.spthgb.com/api/v1/movies/qDYQzM/magnets",
  ]);
  assert.equal(detail.javId, "STARS-804");
  assert.equal(detail.director, "チク兄");
  assert.deepEqual(detail.actors, ["神木麗"]);
  assert.equal(detail.torrents.length, 1);
  assert.equal(detail.torrents[0].magnetLink, "magnet:?xt=urn:btih:e6296950dc29f2e225975746b829adb249a8dd3f");
  assert.equal(detail.torrents[0].hasSubtitle, true);
  assert.equal(detail.torrents[0].hasHd, true);
});
