#!/usr/bin/env node
"use strict";

const { spawn } = require("child_process");
const fs = require("fs");
const path = require("path");

function resolveTsNodeBin(projectRoot) {
  const rel = process.platform === "win32"
    ? path.join("node_modules", ".bin", "ts-node.cmd")
    : path.join("node_modules", ".bin", "ts-node");
  return path.join(projectRoot, rel);
}

function main() {
  const projectRoot = path.resolve(__dirname, "..");
  const tsNodeBin = resolveTsNodeBin(projectRoot);

  if (!fs.existsSync(tsNodeBin)) {
    console.error("未找到 ts-node，请先执行 npm install");
    process.exit(1);
  }

  const childEnv = { ...process.env };

  // 允许用更直观的变量名指定本次 dev:cli 要访问的后端地址。
  if (!childEnv.JAVMANAGER_BACKEND_ENDPOINT && childEnv.JAVMANAGER_BACKEND_URL) {
    childEnv.JAVMANAGER_BACKEND_ENDPOINT = childEnv.JAVMANAGER_BACKEND_URL;
  }

  const args = ["apps/cli/src/main.ts", ...process.argv.slice(2)];
  const child = spawn(tsNodeBin, args, {
    cwd: projectRoot,
    stdio: "inherit",
    env: childEnv,
  });

  child.on("exit", (code, signal) => {
    if (signal) {
      process.kill(process.pid, signal);
      return;
    }
    process.exit(code ?? 0);
  });
}

main();
