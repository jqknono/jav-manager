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
    const baseDir = (0, appPaths_1.getPreferredConfigDirectory)();
    const packagePath = path_1.default.join(baseDir, "package.json");
    if (!fs_1.default.existsSync(packagePath)) {
        return "unknown";
    }
    const raw = fs_1.default.readFileSync(packagePath, "utf-8");
    if (!raw.trim()) {
        return "unknown";
    }
    const parsed = JSON.parse(raw);
    return parsed.version ?? "unknown";
}
