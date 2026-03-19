#!/usr/bin/env node
"use strict";

const fs = require("fs");
const path = require("path");

const projectRoot = path.resolve(__dirname, "..");
const distRoot = path.join(projectRoot, "dist");

function writeWrapper(relPath, targetRel) {
  const targetFile = path.join(distRoot, relPath);
  fs.mkdirSync(path.dirname(targetFile), { recursive: true });
  fs.writeFileSync(
    targetFile,
    `"use strict";\nmodule.exports = require("${targetRel}");\n`,
    "utf8",
  );
}

fs.rmSync(distRoot, { recursive: true, force: true });
fs.mkdirSync(distRoot, { recursive: true });

writeWrapper("index.js", "../apps/cli/dist/apps/cli/src/main.js");
writeWrapper("config.js", "../apps/cli/dist/apps/client/src/config.js");
writeWrapper("services.js", "../apps/cli/dist/apps/client/src/services.js");
writeWrapper("models.js", "../packages/shared/dist/models.js");
writeWrapper("data/everything.js", "../../apps/cli/dist/apps/client/src/data/everything.js");
writeWrapper("utils/cliDisplay.js", "../../apps/cli/dist/apps/client/src/utils/cliDisplay.js");
writeWrapper("utils/javDbMirrors.js", "../../packages/shared/dist/utils/javDbMirrors.js");
writeWrapper("utils/telemetryEndpoints.js", "../../packages/shared/dist/utils/backendEndpoints.js");
writeWrapper("utils/titleVariants.js", "../../packages/shared/dist/utils/titleVariants.js");
writeWrapper("utils/torrentNameParser.js", "../../packages/shared/dist/utils/torrentNameParser.js");
writeWrapper("utils/weightCalculator.js", "../../packages/shared/dist/utils/weightCalculator.js");
