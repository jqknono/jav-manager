import { spawn } from "node:child_process";
import { randomBytes } from "node:crypto";
import { mkdirSync, writeFileSync } from "node:fs";
import net from "node:net";
import path from "node:path";

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function getWranglerBin() {
  // 优先使用本地安装的 wrangler，避免 npx 在某些环境下“脱钩”子进程导致无法优雅关闭。
  // 该脚本在 jav-worker 包目录下运行，因此相对路径固定可用。
  return process.platform === "win32" ? "node_modules/.bin/wrangler.cmd" : "node_modules/.bin/wrangler";
}

function nowIso() {
  return new Date().toISOString();
}

function randomKey() {
  return randomBytes(16).toString("hex");
}

function getFreePort() {
  return new Promise((resolve, reject) => {
    const server = net.createServer();
    server.unref();
    server.on("error", reject);
    server.listen(0, "127.0.0.1", () => {
      const address = server.address();
      const port = typeof address === "object" && address ? address.port : 0;
      server.close((error) => {
        if (error) {
          reject(error);
          return;
        }
        resolve(port);
      });
    });
  });
}

function must(value, message) {
  if (!value) throw new Error(message);
  return value;
}

async function waitForOk(url, timeoutMs) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    try {
      const res = await fetch(url, { cache: "no-store" });
      if (res.ok) return;
    } catch {
      // ignore
    }
    await sleep(300);
  }
  throw new Error(`等待 Worker 启动超时: ${url}`);
}

function deepCollectStrings(value, out, depth = 0) {
  if (depth > 10) return;
  if (typeof value === "string") {
    out.push(value);
    return;
  }
  if (Array.isArray(value)) {
    for (const v of value) deepCollectStrings(v, out, depth + 1);
    return;
  }
  if (value && typeof value === "object") {
    for (const v of Object.values(value)) deepCollectStrings(v, out, depth + 1);
  }
}

function extractFirstId(value) {
  const queue = [{ v: value, d: 0 }];
  while (queue.length) {
    const cur = queue.shift();
    if (!cur) break;
    const { v, d } = cur;
    if (d > 6) continue;
    if (v && typeof v === "object") {
      if (!Array.isArray(v)) {
        const obj = v;
        if (typeof obj.id === "string" && obj.id.length >= 4 && obj.id.length <= 16) return obj.id;
        if (typeof obj.movie?.id === "string") return obj.movie.id;
      }
      for (const child of Object.values(v)) queue.push({ v: child, d: d + 1 });
    }
  }
  return null;
}

async function fetchJson(url, headers) {
  const res = await fetch(url, { headers, cache: "no-store" });
  const text = await res.text();
  let json = null;
  try {
    json = JSON.parse(text);
  } catch {
    json = null;
  }
  return { res, text, json };
}

async function pollRecent(origin, proxyKey, kind, timeoutMs) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    const { res, json } = await fetchJson(`${origin}/api/javdb/recent/${kind}`, {
      "X-Proxy-Key": proxyKey,
    });
    const data = json?.data;
    if (res.ok && Array.isArray(data) && data.length > 0) return data;
    await sleep(300);
  }
  throw new Error(`等待 KV recent/${kind} 写入超时`);
}

async function wranglerD1Execute({ persistTo, command }) {
  const wranglerBin = getWranglerBin();
  const args = [
    "d1",
    "execute",
    "DB",
    "--local",
    "--persist-to",
    persistTo,
    "--json",
    "--command",
    command,
  ];
  const proc = spawn(wranglerBin, args, {
    stdio: ["ignore", "pipe", "pipe"],
    env: process.env,
  });
  let out = "";
  let err = "";
  proc.stdout.on("data", (d) => (out += d.toString("utf8")));
  proc.stderr.on("data", (d) => (err += d.toString("utf8")));
  const code = await new Promise((resolve) => proc.on("close", resolve));
  if (code !== 0) {
    throw new Error(`wrangler d1 execute 失败(code=${code}): ${err || out}`.trim());
  }
  try {
    return JSON.parse(out);
  } catch {
    return out;
  }
}

