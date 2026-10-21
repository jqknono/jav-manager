#!/usr/bin/env node
"use strict";

// Ensure curl-impersonate binaries have executable permissions on Unix-like systems.
// npm does not preserve the executable bit for files outside of the "bin" field.

const fs = require("fs");
const path = require("path");

if (process.platform === "win32") {
  // Windows does not use POSIX file permissions.
  process.exit(0);
}

const binDir = path.resolve(__dirname, "..", "third_party", "curl-impersonate", "bin");
if (!fs.existsSync(binDir)) {
  process.exit(0);
}

const entries = fs.readdirSync(binDir);
for (const entry of entries) {
  const filePath = path.join(binDir, entry);
  try {
    const stat = fs.statSync(filePath);
    if (stat.isFile()) {
      fs.chmodSync(filePath, 0o755);
    }
  } catch {
    // ignore
  }
}
