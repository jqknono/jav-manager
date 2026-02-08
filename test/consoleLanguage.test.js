const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");

const { loadConfig } = require("../dist/config");

test("loadConfig accepts Console.Language ja/ko", () => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "jav-manager-config-lang-"));
  const configPath = path.join(tempDir, "appsettings.json");
  const originalConfigDir = process.env.JAVMANAGER_CONFIG_DIR;

  try {
    fs.writeFileSync(configPath, JSON.stringify({ Console: { Language: "ja" } }, null, 2), "utf8");
    process.env.JAVMANAGER_CONFIG_DIR = tempDir;
    const configJa = loadConfig();
    assert.equal(configJa.console.language, "ja");

    fs.writeFileSync(configPath, JSON.stringify({ Console: { Language: "ko" } }, null, 2), "utf8");
    const configKo = loadConfig();
    assert.equal(configKo.console.language, "ko");
  } finally {
    if (originalConfigDir === undefined) {
      delete process.env.JAVMANAGER_CONFIG_DIR;
    } else {
      process.env.JAVMANAGER_CONFIG_DIR = originalConfigDir;
    }
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
});

