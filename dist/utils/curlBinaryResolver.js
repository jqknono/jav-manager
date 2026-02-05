"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getCurlImpersonateBinaryPath = getCurlImpersonateBinaryPath;
exports.getCurlCaBundlePath = getCurlCaBundlePath;
exports.checkCurlImpersonateAvailable = checkCurlImpersonateAvailable;
exports.getAvailableTargets = getAvailableTargets;
const path_1 = __importDefault(require("path"));
const fs_1 = __importDefault(require("fs"));
function resolvePathMaybeRelative(filePath) {
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
 * Get the platform-specific curl-impersonate binary path
 */
function getCurlImpersonateBinaryPath(target = "chrome116", configuredPath = null) {
    if (configuredPath && configuredPath.trim()) {
        return resolvePathMaybeRelative(configuredPath.trim());
    }
    const platform = process.platform;
    const arch = process.arch;
    // Map platform/arch to binary path in third_party/curl-impersonate/
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
    return resolvePathMaybeRelative(binaryPath);
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
    const caBundlePath = platformCaBundles[arch] || platformCaBundles.x64;
    if (fs_1.default.existsSync(caBundlePath)) {
        return caBundlePath;
    }
    return null;
}
/**
 * Check if curl-impersonate binary is available
 */
function checkCurlImpersonateAvailable(target = "chrome116", configuredPath = null) {
    const binaryPath = getCurlImpersonateBinaryPath(target, configuredPath);
    if (!binaryPath) {
        return { path: "", exists: false, target };
    }
    const existsOnDisk = fs_1.default.existsSync(binaryPath);
    if (existsOnDisk) {
        return { path: binaryPath, exists: true, target };
    }
    // Windows fallback: allow vendored Linux binaries (to be run via WSL) when the .exe doesn't exist.
    if (process.platform === "win32" && binaryPath.toLowerCase().endsWith(".exe")) {
        const alt = binaryPath.slice(0, -4);
        if (alt && fs_1.default.existsSync(alt)) {
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
