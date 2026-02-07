const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");

const { loadConfig } = require("../dist/config");

test("loadConfig falls back to defaults when JavDb.BaseUrl and Telemetry.Endpoint are empty", () => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "jav-manager-config-"));
  const configPath = path.join(tempDir, "appsettings.json");
  const originalConfigDir = process.env.JAVMANAGER_CONFIG_DIR;

  fs.writeFileSync(
    configPath,
    JSON.stringify(
      {
        JavDb: { BaseUrl: "   " },
        Telemetry: { Endpoint: "" },
      },
      null,
      2
    ),
    "utf8"
  );

  try {
    process.env.JAVMANAGER_CONFIG_DIR = tempDir;
    const config = loadConfig();
    assert.equal(config.javDb.baseUrl, "https://javdb.com");
    assert.equal(config.telemetry.endpoint, "https://jav-manager.techfetch.dev");
  } finally {
    if (originalConfigDir === undefined) {
      delete process.env.JAVMANAGER_CONFIG_DIR;
    } else {
      process.env.JAVMANAGER_CONFIG_DIR = originalConfigDir;
    }
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
});
