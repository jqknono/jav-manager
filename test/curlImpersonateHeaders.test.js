const test = require("node:test");
const assert = require("node:assert/strict");

const {
  buildCurlRequestArgs,
  isCloudflareChallengeHtml,
} = require("../dist/data/curlImpersonateFetcher");

test("buildCurlRequestArgs adds browser-like headers when defaultHeaders=true", () => {
  const args = buildCurlRequestArgs({
    url: "https://example.com/",
    referer: null,
    cookieHeader: "over18=1; locale=zh",
    timeoutMs: 5000,
    caBundlePath: "",
    defaultHeaders: true,
    userAgent: "",
    target: "chrome116",
  });

  const joined = args.join("\n");
  assert.ok(joined.includes("--user-agent"), "should include --user-agent");
  assert.ok(joined.includes("Chrome/116.0.0.0"), "should generate Chrome/116 UA");
  assert.ok(joined.includes("Accept: text/html"), "should include Accept header");
  assert.ok(joined.includes("Accept-Language:"), "should include Accept-Language header");
  assert.ok(joined.includes("Upgrade-Insecure-Requests: 1"), "should include Upgrade-Insecure-Requests");
});

test("buildCurlRequestArgs does not add headers when defaultHeaders=false", () => {
  const args = buildCurlRequestArgs({
    url: "https://example.com/",
    referer: null,
    cookieHeader: null,
    timeoutMs: 5000,
    caBundlePath: "",
    defaultHeaders: false,
    userAgent: "MyUA",
    target: "chrome116",
  });

  const joined = args.join("\n");
  assert.equal(joined.includes("--user-agent"), false);
  assert.equal(joined.includes("Accept:"), false);
  assert.equal(joined.includes("Accept-Language:"), false);
});

test("buildCurlRequestArgs prefers explicit userAgent when provided", () => {
  const args = buildCurlRequestArgs({
    url: "https://example.com/",
    referer: null,
    cookieHeader: null,
    timeoutMs: 5000,
    caBundlePath: "",
    defaultHeaders: true,
    userAgent: "CustomUA/1.0",
    target: "chrome116",
  });

  const idx = args.indexOf("--user-agent");
  assert.ok(idx >= 0, "should include --user-agent");
  assert.equal(args[idx + 1], "CustomUA/1.0");
});

test("isCloudflareChallengeHtml detects typical Cloudflare challenge page markers", () => {
  const html = "<html><head><title>Just a moment...</title></head><body><script>window._cf_chl_opt={};</script></body></html>";
  assert.equal(isCloudflareChallengeHtml(html), true);
  assert.equal(isCloudflareChallengeHtml("normal page"), false);
});

