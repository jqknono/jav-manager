"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.mb = mb;
exports.tryParseToBytes = tryParseToBytes;
const unitMap = {
    B: 1,
    KB: 1024,
    KIB: 1024,
    K: 1024,
    MB: 1024 * 1024,
    MIB: 1024 * 1024,
    M: 1024 * 1024,
    GB: 1024 * 1024 * 1024,
    GIB: 1024 * 1024 * 1024,
    G: 1024 * 1024 * 1024,
    TB: 1024 * 1024 * 1024 * 1024,
    TIB: 1024 * 1024 * 1024 * 1024,
    T: 1024 * 1024 * 1024 * 1024,
};
function mb(value) {
    return value * 1024 * 1024;
}
function tryParseToBytes(text) {
    if (!text) {
        return null;
    }
    const input = text.trim();
    if (!input) {
        return null;
    }
    if (/^\d+$/.test(input)) {
        return Number(input);
    }
    const match = input.match(/^\s*(\d+(?:\.\d+)?)\s*(B|KB|MB|GB|TB|KIB|MIB|GIB|TIB|K|M|G|T)\s*$/i);
    if (!match) {
        return null;
    }
    const value = Number(match[1]);
    if (Number.isNaN(value) || value < 0) {
        return null;
    }
    const unit = match[2].toUpperCase();
    const multiplier = unitMap[unit];
    if (!multiplier) {
        return null;
    }
    return Math.floor(value * multiplier);
}
