import { JavDbCurlImpersonateConfig } from "../config";
import {
  getCurlCaBundlePath,
  checkCurlImpersonateAvailable,
} from "../utils/curlBinaryResolver";
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

/**
 * HTTP fetcher using curl-impersonate to bypass Cloudflare protection.
 * curl-impersonate is the only supported request method.
 */
export class CurlImpersonateFetcher {
  private config: JavDbCurlImpersonateConfig;
  private available: boolean | null = null;
  private binaryPath: string | null = null;
  /** When true the resolved binary is the main `curl-impersonate` executable
   *  and we must pass `--impersonate <target>` to select the TLS profile. */
  private useImpersonateFlag: boolean = false;
  private cookieJarFiles = new Map<string, string>();

  constructor(config: JavDbCurlImpersonateConfig) {
    this.config = config;
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
            const error = this.isSuccessStatus(parsed.status) ? undefined : `HTTP ${parsed.status}`;
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
   * Build curl command line arguments
   */
  private buildCurlArgs(
    url: string,
    referer: string | null,
    cookieHeader: string | null,
    timeoutMs: number
  ): string[] {
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
    const caBundlePath = getCurlCaBundlePath(this.config.caBundlePath || null);
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
  private isSuccessStatus(status: number): boolean {
    return status >= 200 && status < 300;
  }
}
