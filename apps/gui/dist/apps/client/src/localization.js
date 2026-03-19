"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.LocalizationService = void 0;
const en_json_1 = __importDefault(require("./localization/en.json"));
const zh_json_1 = __importDefault(require("./localization/zh.json"));
const ja_json_1 = __importDefault(require("./localization/ja.json"));
const ko_json_1 = __importDefault(require("./localization/ko.json"));
function sanitizeTable(input) {
    if (!input || typeof input !== "object")
        return {};
    const out = {};
    for (const [k, v] of Object.entries(input)) {
        if (typeof v === "string")
            out[k] = v;
    }
    return out;
}
const stringsEn = sanitizeTable(en_json_1.default);
const strings = {
    en: stringsEn,
    zh: { ...stringsEn, ...sanitizeTable(zh_json_1.default) },
    ja: { ...stringsEn, ...sanitizeTable(ja_json_1.default) },
    ko: { ...stringsEn, ...sanitizeTable(ko_json_1.default) },
};
class LocalizationService {
    locale;
    constructor(locale) {
        this.locale = locale;
    }
    get currentLocale() {
        return this.locale;
    }
    setLanguage(locale) {
        this.locale = locale;
    }
    get(key) {
        return strings[this.locale][key] ?? strings.en[key] ?? key;
    }
    getFormat(key, ...args) {
        const template = this.get(key);
        return args.reduce((acc, value, index) => acc.replace(`{${index}}`, String(value)), template);
    }
}
exports.LocalizationService = LocalizationService;
