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
 * HTTP fetcher that attempts to use curl-impersonate to bypass Cloudflare protection
 * Falls back to system curl with enhanced headers if curl-impersonate is unavailable
 */
class CurlImpersonateFetcher {
    config;
    available = null;
    binaryPath = null;
    systemCurlAvailable = null;
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
        return this.available;
    }
    /**
     * Check if system curl is available
     */
    isSystemCurlAvailable() {
        if (this.systemCurlAvailable !== null) {
            return this.systemCurlAvailable;
        }
        try {
            (0, child_process_1.execSync)("curl --version", { stdio: "ignore" });
            this.systemCurlAvailable = true;
            return true;
        }
        catch {
            this.systemCurlAvailable = false;
            return false;
        }
    }
    /**
     * Perform HTTP GET request using curl-impersonate or system curl
     */
    async get(url, referer, cookieHeader, timeoutMs) {
        // Try curl-impersonate first if enabled and available
        if (this.isAvailable()) {
            try {
                const result = await this.getCurlImpersonate(url, referer, cookieHeader, timeoutMs);
                if (this.isSuccessStatus(result.status)) {
                    return result;
                }
                // If curl-impersonate fails, fall back to system curl
                console.warn(`curl-impersonate returned status ${result.status}, falling back to system curl`);
            }
            catch (error) {
                console.warn(`curl-impersonate error: ${error instanceof Error ? error.message : "Unknown error"}, falling back to system curl`);
            }
        }
        // Try system curl with enhanced headers
        if (this.isSystemCurlAvailable()) {
            try {
                const result = await this.getSystemCurl(url, referer, cookieHeader, timeoutMs);
                if (this.isSuccessStatus(result.status)) {
                    return result;
                }
                console.warn(`system curl returned status ${result.status}, falling back to enhanced fetch`);
            }
            catch (error) {
                console.warn(`system curl error: ${error instanceof Error ? error.message : "Unknown error"}, falling back to enhanced fetch`);
            }
        }
        // Fallback to enhanced fetch
        return this.getEnhancedFetch(url, referer, cookieHeader, timeoutMs);
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
        const rawArgs = this.buildCurlArgs(url, referer, cookieHeader, timeoutMs, true);
        const spawnPlanRaw = buildCurlSpawnCommand(binaryPath, rawArgs);
        const cookieJarFile = this.getCookieJarFilePath(url);
        const argsWithJar = (() => {
            if (!cookieJarFile) {
                return rawArgs;
            }
            const jarPath = spawnPlanRaw.mode === "wsl" ? toWslPath(cookieJarFile) : cookieJarFile;
            if (!jarPath) {
                return rawArgs;
            }
            // Read & write cookies (helps Cloudflare/JavDB session cookies persist between requests).
            return [...rawArgs, "--cookie", jarPath, "--cookie-jar", jarPath];
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
     * Perform HTTP GET request using system curl with enhanced headers
     */
    async getSystemCurl(url, referer, cookieHeader, timeoutMs) {
        const baseArgs = this.buildCurlArgs(url, referer, cookieHeader, timeoutMs, false);
        const cookieJarFile = this.getCookieJarFilePath(url);
        const args = cookieJarFile ? [...baseArgs, "--cookie", cookieJarFile, "--cookie-jar", cookieJarFile] : baseArgs;
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
                child = (0, child_process_1.spawn)("curl", args, {
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
     * Perform HTTP GET request using enhanced fetch with Cloudflare bypass headers
     */
    async getEnhancedFetch(url, referer, cookieHeader, timeoutMs) {
        const headers = this.buildEnhancedHeaders(referer, cookieHeader);
        const controller = new AbortController();
        const timeoutTimer = setTimeout(() => controller.abort(), timeoutMs);
        try {
            const response = await fetch(url, {
                method: "GET",
                headers,
                signal: controller.signal,
            });
            clearTimeout(timeoutTimer);
            const body = await response.text();
            return {
                status: response.status,
                body,
            };
        }
        catch (error) {
            clearTimeout(timeoutTimer);
            return {
                status: 0,
                body: "",
                error: error instanceof Error ? error.message : "Unknown error",
            };
        }
    }
    /**
     * Build curl command line arguments
     */
    buildCurlArgs(url, referer, cookieHeader, timeoutMs, useImpersonate) {
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
        // Add enhanced headers for system curl
        if (!useImpersonate) {
            const chromeVersion = "144.0.0.0";
            const chromeMajor = "144";
            args.push("--user-agent", `Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/${chromeVersion} Safari/537.36`);
            args.push("--header", `Accept: text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7`);
            args.push("--header", `Accept-Language: zh-CN,zh;q=0.9,en-US;q=0.8,en;q=0.7,ja;q=0.6`);
            args.push("--header", `Accept-Encoding: gzip, deflate, br`);
            args.push("--header", `Connection: keep-alive`);
            args.push("--header", `Upgrade-Insecure-Requests: 1`);
            args.push("--header", `Sec-Fetch-Dest: document`);
            args.push("--header", `Sec-Fetch-Mode: navigate`);
            args.push("--header", `Sec-Fetch-Site: ${referer ? "same-origin" : "none"}`);
            args.push("--header", `Sec-Fetch-User: ?1`);
            args.push("--header", `Cache-Control: max-age=0`);
            args.push("--header", `sec-ch-ua: "Google Chrome";v="${chromeMajor}", "Chromium";v="${chromeMajor}", "Not_A Brand";v="24"`);
            args.push("--header", `sec-ch-ua-mobile: ?0`);
            args.push("--header", `sec-ch-ua-platform: "Windows"`);
            args.push("--header", `DNT: 1`);
        }
        // URL
        args.push(url);
        return args;
    }
    /**
     * Build enhanced headers for Cloudflare bypass
     */
    buildEnhancedHeaders(referer, cookieHeader) {
        const chromeVersion = "144.0.0.0";
        const chromeMajor = "144";
        const headers = {
            // Standard browser headers
            "User-Agent": `Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/${chromeVersion} Safari/537.36`,
            "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7",
            "Accept-Language": "zh-CN,zh;q=0.9,en-US;q=0.8,en;q=0.7,ja;q=0.6",
            "Accept-Encoding": "gzip, deflate, br",
            "Connection": "keep-alive",
            "Upgrade-Insecure-Requests": "1",
            "Sec-Fetch-Dest": "document",
            "Sec-Fetch-Mode": "navigate",
            "Sec-Fetch-Site": referer ? "same-origin" : "none",
            "Sec-Fetch-User": "?1",
            "Cache-Control": "max-age=0",
            // Client Hints (important for Cloudflare)
            "sec-ch-ua": `"Google Chrome";v="${chromeMajor}", "Chromium";v="${chromeMajor}", "Not_A Brand";v="24"`,
            "sec-ch-ua-mobile": "?0",
            "sec-ch-ua-platform": `"Windows"`,
            // Additional client hints that help bypass detection
            "Sec-CH-UA-Arch": '"x86"',
            "Sec-CH-UA-Bitness": '"64"',
            "Sec-CH-UA-Full-Version": `"${chromeVersion}"`,
            "Sec-CH-UA-Model": '""',
            "Sec-CH-UA-Prefers-Color-Scheme": '"light"',
            "Sec-CH-UA-Prefers-Reduced-Motion": '"no-reduced-motion"',
            // Additional headers that may help
            DNT: "1",
            "Sec-Purpose": "prefetch",
        };
        if (referer) {
            headers.Referer = referer;
        }
        if (cookieHeader) {
            headers.Cookie = cookieHeader;
        }
        return headers;
    }
    /**
     * Check if status is successful
     */
    isSuccessStatus(status) {
        return status >= 200 && status < 300;
    }
}
exports.CurlImpersonateFetcher = CurlImpersonateFetcher;
