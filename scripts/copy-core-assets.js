#!/usr/bin/env node
"use strict";

const fs = require("fs");
const path = require("path");

const projectRoot = path.resolve(__dirname, "..");
const srcRoot = path.join(projectRoot, "packages", "core", "src");
const outRoot = path.join(projectRoot, "packages", "core", "dist");

function copyFile(relPath) {
  const from = path.join(srcRoot, relPath);
  const to = path.join(outRoot, relPath);
  if (!fs.existsSync(from)) return;
  fs.mkdirSync(path.dirname(to), { recursive: true });
  fs.copyFileSync(from, to);
}

const locDir = path.join(srcRoot, "localization");
if (fs.existsSync(locDir)) {
  fs.mkdirSync(path.join(outRoot, "localization"), { recursive: true });
  for (const file of fs.readdirSync(locDir)) {
    if (!file.endsWith(".json")) continue;
    copyFile(path.join("localization", file));
  }
}

copyFile("appsettings.json");
