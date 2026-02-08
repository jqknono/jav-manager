"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getCurlImpersonateBinaryPath = getCurlImpersonateBinaryPath;
exports.getCurlImpersonateMainBinaryPath = getCurlImpersonateMainBinaryPath;
exports.getCurlCaBundlePath = getCurlCaBundlePath;
exports.checkCurlImpersonateAvailable = checkCurlImpersonateAvailable;
exports.getAvailableTargets = getAvailableTargets;
const path_1 = __importDefault(require("path"));
const fs_1 = __importDefault(require("fs"));
/**
 * Package root directory (works for both src/ and dist/ layouts).
 * __dirname is either src/utils/ or dist/utils/ – two levels up is the package root.
 */
const packageRoot = path_1.default.resolve(__dirname, "..", "..");
function resolveRelativeToPackageRoot(filePath) {
    if (!filePath) {
        return filePath;
    }
    if (path_1.default.isAbsolute(filePath)) {
        return filePath;
    }
    return path_1.default.resolve(packageRoot, filePath);
}
function resolveRelativeToCwd(filePath) {
    if (!filePath) {
        return filePath;
    }
    if (path_1.default.isAbsolute(filePath)) {
        return filePath;
    }
    return path_1.default.resolve(process.cwd(), filePath);
}
function isExecutableFile(filePath) {
    try {
        const stat = fs_1.default.statSync(filePath);
        return stat.isFile();
    }
    catch {
        return false;
    }
}
function findOnPath(fileName) {
    const envPath = process.env.PATH ?? "";
    const sep = process.platform === "win32" ? ";" : ":";
    const entries = envPath
        .split(sep)
        .map((p) => p.trim())
        .filter((p) => p.length > 0);
    for (const dir of entries) {
        const candidate = path_1.default.join(dir, fileName);
        if (isExecutableFile(candidate)) {
            return candidate;
        }
    }
    return null;
}
/**
 * Get the platform-specific curl-impersonate target wrapper script path.
 * Resolves vendored paths relative to the **package root** (not CWD) so that
 * the binary is found regardless of where the user invokes the command.
 */
function getCurlImpersonateBinaryPath(target = "chrome116", configuredPath = null) {
    // User-configured path is resolved relative to CWD (explicit override).
    if (configuredPath && configuredPath.trim()) {
        return resolveRelativeToCwd(configuredPath.trim());
    }
    const platform = process.platform;
    const arch = process.arch;
    // Map platform/arch to target wrapper script in third_party/curl-impersonate/
    const binaryMap = {
        win32: {
            x64: path_1.default.join("third_party", "curl-impersonate", "bin", `curl_${target}.exe`),
            arm64: path_1.default.join("third_party", "curl-impersonate", "bin", `curl_${target}.exe`),
        },
        linux: {
            x64: path_1.default.join("third_party", "curl-impersonate", "bin", `curl_${target}`),
            arm64: path_1.default.join("third_party", "curl-impersonate", "bin", `curl_${target}`),
        },
        darwin: {
            x64: path_1.default.join("third_party", "curl-impersonate", "bin", `curl_${target}`),
            arm64: path_1.default.join("third_party", "curl-impersonate", "bin", `curl_${target}`),
        },
    };
    const platformBinaries = binaryMap[platform];
    if (!platformBinaries) {
        return null;
    }
    const binaryPath = platformBinaries[arch] || platformBinaries.x64;
    return resolveRelativeToPackageRoot(binaryPath);
}
/**
 * Get the path to the main `curl-impersonate` executable (not a target wrapper).
 * Checks vendored location first, then falls back to PATH lookup.
 */
function getCurlImpersonateMainBinaryPath() {
    const ext = process.platform === "win32" ? ".exe" : "";
    const vendoredRelative = path_1.default.join("third_party", "curl-impersonate", "bin", `curl-impersonate${ext}`);
    const vendored = resolveRelativeToPackageRoot(vendoredRelative);
    if (isExecutableFile(vendored)) {
        return vendored;
    }
    // Windows fallback: vendored Linux binary (to be run via WSL).
    if (process.platform === "win32") {
        const alt = resolveRelativeToPackageRoot(path_1.default.join("third_party", "curl-impersonate", "bin", "curl-impersonate"));
        if (isExecutableFile(alt)) {
            return alt;
        }
    }
    return findOnPath(`curl-impersonate${ext}`);
}
/**
 * Get the CA bundle path for curl-impersonate
 */
