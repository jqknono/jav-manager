const test = require("node:test");
const assert = require("node:assert/strict");

const { parseCurlWriteOutOutput } = require("../dist/data/curlImpersonateFetcher");

test("parseCurlWriteOutOutput parses http_code and strips marker", () => {
  const stdout = "<html>blocked</html>\n\n__JAV_MANAGER_HTTP_CODE__:403\n";
  const parsed = parseCurlWriteOutOutput(stdout);
  assert.equal(parsed.status, 403);
  assert.equal(parsed.body, "<html>blocked</html>");
});

test("parseCurlWriteOutOutput returns status 0 when marker missing", () => {
  const stdout = "hello";
  const parsed = parseCurlWriteOutOutput(stdout);
  assert.equal(parsed.status, 0);
  assert.equal(parsed.body, "hello");
});

