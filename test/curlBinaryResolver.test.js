const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");

const { checkCurlImpersonateAvailable } = require("../dist/utils/curlBinaryResolver");

test("checkCurlImpersonateAvailable honors configuredPath", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "jav-manager-curlbin-"));
  const bin = path.join(dir, process.platform === "win32" ? "curl_chrome116.exe" : "curl_chrome116");
  fs.writeFileSync(bin, "fake");

  const info = checkCurlImpersonateAvailable("chrome116", bin);
  assert.equal(info.exists, true);
  assert.equal(info.path, bin);
});

test("checkCurlImpersonateAvailable finds curl_<target> on PATH", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "jav-manager-curlpath-"));
  const fileName = process.platform === "win32" ? "curl_chrome116.exe" : "curl_chrome116";
  const bin = path.join(dir, fileName);
  fs.writeFileSync(bin, "fake");

  const oldPath = process.env.PATH ?? "";
  const oldCwd = process.cwd();
  const cwd = fs.mkdtempSync(path.join(os.tmpdir(), "jav-manager-cwdpath-"));
  try {
    const sep = process.platform === "win32" ? ";" : ":";
    process.env.PATH = `${dir}${sep}${oldPath}`;
    process.chdir(cwd);
    const info = checkCurlImpersonateAvailable("chrome116", null);
    assert.equal(info.exists, true);
    assert.equal(info.path, bin);
  } finally {
    process.env.PATH = oldPath;
    process.chdir(oldCwd);
  }
});

test("checkCurlImpersonateAvailable falls back to non-.exe on win32 (WSL vendored)", () => {
  if (process.platform !== "win32") {
    return;
  }

  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "jav-manager-cwd-"));
  const oldCwd = process.cwd();
  try {
    process.chdir(dir);
    fs.mkdirSync(path.join(dir, "third_party", "curl-impersonate", "bin"), { recursive: true });
    const bin = path.join(dir, "third_party", "curl-impersonate", "bin", "curl_chrome116");
    fs.writeFileSync(bin, "fake");

    const info = checkCurlImpersonateAvailable("chrome116", null);
    assert.equal(info.exists, true);
    assert.equal(info.path, bin);
  } finally {
    process.chdir(oldCwd);
  }
});
