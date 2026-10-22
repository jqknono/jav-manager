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
    assert.equal(config.subtitle.enabled, true);
    assert.equal(config.subtitle.baseUrl, "https://www.subtitlecat.com");
    assert.deepEqual(config.subtitle.preferredLanguages, ["zh-CN", "zh", "zh-TW"]);
    assert.equal(config.subtitle.indexSites.length, 2);
    assert.equal(config.subtitle.indexSites[0].name, "JavSubtitled");
    assert.equal(config.subtitle.indexSites[1].name, "Javzimu");
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
        JavBackend: { BaseUrl: "https://backend.example.com", MirrorUrls: ["https://javdb571.com", "https://apidd.czssdgz.com"] },
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
    assert.deepEqual(config.javDb.mirrorUrls, ["https://apidd.czssdgz.com"]);
    assert.equal(config.subtitle.enabled, true);
    assert.equal(config.subtitle.baseUrl, "https://www.subtitlecat.com");
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

test("loadConfig reads Subtitle section and preferred languages", () => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "jav-manager-config-sub-"));
  const configPath = path.join(tempDir, "appsettings.json");
  const originalConfigDir = process.env.JAVMANAGER_CONFIG_DIR;

  fs.writeFileSync(
    configPath,
    JSON.stringify(
      {
        Subtitle: {
          Enabled: true,
          BaseUrl: "https://subtitle.example.com",
          SavePath: "/tmp/subs",
          PreferredLanguages: ["zh-TW", "zh-CN"],
          IndexSites: [{ Name: "CustomIndex", BaseUrl: "https://index.example.com", SearchPath: "/search/{query}" }],
        },
      },
      null,
      2
    ),
    "utf8"
  );

  try {
    process.env.JAVMANAGER_CONFIG_DIR = tempDir;
    const config = loadConfig();
    assert.equal(config.subtitle.enabled, true);
    assert.equal(config.subtitle.baseUrl, "https://subtitle.example.com");
    assert.equal(config.subtitle.savePath, "/tmp/subs");
    assert.deepEqual(config.subtitle.preferredLanguages, ["zh-TW", "zh-CN"]);
    assert.equal(config.subtitle.indexSites.length, 1);
    assert.equal(config.subtitle.indexSites[0].name, "CustomIndex");
    assert.equal(config.subtitle.indexSites[0].searchPath, "/search/{query}");
  } finally {
    if (originalConfigDir === undefined) {
      delete process.env.JAVMANAGER_CONFIG_DIR;
    } else {
      process.env.JAVMANAGER_CONFIG_DIR = originalConfigDir;
    }
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
});
