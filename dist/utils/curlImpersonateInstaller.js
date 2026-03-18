"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ensureCurlImpersonateInstalled = ensureCurlImpersonateInstalled;
const promises_1 = __importDefault(require("fs/promises"));
const fs_1 = __importDefault(require("fs"));
const os_1 = __importDefault(require("os"));
const path_1 = __importDefault(require("path"));
const child_process_1 = require("child_process");
const promises_2 = require("stream/promises");
const stream_1 = require("stream");
let installPromise = null;
function getPackageRoot() {
    // __dirname is src/utils/ or dist/utils/ – two levels up is the package root.
    return path_1.default.resolve(__dirname, "..", "..");
}
function isFile(p) {
    try {
        return fs_1.default.statSync(p).isFile();
    }
    catch {
        return false;
    }
}
function detectLinuxLibc() {
    const explicit = (process.env.JAVMANAGER_CURL_IMPERSONATE_LIBC ?? "").trim().toLowerCase();
    if (explicit === "musl" || explicit === "gnu") {
        return explicit;
    }
    // A simple and practical heuristic: Alpine Linux almost always implies musl.
    if (fs_1.default.existsSync("/etc/alpine-release")) {
        return "musl";
    }
    return "gnu";
}
function getUserCacheRoot() {
    const envOverride = (process.env.JAVMANAGER_CURL_IMPERSONATE_DIR ?? "").trim();
    if (envOverride) {
        return envOverride;
    }
    const platform = process.platform;
    if (platform === "win32") {
        const base = process.env.LOCALAPPDATA ||
            process.env.APPDATA ||
            path_1.default.join(os_1.default.homedir(), "AppData", "Local");
        return path_1.default.join(base, "jav-manager", "curl-impersonate");
    }
    if (platform === "darwin") {
        return path_1.default.join(os_1.default.homedir(), "Library", "Caches", "jav-manager", "curl-impersonate");
    }
    const xdg = (process.env.XDG_CACHE_HOME ?? "").trim();
    const base = xdg || path_1.default.join(os_1.default.homedir(), ".cache");
    return path_1.default.join(base, "jav-manager", "curl-impersonate");
}
function getInstallKey() {
    const platform = process.platform;
    const arch = process.arch;
    if (platform === "linux") {
        return `${platform}-${arch}-${detectLinuxLibc()}`;
    }
    return `${platform}-${arch}`;
}
function getPackageArtifactsRoot() {
    return path_1.default.join(getPackageRoot(), "artifacts", "curl-impersonate");
}
function getInstallBinDir(root) {
    return path_1.default.join(root, getInstallKey(), "bin");
}
async function ensureWritableDir(dir) {
    await promises_1.default.mkdir(dir, { recursive: true });
    const probe = path_1.default.join(dir, `.probe-${Date.now()}-${Math.random().toString(16).slice(2)}.tmp`);
    await promises_1.default.writeFile(probe, "ok", { encoding: "utf-8" });
    await promises_1.default.unlink(probe);
}
function pickAssetName(tag) {
    const platform = process.platform;
    const arch = process.arch;
    // Note: lexiforest/curl-impersonate releases currently do not include Windows curl-impersonate builds.
    // On win32 we download a Linux build and rely on WSL to execute it (the fetcher already supports WSL mode).
    const effectivePlatform = platform === "win32" ? "linux" : platform;
    const libc = effectivePlatform === "linux" ? detectLinuxLibc() : null;
    const suffix = (() => {
        if (effectivePlatform === "darwin") {
            if (arch === "arm64")
                return "arm64-macos";
            if (arch === "x64")
                return "x86_64-macos";
            throw new Error(`Unsupported arch for macOS: ${arch}`);
        }
        if (effectivePlatform === "linux") {
            if (arch === "arm64")
                return `aarch64-linux-${libc}`;
            if (arch === "x64")
                return `x86_64-linux-${libc}`;
            throw new Error(`Unsupported arch for Linux: ${arch}`);
        }
        throw new Error(`Unsupported platform: ${platform}`);
    })();
    return `curl-impersonate-${tag}.${suffix}.tar.gz`;
}
async function fetchLatestRelease() {
    const resp = await fetch("https://api.github.com/repos/lexiforest/curl-impersonate/releases/latest", {
        headers: {
            "User-Agent": "jav-manager",
            Accept: "application/vnd.github+json",
        },
    });
    if (!resp.ok) {
        const text = await resp.text().catch(() => "");
        throw new Error(`GitHub API request failed: HTTP ${resp.status} ${text}`.trim());
    }
    const json = (await resp.json());
    if (!json || typeof json.tag_name !== "string" || !Array.isArray(json.assets)) {
        throw new Error("Unexpected GitHub API response for latest release.");
    }
    return json;
}
async function downloadToFile(url, filePath) {
    const resp = await fetch(url, {
        headers: { "User-Agent": "jav-manager" },
        redirect: "follow",
    });
    if (!resp.ok || !resp.body) {
        throw new Error(`Download failed: HTTP ${resp.status}`);
    }
    // Node 的 fetch 返回的是 Web ReadableStream；不同 TS lib 组合下类型可能不完全一致，这里用 any 规避类型差异。
    const nodeStream = stream_1.Readable.fromWeb(resp.body);
    const out = fs_1.default.createWriteStream(filePath);
    await (0, promises_2.pipeline)(nodeStream, out);
}
function extractTarGz(archivePath, destDir) {
    const res = (0, child_process_1.spawnSync)("tar", ["-xzf", archivePath, "-C", destDir], {
        stdio: "pipe",
    });
    if (res.error) {
        throw res.error;
    }
    if (res.status !== 0) {
        const stderr = (res.stderr ?? Buffer.from("")).toString("utf-8").trim();
        throw new Error(stderr || `tar exited with code ${res.status}`);
    }
}
async function chmodBinDir(binDir) {
    if (process.platform === "win32") {
        return;
    }
    try {
        const entries = await promises_1.default.readdir(binDir);
        await Promise.all(entries.map(async (name) => {
            const p = path_1.default.join(binDir, name);
            try {
                const st = await promises_1.default.stat(p);
                if (st.isFile()) {
                    await promises_1.default.chmod(p, 0o755);
                }
            }
            catch {
                // ignore
            }
        }));
    }
    catch {
        // ignore
    }
}
function hasAnyCurlImpersonateBinary(binDir) {
    // Linux/macOS: curl-impersonate
    if (isFile(path_1.default.join(binDir, "curl-impersonate")))
        return true;
    // Windows (if ever present): curl-impersonate.exe
    if (isFile(path_1.default.join(binDir, "curl-impersonate.exe")))
        return true;
    // Wrapper scripts/binaries (at least one is enough)
    if (isFile(path_1.default.join(binDir, "curl_chrome116")))
        return true;
    if (isFile(path_1.default.join(binDir, "curl_chrome116.exe")))
        return true;
    return false;
}
async function doInstall() {
    const packageRoot = getPackageArtifactsRoot();
    const userRoot = getUserCacheRoot();
    const rootsInOrder = [packageRoot, userRoot];
    let chosenRoot = null;
    let chosenBinDir = null;
    for (const root of rootsInOrder) {
        const binDir = getInstallBinDir(root);
        try {
            await ensureWritableDir(binDir);
            chosenRoot = root;
            chosenBinDir = binDir;
            break;
        }
        catch {
            // Try next root
        }
    }
    if (!chosenRoot || !chosenBinDir) {
        return { ok: false, error: "无法创建 curl-impersonate 安装目录（无写入权限）。" };
    }
    // If already installed, no-op.
    if (hasAnyCurlImpersonateBinary(chosenBinDir)) {
        return { ok: true, installed: false, tag: "unknown", binDir: chosenBinDir, assetName: "unknown" };
    }
    const release = await fetchLatestRelease();
    const tag = release.tag_name;
    const assetName = pickAssetName(tag);
    const asset = release.assets.find((a) => a && a.name === assetName);
    if (!asset) {
        return { ok: false, error: `未找到匹配的发布包资源：${assetName}` };
    }
    const tmpDir = await promises_1.default.mkdtemp(path_1.default.join(os_1.default.tmpdir(), "jav-manager-curl-impersonate-"));
    const archivePath = path_1.default.join(tmpDir, assetName);
    try {
        await downloadToFile(asset.browser_download_url, archivePath);
        // Clean install dir before extracting to avoid mixing versions.
        try {
            const entries = await promises_1.default.readdir(chosenBinDir);
            await Promise.all(entries.map((e) => promises_1.default.rm(path_1.default.join(chosenBinDir, e), { force: true, recursive: true })));
        }
        catch {
            // ignore
        }
        extractTarGz(archivePath, chosenBinDir);
        await chmodBinDir(chosenBinDir);
        const metaPath = path_1.default.join(path_1.default.dirname(chosenBinDir), "version.json");
        await promises_1.default.writeFile(metaPath, JSON.stringify({
            tag,
            assetName,
            installedAt: new Date().toISOString(),
        }, null, 2), { encoding: "utf-8" });
        if (!hasAnyCurlImpersonateBinary(chosenBinDir)) {
            return { ok: false, error: "解压完成但未检测到 curl-impersonate 可执行文件。" };
        }
        return { ok: true, installed: true, tag, binDir: chosenBinDir, assetName };
    }
    finally {
        try {
            await promises_1.default.rm(tmpDir, { recursive: true, force: true });
        }
        catch {
            // ignore
        }
    }
}
/**
 * 确保 curl-impersonate 已安装（缺失时自动从 GitHub Releases 下载最新版并解压）。
 *
 * - 默认安装到 `artifacts/curl-impersonate/<platform-arch(-libc)>/bin/`（gitignored）
 * - 若包目录不可写，则回退到用户缓存目录（可通过 `JAVMANAGER_CURL_IMPERSONATE_DIR` 覆盖）
 */
async function ensureCurlImpersonateInstalled() {
    if (installPromise) {
        return installPromise;
    }
    installPromise = (async () => {
        try {
            return await doInstall();
        }
        catch (err) {
            const msg = err instanceof Error ? err.message : String(err);
            return { ok: false, error: msg };
        }
        finally {
            installPromise = null;
        }
    })();
    return installPromise;
}
