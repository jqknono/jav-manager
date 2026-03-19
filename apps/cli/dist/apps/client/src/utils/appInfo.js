"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.AppName = void 0;
exports.getVersion = getVersion;
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
const appPaths_1 = require("./appPaths");
exports.AppName = "JavManager";
function getVersion() {
    const packageInfo = findNearestPackageInfo();
    if (!packageInfo?.version) {
        return "unknown";
    }
    return packageInfo.version;
}
function findNearestPackageInfo() {
    const candidates = [
        __dirname,
        path_1.default.dirname(process.argv[1] ?? process.execPath),
        (0, appPaths_1.getPreferredConfigDirectory)(),
        process.cwd(),
    ];
    for (const startDir of candidates) {
        const packageInfo = findPackageJsonUpwards(startDir);
        if (packageInfo?.version) {
            return packageInfo;
        }
    }
    return null;
}
function findPackageJsonUpwards(startDir) {
    let current = path_1.default.resolve(startDir);
    while (true) {
        const candidate = path_1.default.join(current, "package.json");
        if (fs_1.default.existsSync(candidate)) {
            const raw = fs_1.default.readFileSync(candidate, "utf-8");
            if (raw.trim()) {
                const parsed = JSON.parse(raw);
                if (parsed.version) {
                    return parsed;
                }
            }
        }
        const parent = path_1.default.dirname(current);
        if (parent === current) {
            return null;
        }
        current = parent;
    }
}
