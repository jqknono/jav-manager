import { JavDbCurlImpersonateConfig } from "../config";
import {
  getCurlCaBundlePath,
  checkCurlImpersonateAvailable,
} from "../utils/curlBinaryResolver";
import { ensureCurlImpersonateInstalled } from "../utils/curlImpersonateInstaller";
import { spawn } from "child_process";
import os from "os";
import path from "path";
import fs from "fs";

export interface FetchResult {
  status: number;
  body: string;
  error?: string;
}

const CurlWriteOutPrefix = "__JAV_MANAGER_HTTP_CODE__:";

export function isCloudflareChallengeHtml(body: string): boolean {
  if (!body) return false;
  const s = body.toLowerCase();
  return (
    s.includes("just a moment") ||
    s.includes("_cf_chl_opt") ||
    s.includes("cdn-cgi/challenge-platform")
  );
}

function normalizeWhitespace(input: string): string {
  return (input ?? "").replace(/\s+/g, " ").trim();
}

function getDefaultUserAgentForTarget(target: string): string {
  const normalized = String(target ?? "").trim().toLowerCase();
  const chromeMatch = normalized.match(/^chrome(\d{2,3})/);
  if (chromeMatch) {
    const major = chromeMatch[1];
    return `Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/${major}.0.0.0 Safari/537.36`;
  }

  // Fallback: a reasonable modern Chrome UA.
  return "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";
}

export function parseCurlWriteOutOutput(stdout: string): { status: number; body: string } {
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

export function toWslPath(windowsPath: string): string | null {
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

export function buildCurlSpawnCommand(
  binaryPath: string,
  args: string[]
): { command: string; args: string[]; mode: "native" | "wsl" } {
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

function stripCacertArgs(args: string[]): string[] {
  const result: string[] = [];
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

export function buildCurlRequestArgs(options: {
  url: string;
  referer: string | null;
  cookieHeader: string | null;
  timeoutMs: number;
  caBundlePath: string | null;
  defaultHeaders: boolean;
  userAgent: string | null;
  target: string;
  extraCookies?: Record<string, string>;
  extraHeaders?: Record<string, string>;
}): string[] {
  const {
    url,
    referer,
    cookieHeader,
    timeoutMs,
    caBundlePath,
    defaultHeaders,
    userAgent,
    target,
    extraCookies,
    extraHeaders,
  } = options;

  const args: string[] = [];

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
  const caBundleResolved = getCurlCaBundlePath(caBundlePath || null);
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

  const cookieParts: string[] = [];
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
export class CurlImpersonateFetcher {
  private config: JavDbCurlImpersonateConfig;
  private userAgent: string | null;
  private available: boolean | null = null;
  private binaryPath: string | null = null;
  /** When true the resolved binary is the main `curl-impersonate` executable
   *  and we must pass `--impersonate <target>` to select the TLS profile. */
  private useImpersonateFlag: boolean = false;
  private cookieJarFiles = new Map<string, string>();

  constructor(config: JavDbCurlImpersonateConfig, userAgent?: string | null) {
    this.config = config;
    this.userAgent = userAgent ? String(userAgent) : null;
  }

  injectExtraCookies(cookies: Record<string, string>): void {
    this.config = {
      ...this.config,
      extraCookies: { ...this.config.extraCookies, ...cookies },
    };
  }

  private resetAvailabilityCache(): void {
    this.available = null;
    this.binaryPath = null;
    this.useImpersonateFlag = false;
  }

  private async ensureAvailable(): Promise<{ ok: true } | { ok: false; error: string }> {
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

    const install = await ensureCurlImpersonateInstalled();
    if (!install.ok) {
      return { ok: false, error: `curl-impersonate binary not found; auto-download failed: ${install.error}` };
    }

    this.resetAvailabilityCache();
    if (this.isAvailable()) {
      return { ok: true };
    }

    return { ok: false, error: "curl-impersonate binary not found (auto-download completed but not detected)" };
  }

  async getDiagnostics(): Promise<{
    available: boolean;
    binaryPath: string | null;
    target: string;
    useImpersonateFlag: boolean;
  }> {
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
  isAvailable(): boolean {
    if (this.available !== null) {
      return this.available;
    }

    if (!this.config.enabled) {
      this.available = false;
      return false;
    }

    const target = this.config.target || "chrome116";
    const info = checkCurlImpersonateAvailable(target, this.config.libraryPath || null);

    this.available = info.exists;
    this.binaryPath = info.exists ? info.path : null;
    this.useImpersonateFlag = info.useImpersonateFlag;

    return this.available;
  }

  /**
   * Perform HTTP GET request using curl-impersonate.
   * This is the only supported request method – no fallback.
   */
  async get(
    url: string,
    referer: string | null,
    cookieHeader: string | null,
    timeoutMs: number
  ): Promise<FetchResult> {
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

  private getCookieJarFilePath(url: string): string | null {
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
      const filePath = path.join(os.tmpdir(), `jav-manager-curl-cookie-${safe}.txt`);
      try {
        if (!fs.existsSync(filePath)) {
          fs.writeFileSync(filePath, "", { encoding: "utf-8" });
        }
      } catch {
        // ignore
      }

      this.cookieJarFiles.set(host, filePath);
      return filePath;
    } catch {
      return null;
    }
  }

  /**
   * Perform HTTP GET request using curl-impersonate binary
   */
  private async getCurlImpersonate(
    url: string,
    referer: string | null,
    cookieHeader: string | null,
    timeoutMs: number
  ): Promise<FetchResult> {
    const binaryPath = this.binaryPath!;
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
      ? { command: "wsl", args: ["--exec", toWslPath(binaryPath)!, ...stripCacertArgs(argsWithJar)], mode: "wsl" as const }
      : { command: spawnPlanRaw.command, args: argsWithJar, mode: "native" as const };

    return new Promise((resolve) => {
      let child: ReturnType<typeof spawn> | null = null;
      let stdout = "";
      let stderr = "";
      let resolved = false;

      const timeout = Math.max(1000, timeoutMs);
      const timeoutTimer = setTimeout(() => {
        if (!resolved) {
          resolved = true;
          try {
            child?.kill();
          } catch {
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
        child = spawn(spawnPlan.command, spawnPlan.args, {
          stdio: ["ignore", "pipe", "pipe"],
        });

        child.stdout?.on("data", (data: Buffer) => {
          stdout += data.toString("utf-8");
        });

        child.stderr?.on("data", (data: Buffer) => {
          stderr += data.toString("utf-8");
        });

        child.on("close", (code: number | null) => {
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
          } else {
            const errorMsg = stderr.trim() || `curl exited with code ${code}`;
            resolve({
              status: 0,
              body: "",
              error: errorMsg,
            });
          }
        });

        child.on("error", (err: Error) => {
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
      } catch (err) {
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
  private isSuccessStatus(status: number): boolean {
    return status >= 200 && status < 300;
  }
}
