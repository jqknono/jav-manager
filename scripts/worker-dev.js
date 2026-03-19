#!/usr/bin/env node
"use strict";

const { spawn } = require("child_process");
const fs = require("fs");
const path = require("path");

function must(value, message) {
  if (!value) {
    console.error(message);
    process.exit(1);
  }
  return value;
}

function main() {
  const projectRoot = path.resolve(__dirname, "..");
  const workerDir = path.join(projectRoot, "apps", "backend-worker");
  must(fs.existsSync(workerDir), "未找到 apps/backend-worker 目录");

  const port = Number(process.env.JAV_WORKER_PORT || "8787");
  const persistTo = process.env.JAV_WORKER_PERSIST_TO || path.join(workerDir, ".wrangler", "state-dev");
  const proxyKey = process.env.JAVDB_PROXY_KEY || "dev_proxy_key";
  const envFile = path.join(persistTo, "dev.env");

  fs.mkdirSync(persistTo, { recursive: true });

  const lines = [
    `JAVDB_PROXY_KEY=${proxyKey}`,
  ];
  if (process.env.JAVDB_APP_SECRET) lines.push(`JAVDB_APP_SECRET=${process.env.JAVDB_APP_SECRET}`);
  if (process.env.JAVDB_APP_SALT) lines.push(`JAVDB_APP_SALT=${process.env.JAVDB_APP_SALT}`);

  fs.writeFileSync(envFile, lines.join("\n") + "\n", "utf8");

  const wranglerBin = process.platform === "win32"
    ? path.join(workerDir, "node_modules", ".bin", "wrangler.cmd")
    : path.join(workerDir, "node_modules", ".bin", "wrangler");

  must(fs.existsSync(wranglerBin), "未找到 wrangler，请先执行: cd jav-worker && npm install");

  console.log(`Backend Worker 本地地址: http://127.0.0.1:${port}`);
  console.log(`JAVMANAGER_BACKEND_MODE=local 时 CLI 将访问本地 Worker（可选覆盖: JAVMANAGER_BACKEND_LOCAL_ENDPOINT）`);
  console.log(`JAVDB_PROXY_KEY=${proxyKey}`);

  const args = [
    "dev",
    "--local",
    "--ip",
    "127.0.0.1",
    "--port",
    String(port),
    "--persist-to",
    persistTo,
    "--env-file",
    envFile,
  ];

  const child = spawn(wranglerBin, args, {
    cwd: workerDir,
    stdio: "inherit",
    detached: true,
    env: process.env,
  });

  const shutdown = () => {
    if (!child.pid) return;
    try {
      process.kill(-child.pid, "SIGINT");
    } catch {
      // ignore
    }
  };

  process.on("SIGINT", () => shutdown());
  process.on("SIGTERM", () => shutdown());
}

main();
