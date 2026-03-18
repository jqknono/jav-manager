const test = require("node:test");
const assert = require("node:assert/strict");

const {
  mergeMirrorUrls,
  fetchLatestJavDbDomains,
  normalizeDomainOrUrlToHttpsUrl,
} = require("../dist/utils/javDbMirrors");

test("normalizeDomainOrUrlToHttpsUrl normalizes domains and trims slashes", () => {
  assert.equal(normalizeDomainOrUrlToHttpsUrl("javdb571.com"), "https://javdb571.com");
  assert.equal(normalizeDomainOrUrlToHttpsUrl("https://javdb571.com/"), "https://javdb571.com");
});

test("mergeMirrorUrls merges with latest domains first and de-dupes", () => {
  const existing = ["https://javdb564.com", "https://javdb565.com/"];
  const latest = ["javdb571.com", "https://javdb565.com"];
  const merged = mergeMirrorUrls(existing, latest);
  assert.deepEqual(merged, ["https://javdb571.com", "https://javdb565.com", "https://javdb564.com"]);
});

test("fetchLatestJavDbDomains builds correct api url from telemetry endpoint", async () => {
  let gotUrl = "";
  const fakeFetch = async (url) => {
    gotUrl = String(url);
    return {
      ok: true,
      status: 200,
      async json() {
        return { success: true, domains: ["javdb571.com"] };
      },
    };
  };

  const res = await fetchLatestJavDbDomains("https://example.com/api", fakeFetch);
  assert.equal(gotUrl, "https://example.com/api/javdb-domain");
  assert.deepEqual(res.domains, ["javdb571.com"]);
});

test("fetchLatestJavDbDomains throws on non-success response", async () => {
  const fakeFetch = async () => ({
    ok: true,
    status: 200,
    async json() {
      return { success: false, error: "nope" };
    },
  });

  await assert.rejects(
    () => fetchLatestJavDbDomains("https://example.com", fakeFetch),
    /nope/
  );
});

