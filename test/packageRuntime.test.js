const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const net = require("node:net");
const { spawn, spawnSync } = require("node:child_process");
const { once } = require("node:events");
const tar = require("tar");

const root = path.resolve(__dirname, "..");
const npm = process.platform === "win32" ? "npm.cmd" : "npm";

function run(command, args, cwd, env) {
  const result = spawnSync(command, args, {
    cwd, env, encoding: "utf8", timeout: 120_000,
    shell: process.platform === "win32" && command === npm,
  });
  assert.equal(result.status, 0, result.error?.message || result.stderr || result.stdout);
  return result.stdout;
}

// 验证真实发布契约：在仓库外解包 tarball，CLI/GUI 与语言资源可独立运行。
// 第三方依赖复用本次 npm install 的实体文件；内部 workspace 链接由运行包替代。
// 关闭遥测，页面测试只访问本机，第三方安装由 lockfile/npm ci 负责。
test("发布 tarball 支持隔离运行、版本查询、core 导出及 GUI 页面", { timeout: 180_000 }, async (t) => {
  const temp = fs.mkdtempSync(path.join(os.tmpdir(), "jav-manager-package-"));
  t.after(() => fs.rmSync(temp, { recursive: true, force: true }));
  const env = { ...process.env, NODE_PATH: "", JAVMANAGER_CONFIG_DIR: temp };
  fs.writeFileSync(path.join(temp, "appsettings.json"), JSON.stringify({
    Telemetry: { Enabled: false }, Console: { Language: "en" },
  }));
  // npm test 已构建；这里跳过 prepack，避免递归构建。
  run(npm, ["pack", "--ignore-scripts", "--pack-destination", temp], root, env);
  const tarball = fs.readdirSync(temp).find((file) => file.endsWith(".tgz"));
  fs.writeFileSync(path.join(temp, "package.json"), '{"private":true}');
  fs.cpSync(path.join(root, "node_modules"), path.join(temp, "node_modules"), {
    recursive: true,
    filter: (source) => !fs.lstatSync(source).isSymbolicLink() && path.basename(source) !== "@jav-manager",
  });
  const installed = path.join(temp, "node_modules", "jav-manager");
  fs.mkdirSync(installed, { recursive: true });
  await tar.x({ file: path.join(temp, tarball), cwd: installed, strip: 1 });
  const bin = path.join(installed, "bin", "jav-manager.js");
  const version = require("../package.json").version;
  assert.ok(run(process.execPath, [bin, "version"], temp, env).includes(version));
  assert.ok(run(process.execPath, [bin, "help"], temp, env).includes("COMMANDS"));
  assert.equal(run(process.execPath, ["-e", 'console.log(typeof require("jav-manager").createAppContext)'], temp, env).trim(), "function");
  assert.deepEqual(fs.readdirSync(path.join(installed, "runtime")).sort(), ["cli.cjs", "core.cjs", "gui.cjs"]);

  // 先分配本地空闲端口；用启动日志作为就绪信号，测试结束释放服务。
  const probe = net.createServer();
  probe.listen(0, "127.0.0.1");
  await once(probe, "listening");
  const port = probe.address().port;
  await new Promise((resolve) => probe.close(resolve));
  const child = spawn(process.execPath, [bin, "--gui", "--host=127.0.0.1", `--port=${port}`], { cwd: temp, env, stdio: ["ignore", "pipe", "pipe"] });
  t.after(async () => {
    if (child.exitCode === null && child.signalCode === null) {
      const closed = once(child, "close");
      child.kill();
      await closed;
    }
  });
  await new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error("GUI 启动超时")), 15_000);
    let output = "";
    let errors = "";
    child.stderr.on("data", (chunk) => { errors += chunk; });
    child.once("error", (error) => { clearTimeout(timer); reject(error); });
    child.once("exit", (code) => { clearTimeout(timer); reject(new Error(`GUI 退出 ${code}: ${errors}`)); });
    child.stdout.on("data", (chunk) => {
      output += chunk;
      if (output.includes("GUI running at")) { clearTimeout(timer); resolve(); }
    });
  });
  const response = await fetch(`http://127.0.0.1:${port}/`, { signal: AbortSignal.timeout(5_000) });
  assert.equal(response.status, 200);
  assert.match(await response.text(), /<html lang="en">/);
});
