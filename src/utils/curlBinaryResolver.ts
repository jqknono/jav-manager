import path from "path";
import fs from "fs";

export interface CurlBinaryInfo {
  path: string;
  exists: boolean;
  target: string;
}

function resolvePathMaybeRelative(filePath: string): string {
  if (!filePath) {
    return filePath;
  }
  if (path.isAbsolute(filePath)) {
    return filePath;
  }
  return path.resolve(process.cwd(), filePath);
}

function isExecutableFile(filePath: string): boolean {
  try {
    const stat = fs.statSync(filePath);
    return stat.isFile();
  } catch {
    return false;
  }
}

function findOnPath(fileName: string): string | null {
  const envPath = process.env.PATH ?? "";
  const sep = process.platform === "win32" ? ";" : ":";
  const entries = envPath
    .split(sep)
    .map((p) => p.trim())
    .filter((p) => p.length > 0);

  for (const dir of entries) {
    const candidate = path.join(dir, fileName);
    if (isExecutableFile(candidate)) {
      return candidate;
    }
  }

  return null;
}

/**
 * Get the platform-specific curl-impersonate binary path
 */
export function getCurlImpersonateBinaryPath(
  target: string = "chrome116",
  configuredPath: string | null = null
): string | null {
  if (configuredPath && configuredPath.trim()) {
    return resolvePathMaybeRelative(configuredPath.trim());
  }

  const platform = process.platform;
  const arch = process.arch;

  // Map platform/arch to binary path in third_party/curl-impersonate/
  const binaryMap: Record<string, Record<string, string>> = {
    win32: {
      x64: path.join("third_party", "curl-impersonate", "bin", `curl_${target}.exe`),
      arm64: path.join("third_party", "curl-impersonate", "bin", `curl_${target}.exe`),
    },
    linux: {
      x64: path.join("third_party", "curl-impersonate", "bin", `curl_${target}`),
      arm64: path.join("third_party", "curl-impersonate", "bin", `curl_${target}`),
    },
    darwin: {
      x64: path.join("third_party", "curl-impersonate", "bin", `curl_${target}`),
      arm64: path.join("third_party", "curl-impersonate", "bin", `curl_${target}`),
    },
  };

  const platformBinaries = binaryMap[platform];
  if (!platformBinaries) {
    return null;
  }

  const binaryPath = platformBinaries[arch] || platformBinaries.x64;
  return resolvePathMaybeRelative(binaryPath);
}

/**
 * Get the CA bundle path for curl-impersonate
 */
export function getCurlCaBundlePath(
  configuredPath: string | null = null
): string | null {
  if (configuredPath && fs.existsSync(configuredPath)) {
    return configuredPath;
  }

  const platform = process.platform;
  const arch = process.arch;

  // Map platform/arch to CA bundle path in native/curl-impersonate/
  const caBundleMap: Record<string, Record<string, string>> = {
    win32: {
      x64: path.join("native", "curl-impersonate", "win-x64", "cacert.pem"),
      arm64: path.join("native", "curl-impersonate", "win-arm64", "cacert.pem"),
    },
    linux: {
      x64: path.join("native", "curl-impersonate", "linux-x64", "cacert.pem"),
      arm64: path.join("native", "curl-impersonate", "linux-arm64", "cacert.pem"),
    },
    darwin: {
      x64: path.join("native", "curl-impersonate", "osx-x64", "cacert.pem"),
      arm64: path.join("native", "curl-impersonate", "osx-arm64", "cacert.pem"),
    },
  };

  const platformCaBundles = caBundleMap[platform];
  if (!platformCaBundles) {
    return null;
  }

  const caBundlePath = platformCaBundles[arch] || platformCaBundles.x64;
  if (fs.existsSync(caBundlePath)) {
    return caBundlePath;
  }

  return null;
}

/**
 * Check if curl-impersonate binary is available
 */
export function checkCurlImpersonateAvailable(
  target: string = "chrome116",
  configuredPath: string | null = null
): CurlBinaryInfo {
  const binaryPath = getCurlImpersonateBinaryPath(target, configuredPath);
  if (!binaryPath) {
    return { path: "", exists: false, target };
  }

  const existsOnDisk = fs.existsSync(binaryPath);
  if (existsOnDisk) {
    return { path: binaryPath, exists: true, target };
  }

  // Windows fallback: allow vendored Linux binaries (to be run via WSL) when the .exe doesn't exist.
  if (process.platform === "win32" && binaryPath.toLowerCase().endsWith(".exe")) {
    const alt = binaryPath.slice(0, -4);
    if (alt && fs.existsSync(alt)) {
      return { path: alt, exists: true, target };
    }
  }

  // Allow PATH-installed curl_<target> binaries (useful when vendoring isn't available).
  const fileName = process.platform === "win32" ? `curl_${target}.exe` : `curl_${target}`;
  const found = findOnPath(fileName);
  if (found) {
    return { path: found, exists: true, target };
  }

  return {
    path: binaryPath,
    exists: false,
    target,
  };
}

/**
 * Get available curl-impersonate targets
 */
export function getAvailableTargets(): string[] {
  const targets = ["chrome116", "chrome120", "chrome131", "chrome136", "chrome144", "firefox133", "firefox135"];
  const available: string[] = [];

  for (const target of targets) {
    const info = checkCurlImpersonateAvailable(target, null);
    if (info.exists) {
      available.push(target);
    }
  }

  return available;
}
