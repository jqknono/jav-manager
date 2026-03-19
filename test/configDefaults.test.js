const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");

const { loadConfig } = require("../dist/config");

test("loadConfig falls back to backend endpoint when JavBackend.BaseUrl and Telemetry.Endpoint are empty", () => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "jav-manager-config-"));
  const configPath = path.join(tempDir, "appsettings.json");
  const originalConfigDir = process.env.JAVMANAGER_CONFIG_DIR;
  const originalBackendEndpoint = process.env.JAVMANAGER_BACKEND_ENDPOINT;

  fs.writeFileSync(
    configPath,
    JSON.stringify(
      {
        JavBackend: { BaseUrl: "   " },
        Telemetry: { Endpoint: "" },
      },
      null,
      2
    ),
    "utf8"
  );

  try {
    process.env.JAVMANAGER_CONFIG_DIR = tempDir;
    process.env.JAVMANAGER_BACKEND_ENDPOINT = "http://127.0.0.1:8788";
    const config = loadConfig();
    assert.equal(config.javDb.baseUrl, "http://127.0.0.1:8788");
    assert.equal(config.telemetry.endpoint, "https://jav-manager.techfetch.dev");
  } finally {
    if (originalConfigDir === undefined) {
      delete process.env.JAVMANAGER_CONFIG_DIR;
    } else {
      process.env.JAVMANAGER_CONFIG_DIR = originalConfigDir;
    }
    if (originalBackendEndpoint === undefined) {
      delete process.env.JAVMANAGER_BACKEND_ENDPOINT;
    } else {
      process.env.JAVMANAGER_BACKEND_ENDPOINT = originalBackendEndpoint;
    }
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
});

test("loadConfig reads JavBackend section and still filters legacy javdb mirror urls", () => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "jav-manager-config-javdb-"));
  const configPath = path.join(tempDir, "appsettings.json");
  const originalConfigDir = process.env.JAVMANAGER_CONFIG_DIR;
  const originalBackendEndpoint = process.env.JAVMANAGER_BACKEND_ENDPOINT;

  fs.writeFileSync(
    configPath,
    JSON.stringify(
      {
        JavBackend: { BaseUrl: "https://backend.example.com", MirrorUrls: ["https://javdb571.com", "https://api.btyjscl.com"] },
      },
      null,
      2
    ),
    "utf8"
  );

  try {
    process.env.JAVMANAGER_CONFIG_DIR = tempDir;
    delete process.env.JAVMANAGER_BACKEND_ENDPOINT;
    const config = loadConfig();
    assert.equal(config.javDb.baseUrl, "https://backend.example.com");
    assert.deepEqual(config.javDb.mirrorUrls, ["https://api.btyjscl.com"]);
  } finally {
    if (originalConfigDir === undefined) {
      delete process.env.JAVMANAGER_CONFIG_DIR;
    } else {
      process.env.JAVMANAGER_CONFIG_DIR = originalConfigDir;
    }
    if (originalBackendEndpoint === undefined) {
      delete process.env.JAVMANAGER_BACKEND_ENDPOINT;
    } else {
      process.env.JAVMANAGER_BACKEND_ENDPOINT = originalBackendEndpoint;
    }
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
});
