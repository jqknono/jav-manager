"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.CurlImpersonateFetcher = void 0;
exports.parseCurlWriteOutOutput = parseCurlWriteOutOutput;
exports.toWslPath = toWslPath;
exports.buildCurlSpawnCommand = buildCurlSpawnCommand;
const curlBinaryResolver_1 = require("../utils/curlBinaryResolver");
const child_process_1 = require("child_process");
const os_1 = __importDefault(require("os"));
const path_1 = __importDefault(require("path"));
const fs_1 = __importDefault(require("fs"));
const CurlWriteOutPrefix = "__JAV_MANAGER_HTTP_CODE__:";
function parseCurlWriteOutOutput(stdout) {
    if (!stdout) {
        return { status: 0, body: "" };
    }
    const idx = stdout.lastIndexOf(CurlWriteOutPrefix);
    if (idx < 0) {
        return { status: 0, body: stdout };
    }
    const before = stdout.slice(0, idx);
    const after = stdout.slice(idx + CurlWriteOutPrefix.length);
    const match = after.match(/(\d{3})/);
    const status = match ? Number(match[1]) : 0;
    const body = before.replace(/\s+$/g, "");
    return { status: Number.isFinite(status) ? status : 0, body };
}
function toWslPath(windowsPath) {
    if (!windowsPath) {
        return null;
    }
    const normalized = windowsPath.replace(/\//g, "\\").trim();
    const match = normalized.match(/^([A-Za-z]):\\(.*)$/);
    if (!match) {
        return null;
    }
    const drive = match[1].toLowerCase();
    const rest = match[2].replace(/\\/g, "/");
    return `/mnt/${drive}/${rest}`;
}
function buildCurlSpawnCommand(binaryPath, args) {
    if (process.platform !== "win32") {
        return { command: binaryPath, args, mode: "native" };
    }
    const isWindowsExe = binaryPath.toLowerCase().endsWith(".exe");
    if (isWindowsExe) {
        return { command: binaryPath, args, mode: "native" };
    }
    const wslPath = toWslPath(binaryPath);
    if (!wslPath) {
        return { command: binaryPath, args, mode: "native" };
    }
    // Use --exec to avoid WSL shell interpretation issues (e.g. URLs containing '&').
    return { command: "wsl", args: ["--exec", wslPath, ...args], mode: "wsl" };
}
function stripCacertArgs(args) {
    const result = [];
    for (let i = 0; i < args.length; i += 1) {
        const current = args[i];
        if (current === "--cacert") {
            i += 1;
            continue;
        }
        result.push(current);
    }
    return result;
}
/**
 * HTTP fetcher using curl-impersonate to bypass Cloudflare protection.
 * curl-impersonate is the only supported request method.
 */
class CurlImpersonateFetcher {
    config;
    available = null;
    binaryPath = null;
    /** When true the resolved binary is the main `curl-impersonate` executable
     *  and we must pass `--impersonate <target>` to select the TLS profile. */
    useImpersonateFlag = false;
    cookieJarFiles = new Map();
    constructor(config) {
        this.config = config;
    }
    /**
     * Check if curl-impersonate is available
     */
    isAvailable() {
        if (this.available !== null) {
            return this.available;
        }
        if (!this.config.enabled) {
            this.available = false;
            return false;
        }
        const target = this.config.target || "chrome116";
        const info = (0, curlBinaryResolver_1.checkCurlImpersonateAvailable)(target, this.config.libraryPath || null);
        this.available = info.exists;
        this.binaryPath = info.exists ? info.path : null;
        this.useImpersonateFlag = info.useImpersonateFlag;
        return this.available;
    }
    /**
     * Perform HTTP GET request using curl-impersonate.
     * This is the only supported request method – no fallback.
     */
    async get(url, referer, cookieHeader, timeoutMs) {
        // Ensure binary path is resolved (isAvailable caches the result).
        if (!this.isAvailable()) {
            return {
                status: 0,
                body: "",
                error: "curl-impersonate binary not found",
            };
        }
        return this.getCurlImpersonate(url, referer, cookieHeader, timeoutMs);
    }
    getCookieJarFilePath(url) {
        try {
            const host = new URL(url).host;
            if (!host) {
                return null;
            }
            const existing = this.cookieJarFiles.get(host);
            if (existing) {
                return existing;
            }
            const safe = host.replace(/[^a-zA-Z0-9.-]+/g, "-");
            const filePath = path_1.default.join(os_1.default.tmpdir(), `jav-manager-curl-cookie-${safe}.txt`);
            try {
                if (!fs_1.default.existsSync(filePath)) {
                    fs_1.default.writeFileSync(filePath, "", { encoding: "utf-8" });
                }
            }
            catch {
                // ignore
            }
            this.cookieJarFiles.set(host, filePath);
            return filePath;
        }
        catch {
            return null;
        }
    }
    /**
     * Perform HTTP GET request using curl-impersonate binary
     */
    async getCurlImpersonate(url, referer, cookieHeader, timeoutMs) {
        const binaryPath = this.binaryPath;
        const rawArgs = this.buildCurlArgs(url, referer, cookieHeader, timeoutMs);
        // When using the main `curl-impersonate` binary directly, prepend the
        // --impersonate flag so it selects the correct TLS profile.
        const target = this.config.target || "chrome116";
        const impersonatePrefix = this.useImpersonateFlag
            ? ["--impersonate", target]
            : [];
        const argsWithTarget = [...impersonatePrefix, ...rawArgs];
        const spawnPlanRaw = buildCurlSpawnCommand(binaryPath, argsWithTarget);
        const cookieJarFile = this.getCookieJarFilePath(url);
        const argsWithJar = (() => {
            if (!cookieJarFile) {
                return argsWithTarget;
            }
            const jarPath = spawnPlanRaw.mode === "wsl" ? toWslPath(cookieJarFile) : cookieJarFile;
            if (!jarPath) {
                return argsWithTarget;
            }
            // Read & write cookies (helps Cloudflare/JavDB session cookies persist between requests).
            return [...argsWithTarget, "--cookie", jarPath, "--cookie-jar", jarPath];
        })();
        const spawnPlan = spawnPlanRaw.mode === "wsl"
            ? { command: "wsl", args: ["--exec", toWslPath(binaryPath), ...stripCacertArgs(argsWithJar)], mode: "wsl" }
            : { command: spawnPlanRaw.command, args: argsWithJar, mode: "native" };
        return new Promise((resolve) => {
            let child = null;
            let stdout = "";
            let stderr = "";
            let resolved = false;
            const timeout = Math.max(1000, timeoutMs);
            const timeoutTimer = setTimeout(() => {
                if (!resolved) {
                    resolved = true;
                    try {
                        child?.kill();
                    }
                    catch {
                        // ignore
                    }
                    resolve({
                        status: 0,
                        body: "",
                        error: `Request timeout after ${timeout}ms`,
                    });
                }
            }, timeout);
            try {
                child = (0, child_process_1.spawn)(spawnPlan.command, spawnPlan.args, {
                    stdio: ["ignore", "pipe", "pipe"],
                });
                child.stdout?.on("data", (data) => {
                    stdout += data.toString("utf-8");
                });
                child.stderr?.on("data", (data) => {
                    stderr += data.toString("utf-8");
                });
                child.on("close", (code) => {
                    clearTimeout(timeoutTimer);
                    if (resolved) {
                        return;
                    }
                    resolved = true;
                    if (code === 0) {
                        const parsed = parseCurlWriteOutOutput(stdout);
                        const error = this.isSuccessStatus(parsed.status) ? undefined : `HTTP ${parsed.status}`;
                        resolve({ status: parsed.status, body: parsed.body, error });
                    }
                    else {
                        const errorMsg = stderr.trim() || `curl exited with code ${code}`;
                        resolve({
                            status: 0,
                            body: "",
                            error: errorMsg,
                        });
                    }
                });
                child.on("error", (err) => {
                    clearTimeout(timeoutTimer);
                    if (resolved) {
                        return;
                    }
                    resolved = true;
                    resolve({
                        status: 0,
                        body: "",
                        error: `Failed to spawn curl: ${err.message}`,
                    });
                });
            }
            catch (err) {
                clearTimeout(timeoutTimer);
                if (resolved) {
                    return;
                }
                resolved = true;
                resolve({
                    status: 0,
                    body: "",
                    error: err instanceof Error ? err.message : "Unknown error",
                });
            }
        });
    }
    /**
     * Build curl command line arguments
     */
    buildCurlArgs(url, referer, cookieHeader, timeoutMs) {
        const args = [];
        // Basic options
        args.push("--silent");
        args.push("--show-error");
        args.push("--location");
        args.push("--compressed");
        // Avoid backslash escapes here: WSL may strip backslashes when forwarding args from Windows to Linux,
        // which can make parsing brittle.
        args.push("--write-out", `${CurlWriteOutPrefix}%{http_code}`);
        // Timeout (convert ms to seconds)
        const timeoutSec = Math.max(1, Math.floor(timeoutMs / 1000));
        args.push("--max-time", timeoutSec.toString());
        args.push("--connect-timeout", Math.min(timeoutSec, 10).toString());
        // CA bundle
        const caBundlePath = (0, curlBinaryResolver_1.getCurlCaBundlePath)(this.config.caBundlePath || null);
        if (caBundlePath) {
            args.push("--cacert", caBundlePath);
        }
        // HTTP/2
        args.push("--http2");
        // Headers
        if (referer) {
            args.push("--referer", referer);
        }
        if (cookieHeader) {
            args.push("--cookie", cookieHeader);
        }
        // URL
        args.push(url);
        return args;
    }
    /**
     * Check if status is successful
     */
    isSuccessStatus(status) {
        return status >= 200 && status < 300;
    }
}
exports.CurlImpersonateFetcher = CurlImpersonateFetcher;
