#!/usr/bin/env node
"use strict";

const fs = require("fs");
const path = require("path");

// Ensure JSON localization files are present next to compiled output.
// tsc does not copy JSON files to outDir.

const projectRoot = path.resolve(__dirname, "..");
const srcDir = path.join(projectRoot, "src", "localization");
const outDir = path.join(projectRoot, "dist", "localization");
const appsettingsSrc = path.join(projectRoot, "src", "appsettings.json");
const appsettingsOut = path.join(projectRoot, "dist", "appsettings.json");

if (!fs.existsSync(srcDir)) {
  process.exit(0);
}

fs.mkdirSync(outDir, { recursive: true });

// Clean up stale compiled locale modules from older builds.
for (const locale of ["en", "zh", "ja", "ko"]) {
  for (const ext of [".js", ".js.map", ".d.ts", ".d.ts.map"]) {
    const p = path.join(outDir, `${locale}${ext}`);
    try {
      fs.unlinkSync(p);
    } catch {
      // ignore
    }
  }
}

const entries = fs.readdirSync(srcDir, { withFileTypes: true });
for (const entry of entries) {
  if (!entry.isFile()) continue;
  if (!entry.name.endsWith(".json")) continue;
  fs.copyFileSync(path.join(srcDir, entry.name), path.join(outDir, entry.name));
}

// Keep a sample config next to compiled output.
try {
  if (fs.existsSync(appsettingsSrc)) {
    fs.copyFileSync(appsettingsSrc, appsettingsOut);
  }
} catch {
  // ignore
}
