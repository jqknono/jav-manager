"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.LocalizationService = void 0;
const strings = {
    en: {
        app_name: "JavManager",
        help_title: "Commands",
        help_search: "search <javId>   Search and download",
        help_local: "local <query>    Search local files",
        help_remote: "remote <javId>   Search JavDB only",
        help_cache: "cache            Show cache stats",
        help_downloads: "downloads        List torrents",
        help_downloading: "downloading      List active downloads",
        help_health: "health           Check service health",
        help_lang: "lang <en|zh>     Switch language",
        help_version: "version          Show version",
        help_help: "help             Show help",
        help_quit: "quit             Exit interactive mode",
        help_config: "cfg show|set     View or change config (session)",
        help_test_curl: "--test-curl       JavDB curl-impersonate diagnostic",
        prompt_input: "Input command or JAV ID",
        invalid_jav_id: "Invalid JAV ID: {0}",
        searching: "Searching: {0}",
        no_search_results: "No search results",
        no_torrents_found: "No torrents found",
        local_files_found: "Local files found",
        download_added: "Download task added",
        download_failed: "Failed to add to downloader, magnet link:",
        downloader_unavailable: "Downloader unavailable, magnet link:",
        cache_disabled: "Cache is disabled",
        cache_stats: "Cache: {0} items, {1} torrents, {2} bytes",
        health_ok: "OK",
        health_fail: "Failed",
        gui_title: "JavManager",
        gui_nav_search: "Search",
        gui_nav_downloads: "Downloads",
        gui_nav_settings: "Settings",
        gui_section_local_files: "Local Files",
        gui_section_torrents: "Torrents",
        gui_search_button: "Search",
        gui_download_button: "Download",
        gui_status_ready: "Ready",
        gui_status_searching: "Searching...",
        gui_status_download_added: "Download task added",
        gui_status_download_failed: "Download failed",
        gui_settings_save: "Save Settings",
        gui_settings_saved: "Settings saved",
        config_updated: "Config updated",
        usage_config: "Usage: cfg show | cfg set [service] [key] [value] | cfg <service> <key> <value>",
    },
    zh: {
        app_name: "JavManager",
        help_title: "命令",
        help_search: "search <番号>   搜索并下载",
        help_local: "local <关键字>  本地文件搜索",
        help_remote: "remote <番号>   仅远端搜索",
        help_cache: "cache           缓存统计",
        help_downloads: "downloads       下载列表",
        help_downloading: "downloading     下载中列表",
        help_health: "health          健康检查",
        help_lang: "lang <en|zh>    切换语言",
        help_version: "version         版本信息",
        help_help: "help            帮助",
        help_quit: "quit            退出交互",
        prompt_input: "输入命令或番号",
        invalid_jav_id: "番号格式无效: {0}",
        searching: "正在搜索: {0}",
        no_search_results: "无搜索结果",
        no_torrents_found: "未找到种子",
        local_files_found: "发现本地文件",
        download_added: "已添加下载任务",
        download_failed: "加入下载器失败，磁力链接：",
        downloader_unavailable: "下载器不可用，磁力链接：",
        cache_disabled: "缓存已禁用",
        cache_stats: "缓存：{0} 条，{1} 个种子，{2} 字节",
        health_ok: "正常",
        health_fail: "异常",
        gui_title: "JavManager",
        gui_nav_search: "搜索",
        gui_nav_downloads: "下载",
        gui_nav_settings: "设置",
        gui_section_local_files: "本地文件",
        gui_section_torrents: "种子",
        gui_search_button: "搜索",
        gui_download_button: "下载",
        gui_status_ready: "就绪",
        gui_status_searching: "正在搜索...",
        gui_status_download_added: "已添加下载任务",
        gui_status_download_failed: "下载失败",
        gui_settings_save: "保存设置",
        gui_settings_saved: "设置已保存",
        usage_config: "用法: cfg show | cfg set [service] [key] [value] | cfg <service> <key> <value>",
    },
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
