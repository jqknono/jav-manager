"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.openContainingFolder = openContainingFolder;
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
const open_1 = __importDefault(require("open"));
async function openContainingFolder(targetPath) {
    if (!targetPath) {
        return;
    }
    const resolved = path_1.default.resolve(targetPath);
    const stat = fs_1.default.existsSync(resolved) ? fs_1.default.statSync(resolved) : null;
    const folder = stat && stat.isDirectory() ? resolved : path_1.default.dirname(resolved);
    await (0, open_1.default)(folder);
}
