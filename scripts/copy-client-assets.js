#!/usr/bin/env node
"use strict";

const fs = require("fs");
const path = require("path");

const target = process.argv[2];
if (!target) {
  console.error("用法: node scripts/copy-client-assets.js <cli|gui>");
  process.exit(1);
}

const projectRoot = path.resolve(__dirname, "..");
const srcRoot = path.join(projectRoot, "apps", "client", "src");
const outRoot = path.join(projectRoot, "apps", target, "dist", "apps", "client", "src");
const srcLocDir = path.join(srcRoot, "localization");
const outLocDir = path.join(outRoot, "localization");

fs.mkdirSync(outLocDir, { recursive: true });

for (const file of fs.readdirSync(srcLocDir)) {
  if (!file.endsWith(".json")) continue;
  fs.copyFileSync(path.join(srcLocDir, file), path.join(outLocDir, file));
}

const appsettingsSrc = path.join(srcRoot, "appsettings.json");
const appsettingsOut = path.join(outRoot, "appsettings.json");
if (fs.existsSync(appsettingsSrc)) {
  fs.copyFileSync(appsettingsSrc, appsettingsOut);
}
