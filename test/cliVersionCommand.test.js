const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { spawnSync } = require("node:child_process");

test("bin/jav-manager.js version returns immediately without challenge flow", () => {
  const repoRoot = path.resolve(__dirname, "..");
  const packageJson = JSON.parse(fs.readFileSync(path.join(repoRoot, "package.json"), "utf8"));
  const result = spawnSync(process.execPath, ["bin/jav-manager.js", "version"], {
    cwd: repoRoot,
    encoding: "utf8",
    env: {
      ...process.env,
      NO_COLOR: "1",
    },
  });

  assert.equal(result.status, 0, result.stderr || "version command failed");
  assert.match(result.stdout, new RegExp(`JavManager ${packageJson.version.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}`));
  assert.doesNotMatch(result.stdout, /Cloudflare/i);
  assert.equal(result.stderr.trim(), "");
});
