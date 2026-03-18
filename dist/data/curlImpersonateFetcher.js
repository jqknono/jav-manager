"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.CurlImpersonateFetcher = void 0;
exports.isCloudflareChallengeHtml = isCloudflareChallengeHtml;
exports.parseCurlWriteOutOutput = parseCurlWriteOutOutput;
exports.toWslPath = toWslPath;
exports.buildCurlSpawnCommand = buildCurlSpawnCommand;
exports.buildCurlRequestArgs = buildCurlRequestArgs;
const curlBinaryResolver_1 = require("../utils/curlBinaryResolver");
const curlImpersonateInstaller_1 = require("../utils/curlImpersonateInstaller");
const child_process_1 = require("child_process");
const os_1 = __importDefault(require("os"));
const path_1 = __importDefault(require("path"));
const fs_1 = __importDefault(require("fs"));
const CurlWriteOutPrefix = "__JAV_MANAGER_HTTP_CODE__:";
function isCloudflareChallengeHtml(body) {
    if (!body)
        return false;
    const s = body.toLowerCase();
    return (s.includes("just a moment") ||
        s.includes("_cf_chl_opt") ||
        s.includes("cdn-cgi/challenge-platform"));
}
function normalizeWhitespace(input) {
    return (input ?? "").replace(/\s+/g, " ").trim();
}
function getDefaultUserAgentForTarget(target) {
    const normalized = String(target ?? "").trim().toLowerCase();
    const chromeMatch = normalized.match(/^chrome(\d{2,3})/);
    if (chromeMatch) {
        const major = chromeMatch[1];
        return `Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/${major}.0.0.0 Safari/537.36`;
    }
    // Fallback: a reasonable modern Chrome UA.
    return "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";
}
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
function buildCurlRequestArgs(options) {
    const { url, referer, cookieHeader, timeoutMs, caBundlePath, defaultHeaders, userAgent, target, extraCookies, extraHeaders, } = options;
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
    const caBundleResolved = (0, curlBinaryResolver_1.getCurlCaBundlePath)(caBundlePath || null);
    if (caBundleResolved) {
        args.push("--cacert", caBundleResolved);
    }
    // HTTP/2
    args.push("--http2");
    // Browser-like defaults (best-effort; not a Cloudflare bypass guarantee).
    if (defaultHeaders) {
        const ua = normalizeWhitespace(userAgent || "") || getDefaultUserAgentForTarget(target);
        args.push("--user-agent", ua);
        args.push("--header", "Accept: text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8");
        args.push("--header", "Accept-Language: zh-CN,zh;q=0.9,en;q=0.8");
        args.push("--header", "Upgrade-Insecure-Requests: 1");
    }
    // Headers
    if (referer) {
        args.push("--referer", referer);
    }
    const cookieParts = [];
    if (cookieHeader) {
        cookieParts.push(cookieHeader);
    }
    if (extraCookies && Object.keys(extraCookies).length > 0) {
        const extra = Object.entries(extraCookies)
            .map(([k, v]) => `${k}=${v}`)
            .join("; ");
        cookieParts.push(extra);
    }
    if (cookieParts.length > 0) {
        args.push("--cookie", cookieParts.join("; "));
    }
    if (extraHeaders && Object.keys(extraHeaders).length > 0) {
        for (const [name, value] of Object.entries(extraHeaders)) {
            args.push("--header", `${name}: ${value}`);
        }
    }
    // URL
    args.push(url);
    return args;
}
/**
 * HTTP fetcher using curl-impersonate to bypass Cloudflare protection.
 * curl-impersonate is the only supported request method.
 */
class CurlImpersonateFetcher {
    config;
    userAgent;
    available = null;
    binaryPath = null;
    /** When true the resolved binary is the main `curl-impersonate` executable
     *  and we must pass `--impersonate <target>` to select the TLS profile. */
    useImpersonateFlag = false;
    cookieJarFiles = new Map();
    constructor(config, userAgent) {
        this.config = config;
        this.userAgent = userAgent ? String(userAgent) : null;
    }
    injectExtraCookies(cookies) {
        this.config = {
            ...this.config,
            extraCookies: { ...this.config.extraCookies, ...cookies },
        };
    }
    resetAvailabilityCache() {
        this.available = null;
        this.binaryPath = null;
        this.useImpersonateFlag = false;
    }
    async ensureAvailable() {
        if (this.isAvailable()) {
            return { ok: true };
        }
        if (!this.config.enabled) {
            return { ok: false, error: "curl-impersonate is disabled in config" };
        }
        // If the user explicitly configured a path, do not auto-install.
        if (this.config.libraryPath && this.config.libraryPath.trim()) {
            return { ok: false, error: "curl-impersonate binary not found (configured path missing)" };
        }
        const install = await (0, curlImpersonateInstaller_1.ensureCurlImpersonateInstalled)();
        if (!install.ok) {
            return { ok: false, error: `curl-impersonate binary not found; auto-download failed: ${install.error}` };
        }
        this.resetAvailabilityCache();
        if (this.isAvailable()) {
            return { ok: true };
        }
        return { ok: false, error: "curl-impersonate binary not found (auto-download completed but not detected)" };
    }
    async getDiagnostics() {
        const ensured = await this.ensureAvailable();
        const target = this.config.target || "chrome116";
        if (!ensured.ok) {
            return { available: false, binaryPath: null, target, useImpersonateFlag: false };
        }
        return {
            available: true,
            binaryPath: this.binaryPath,
            target,
            useImpersonateFlag: this.useImpersonateFlag,
        };
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
        const ensured = await this.ensureAvailable();
        if (!ensured.ok) {
            return {
                status: 0,
                body: "",
                error: ensured.error,
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
        const target = this.config.target || "chrome116";
        const rawArgs = buildCurlRequestArgs({
            url,
            referer,
            cookieHeader,
            timeoutMs,
            caBundlePath: this.config.caBundlePath || null,
            defaultHeaders: !!this.config.defaultHeaders,
            userAgent: this.userAgent,
            target,
            extraCookies: this.config.extraCookies,
            extraHeaders: this.config.extraHeaders,
        });
        // When using the main `curl-impersonate` binary directly, prepend the
        // --impersonate flag so it selects the correct TLS profile.
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
                        const error = (() => {
                            if (this.isSuccessStatus(parsed.status)) {
                                return undefined;
                            }
                            if (parsed.status === 403 && isCloudflareChallengeHtml(parsed.body)) {
                                return "HTTP 403 (Cloudflare challenge)";
                            }
                            return `HTTP ${parsed.status}`;
                        })();
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
     * Check if status is successful
     */
    isSuccessStatus(status) {
        return status >= 200 && status < 300;
    }
}
exports.CurlImpersonateFetcher = CurlImpersonateFetcher;
