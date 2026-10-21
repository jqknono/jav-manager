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
  assert.equal(info.useImpersonateFlag, false);
});

test("checkCurlImpersonateAvailable finds curl_<target> on PATH", () => {
  // Use a target that has no vendored binary so the PATH fallback is exercised.
  const target = "chrome999";
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "jav-manager-curlpath-"));
  const fileName = process.platform === "win32" ? `curl_${target}.exe` : `curl_${target}`;
  const bin = path.join(dir, fileName);
  fs.writeFileSync(bin, "fake");

  const oldPath = process.env.PATH ?? "";
  const oldCwd = process.cwd();
  const cwd = fs.mkdtempSync(path.join(os.tmpdir(), "jav-manager-cwdpath-"));
  try {
    const sep = process.platform === "win32" ? ";" : ":";
    process.env.PATH = `${dir}${sep}${oldPath}`;
    process.chdir(cwd);
    const info = checkCurlImpersonateAvailable(target, null);
    assert.equal(info.exists, true);
    assert.equal(info.path, bin);
    assert.equal(info.useImpersonateFlag, false);
  } finally {
    process.env.PATH = oldPath;
    process.chdir(oldCwd);
  }
});

test("checkCurlImpersonateAvailable falls back to non-.exe on win32 (WSL vendored)", () => {
  if (process.platform !== "win32") {
    return;
  }

  // The vendored path is resolved relative to the package root (__dirname/../../).
  // Verify using the actual vendored binary if it exists in the project.
  const projectRoot = path.resolve(__dirname, "..");
  const mainBin = path.join(projectRoot, "third_party", "curl-impersonate", "bin", "curl-impersonate");
  const wrapperBin = path.join(projectRoot, "third_party", "curl-impersonate", "bin", "curl_chrome116");

  // On win32, wrapper scripts are checked before the main binary.
  // If the non-.exe wrapper exists, it should be found via the WSL fallback.
  if (!fs.existsSync(wrapperBin)) {
    return; // Skip when vendored binary is not present
  }

  const info = checkCurlImpersonateAvailable("chrome116", null);
  assert.equal(info.exists, true);
  // On win32 the .exe lookup fails, then the non-.exe fallback kicks in.
  assert.equal(info.path, wrapperBin);
  assert.equal(info.useImpersonateFlag, false);
});

test("checkCurlImpersonateAvailable uses main binary with useImpersonateFlag on non-win32", () => {
  if (process.platform === "win32") {
    // On win32, the main binary fallback has lower priority than wrapper scripts.
    // Verify with a target that has no vendored wrapper.
    const target = "chrome999";
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "jav-manager-curlmain-"));
    const bin = path.join(dir, "curl-impersonate.exe");
    fs.writeFileSync(bin, "fake");

    const oldPath = process.env.PATH ?? "";
    try {
      process.env.PATH = `${dir};${oldPath}`;
      const info = checkCurlImpersonateAvailable(target, null);
      assert.equal(info.exists, true);
      assert.equal(info.useImpersonateFlag, true);
      assert.ok(info.path.includes("curl-impersonate"), "path should reference curl-impersonate binary");
    } finally {
      process.env.PATH = oldPath;
    }
    return;
  }

  // On Linux/macOS, the main binary is preferred over wrapper scripts.
  // When the vendored main binary exists, it should be used with useImpersonateFlag.
  const projectRoot = path.resolve(__dirname, "..");
  const mainBin = path.join(projectRoot, "third_party", "curl-impersonate", "bin", "curl-impersonate");
  if (!fs.existsSync(mainBin)) {
    // Fallback: put a fake main binary on PATH.
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "jav-manager-curlmain-"));
    const bin = path.join(dir, "curl-impersonate");
    fs.writeFileSync(bin, "fake");
    const oldPath = process.env.PATH ?? "";
    try {
      process.env.PATH = `${dir}:${oldPath}`;
      const info = checkCurlImpersonateAvailable("chrome116", null);
      assert.equal(info.exists, true);
      assert.equal(info.useImpersonateFlag, true);
    } finally {
      process.env.PATH = oldPath;
    }
    return;
  }

  const info = checkCurlImpersonateAvailable("chrome116", null);
  assert.equal(info.exists, true);
  assert.equal(info.useImpersonateFlag, true);
  assert.ok(info.path.includes("curl-impersonate"), "path should reference curl-impersonate binary");
});