async function main() {
  const wranglerBin = getWranglerBin();
  const port = process.env.JAV_WORKER_PORT ? Number(process.env.JAV_WORKER_PORT) : await getFreePort();
  const origin = `http://127.0.0.1:${port}`;
  const persistTo = process.env.JAV_WORKER_PERSIST_TO ?? path.join(".wrangler", "state-it");
  const proxyKey = process.env.JAVDB_PROXY_KEY ?? randomKey();

  mkdirSync(persistTo, { recursive: true });
  const envFile = path.join(persistTo, "it.env");
  const envLines = [
    `JAVDB_PROXY_KEY=${proxyKey}`,
  ];
  if (process.env.JAVDB_APP_SECRET) envLines.push(`JAVDB_APP_SECRET=${process.env.JAVDB_APP_SECRET}`);
  if (process.env.JAVDB_APP_SALT) envLines.push(`JAVDB_APP_SALT=${process.env.JAVDB_APP_SALT}`);
  writeFileSync(envFile, envLines.join("\n") + "\n", "utf8");

  console.log(`[${nowIso()}] 启动 wrangler dev...`);
  const wranglerArgs = [
    "dev",
    "--local",
    "--ip",
    "127.0.0.1",
    "--port",
    String(port),
    "--persist-to",
    persistTo,
    "--show-interactive-dev-session",
    "false",
    "--log-level",
    "none",
    "--env-file",
    envFile,
  ];

  const wrangler = spawn(wranglerBin, wranglerArgs, {
    stdio: ["ignore", "pipe", "pipe"],
    env: process.env,
    detached: true,
  });

  let wranglerOut = "";
  wrangler.stdout.on("data", (d) => (wranglerOut += d.toString("utf8")));
  wrangler.stderr.on("data", (d) => (wranglerOut += d.toString("utf8")));

  let shuttingDown = false;
  const shutdown = async () => {
    if (shuttingDown) return;
    shuttingDown = true;
    if (wrangler.pid) {
      try {
        process.kill(-wrangler.pid, "SIGINT");
      } catch {
        // ignore
      }
    } else {
      wrangler.kill("SIGINT");
    }

    let done = await Promise.race([
      new Promise((resolve) => wrangler.on("close", () => resolve(true))),
      sleep(5000).then(() => false),
    ]);
    if (!done) {
      try {
        if (wrangler.pid) process.kill(-wrangler.pid, "SIGKILL");
        else wrangler.kill("SIGKILL");
      } catch {
        // ignore
      }
      done = await Promise.race([
        new Promise((resolve) => wrangler.on("close", () => resolve(true))),
        sleep(2000).then(() => false),
      ]);
      if (!done) {
        // 最后手段：解除引用避免阻塞退出（可能会残留 wrangler 进程，需人工清理）
        try {
          wrangler.unref();
        } catch {
          // ignore
        }
      }
    }
  };

  process.on("SIGINT", () => void shutdown());
  process.on("SIGTERM", () => void shutdown());

  try {
    await waitForOk(`${origin}/api/version`, 60_000);
    console.log(`[${nowIso()}] Worker 已就绪: ${origin}`);

    // 1) 未鉴权必须 401
    {
      const { res } = await fetchJson(
        `${origin}/api/javdb/app/api/v2/search?q=STARS-804&type=movie`,
        {}
      );
      if (res.status !== 401) {
        throw new Error(`未带 X-Proxy-Key 期望 401，实际 ${res.status}`);
      }
      console.log(`[${nowIso()}] ✅ 鉴权校验 OK (401)`);
    }

    // 2) 鉴权搜索 + URL 重写
    const searchUrl = `${origin}/api/javdb/app/api/v2/search?q=STARS-804&type=movie`;
    const { res: searchRes, json: searchJson, text: searchText } = await fetchJson(searchUrl, {
      "X-Proxy-Key": proxyKey,
    });
    if (!searchRes.ok) {
      throw new Error(`搜索请求失败(${searchRes.status}): ${searchText.slice(0, 400)}`);
    }
    if (searchJson?.success !== 1) {
      throw new Error(`搜索返回不是 success=1: ${searchText.slice(0, 400)}`);
    }
    console.log(`[${nowIso()}] ✅ 搜索接口 OK`);

    const strings = [];
    deepCollectStrings(searchJson, strings);
    const leaked = strings.find((s) => s.includes("tp.cmastd.com") || s.includes("jdforrepam.com"));
    if (leaked) throw new Error(`JSON 未完全重写，仍包含上游域名: ${leaked}`);
    const hasProxyUrl = strings.some((s) => s.includes("/api/javdb/img/") || s.includes("/api/javdb/preview/"));
    if (!hasProxyUrl) throw new Error("JSON 中未发现 /api/javdb/img 或 /api/javdb/preview（可能上游无资源字段）");
    console.log(`[${nowIso()}] ✅ JSON URL 重写 OK`);

    let detailJson = null;
    const maybeId = extractFirstId(searchJson);
    if (maybeId) {
      const detailUrl = `${origin}/api/javdb/app/api/v4/movies/${encodeURIComponent(maybeId)}`;
      const { res: dRes, json: dJson } = await fetchJson(detailUrl, { "X-Proxy-Key": proxyKey });
      if (dRes.ok && dJson?.success === 1) {
        detailJson = dJson;
        console.log(`[${nowIso()}] ✅ 详情接口 OK`);
      } else {
        console.log(`[${nowIso()}] ⚠️ 详情接口不可用，后续仅使用搜索结果继续验证`);
      }
    } else {
      console.log(`[${nowIso()}] ⚠️ 未从搜索结果中提取到 movie id，跳过详情接口`);
    }

    // 3) 拉取一张图片（走代理）
    const detailStrings = [];
    if (detailJson) deepCollectStrings(detailJson, detailStrings);
    const imgUrl = [...strings, ...detailStrings].find((s) => s.startsWith(`${origin}/api/javdb/img/`));
    if (imgUrl) {
      const imgRes = await fetch(imgUrl, { headers: { "X-Proxy-Key": proxyKey }, cache: "no-store" });
      if (!imgRes.ok) throw new Error(`图片代理失败(${imgRes.status}): ${imgUrl}`);
      const ct = imgRes.headers.get("content-type") || "";
      if (ct.includes("application/json")) throw new Error(`图片 Content-Type 异常: ${ct}`);
      const imgBytes = new Uint8Array(await imgRes.arrayBuffer());
      if (imgBytes.byteLength < 128) throw new Error(`图片体积异常(${imgBytes.byteLength} bytes): ${imgUrl}`);
      console.log(`[${nowIso()}] ✅ 图片代理 OK (${imgBytes.byteLength} bytes, ${ct || "unknown"})`);
    } else {
      console.log(`[${nowIso()}] ⚠️ 未找到图片代理 URL，跳过图片验证`);
    }

    // 4) KV recent/search 写入
    const recentSearch = await pollRecent(origin, proxyKey, "search", 20_000);
    const found = recentSearch.find((x) => x && typeof x === "object" && x.q === "STARS-804");
    if (!found) throw new Error("KV recent/search 未找到 q=STARS-804 的记录");
    console.log(`[${nowIso()}] ✅ KV recent/search OK`);

    // 5) D1：确认写入了缓存记录（异步 waitUntil，轮询查询）
    const d1Start = Date.now();
    let d1Count = 0;
    while (Date.now() - d1Start < 30_000) {
      const result = await wranglerD1Execute({
        persistTo,
        command: "SELECT COUNT(*) AS c FROM javdb_proxy_cache;",
      });
      const c = Number(result?.[0]?.results?.[0]?.c ?? 0);
      d1Count = c;
      if (c > 0) break;
      await sleep(500);
    }
    if (d1Count <= 0) throw new Error("D1 javdb_proxy_cache 未写入任何记录（超时）");
    console.log(`[${nowIso()}] ✅ D1 javdb_proxy_cache OK (count=${d1Count})`);

    // 6) 额外：验证 preview（可选，不强制）
    if (detailJson) {
      const previewUrl = detailStrings.find((s) => s.startsWith(`${origin}/api/javdb/preview/`) && (s.includes("m3u8") || s.includes("ttm3u8")));
      if (previewUrl) {
        const pRes = await fetch(previewUrl, { headers: { "X-Proxy-Key": proxyKey }, cache: "no-store" });
        if (pRes.ok) {
          const pText = await pRes.text();
          if (!pText.trimStart().startsWith("#EXTM3U")) {
            throw new Error("预览 m3u8 内容异常（未以 #EXTM3U 开头）");
          }
          console.log(`[${nowIso()}] ✅ 预览 m3u8 代理 OK`);
        } else {
          console.log(`[${nowIso()}] ⚠️ 预览 m3u8 拉取失败(${pRes.status})，跳过`);
        }
      } else {
        console.log(`[${nowIso()}] ⚠️ 未发现 preview 代理 URL，跳过预览测试`);
      }
    } else {
      console.log(`[${nowIso()}] ⚠️ 无可用详情数据，跳过预览测试`);
    }

    console.log(`[${nowIso()}] 🎉 本地集成测试通过`);
  } catch (err) {
    console.error(`[${nowIso()}] ❌ 本地集成测试失败`);
    console.error(err instanceof Error ? err.stack || err.message : String(err));
    console.error("\n--- wrangler 输出(末尾) ---");
    console.error(wranglerOut.slice(-4000));
    process.exitCode = 1;
  } finally {
    await shutdown();
  }
}

main().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
