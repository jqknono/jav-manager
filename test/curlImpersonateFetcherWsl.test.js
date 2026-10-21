const test = require("node:test");
const assert = require("node:assert/strict");

const { toWslPath, buildCurlSpawnCommand } = require("../dist/data/curlImpersonateFetcher");

test("toWslPath converts drive paths", () => {
  assert.equal(toWslPath("F:\\code\\jav-manager\\third_party\\curl-impersonate\\bin\\curl_chrome116"), "/mnt/f/code/jav-manager/third_party/curl-impersonate/bin/curl_chrome116");
});

test("buildCurlSpawnCommand returns native on non-win32", () => {
  const cmd = buildCurlSpawnCommand("/usr/bin/curl_chrome116", ["--version"]);
  if (process.platform !== "win32") {
    assert.equal(cmd.mode, "native");
    assert.equal(cmd.command, "/usr/bin/curl_chrome116");
  }
});

test("buildCurlSpawnCommand uses wsl --exec on win32 for non-.exe", () => {
  if (process.platform !== "win32") {
    return;
  }

  const cmd = buildCurlSpawnCommand("F:\\code\\jav-manager\\third_party\\curl-impersonate\\bin\\curl_chrome116", ["--version"]);
  assert.equal(cmd.mode, "wsl");
  assert.equal(cmd.command, "wsl");
  assert.equal(cmd.args[0], "--exec");
});