function getCurlCaBundlePath(configuredPath = null) {
    if (configuredPath && fs_1.default.existsSync(configuredPath)) {
        return configuredPath;
    }
    const platform = process.platform;
    const arch = process.arch;
    // Map platform/arch to CA bundle path in native/curl-impersonate/
    const caBundleMap = {
        win32: {
            x64: path_1.default.join("native", "curl-impersonate", "win-x64", "cacert.pem"),
            arm64: path_1.default.join("native", "curl-impersonate", "win-arm64", "cacert.pem"),
        },
        linux: {
            x64: path_1.default.join("native", "curl-impersonate", "linux-x64", "cacert.pem"),
            arm64: path_1.default.join("native", "curl-impersonate", "linux-arm64", "cacert.pem"),
        },
        darwin: {
            x64: path_1.default.join("native", "curl-impersonate", "osx-x64", "cacert.pem"),
            arm64: path_1.default.join("native", "curl-impersonate", "osx-arm64", "cacert.pem"),
        },
    };
    const platformCaBundles = caBundleMap[platform];
    if (!platformCaBundles) {
        return null;
    }
    const relative = platformCaBundles[arch] || platformCaBundles.x64;
    const resolved = resolveRelativeToPackageRoot(relative);
    if (fs_1.default.existsSync(resolved)) {
        return resolved;
    }
    return null;
}
/**
 * Check if curl-impersonate binary is available.
 *
 * On Linux/macOS the main `curl-impersonate` ELF binary is preferred because
 * it is a standalone executable that does not depend on bash; the `curl_<target>`
 * wrapper scripts are shell scripts requiring `#!/usr/bin/env bash` which may
 * not be available in all environments.
 *
 * Resolution order (Linux/macOS):
 *   1. User-configured path
 *   2. Vendored main `curl-impersonate` binary (package root) – with `--impersonate` flag
 *   3. `curl-impersonate` on PATH – with `--impersonate` flag
 *   4. Vendored wrapper script `curl_<target>` (package root)
 *   5. `curl_<target>` on PATH
 *
 * Resolution order (Windows):
 *   1. User-configured path
 *   2. Vendored wrapper `curl_<target>.exe` / non-`.exe` WSL fallback (package root)
 *   3. `curl_<target>.exe` on PATH
 *   4. Main `curl-impersonate` binary (vendored or PATH) – with `--impersonate` flag
 */
function checkCurlImpersonateAvailable(target = "chrome116", configuredPath = null) {
    // 1. User-configured path (resolved relative to CWD).
    if (configuredPath && configuredPath.trim()) {
        const binaryPath = getCurlImpersonateBinaryPath(target, configuredPath);
        if (binaryPath && fs_1.default.existsSync(binaryPath)) {
            return { path: binaryPath, exists: true, target, useImpersonateFlag: false };
        }
    }
    // On non-Windows, prefer the main binary (standalone ELF, no bash dependency).
    if (process.platform !== "win32") {
        const mainBinary = getCurlImpersonateMainBinaryPath();
        if (mainBinary) {
            return { path: mainBinary, exists: true, target, useImpersonateFlag: true };
        }
    }
    // Vendored wrapper script lookup.
    const binaryPath = getCurlImpersonateBinaryPath(target, null);
    if (binaryPath) {
        if (fs_1.default.existsSync(binaryPath)) {
            return { path: binaryPath, exists: true, target, useImpersonateFlag: false };
        }
        // Windows fallback: allow vendored Linux binaries (to be run via WSL) when the .exe doesn't exist.
        if (process.platform === "win32" && binaryPath.toLowerCase().endsWith(".exe")) {
            const alt = binaryPath.slice(0, -4);
            if (alt && fs_1.default.existsSync(alt)) {
                return { path: alt, exists: true, target, useImpersonateFlag: false };
            }
        }
    }
    // Allow PATH-installed curl_<target> binaries.
    const fileName = process.platform === "win32" ? `curl_${target}.exe` : `curl_${target}`;
    const found = findOnPath(fileName);
    if (found) {
        return { path: found, exists: true, target, useImpersonateFlag: false };
    }
    // Windows: main binary fallback (vendored or PATH) as last resort.
    if (process.platform === "win32") {
        const mainBinary = getCurlImpersonateMainBinaryPath();
        if (mainBinary) {
            return { path: mainBinary, exists: true, target, useImpersonateFlag: true };
        }
    }
    return {
        path: binaryPath ?? "",
        exists: false,
        target,
        useImpersonateFlag: false,
    };
}
/**
 * Get available curl-impersonate targets
 */
function getAvailableTargets() {
    const targets = ["chrome116", "chrome120", "chrome131", "chrome136", "chrome144", "firefox133", "firefox135"];
    const available = [];
    for (const target of targets) {
        const info = checkCurlImpersonateAvailable(target, null);
        if (info.exists) {
            available.push(target);
        }
    }
    return available;
}
