"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getPreferredConfigDirectory = getPreferredConfigDirectory;
exports.getAppSettingsPath = getAppSettingsPath;
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
function getPreferredConfigDirectory() {
    const override = process.env.JAVMANAGER_CONFIG_DIR;
    if (override && fs_1.default.existsSync(override)) {
        return override;
    }
    const execDir = path_1.default.dirname(process.argv[1] ?? process.execPath);
    const cwd = process.cwd();
    if (hasConfig(execDir)) {
        return execDir;
    }
    if (hasConfig(cwd)) {
        return cwd;
    }
    return execDir || cwd;
}
function getAppSettingsPath() {
    return path_1.default.join(getPreferredConfigDirectory(), "appsettings.json");
}
function hasConfig(dir) {
    const file = path_1.default.join(dir, "appsettings.json");
    return fs_1.default.existsSync(file);
}
