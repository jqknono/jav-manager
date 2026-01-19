# JavManager

## 外部服务依赖

- local search engine
  - https://www.voidtools.com/everything-1.5a/
  - https://www.voidtools.com/support/everything/http/
- remote db
  - https://javdb.com/
- torrent client
  - https://github.com/qbittorrent/qBittorrent 或 https://github.com/c0re100/qBittorrent-Enhanced-Edition
  - https://github.com/qbittorrent/qBittorrent/wiki/WebUI-API-(qBittorrent-5.0)#api-v2113

## JavDB Cookies 说明

JavDB 搜索 API 需要特定的 Cookie 才能正常工作。

### 必需的 Cookie

| Cookie 名称 | 值 | 说明 |
|------------|-----|------|
| `over18` | `1` | **必需**。年龄验证 cookie，不设置此 cookie 会显示年龄验证弹窗，无法获取搜索结果 |

### 可选的 Cookie

| Cookie 名称 | 值 | 说明 |
|------------|-----|------|
| `locale` | `zh` / `en` | 语言设置，`zh` 为繁体中文，`en` 为英文 |
| `theme` | `auto` / `light` / `dark` | 主题设置 |
| `list_mode` | `h` | 列表显示模式 |

### 示例请求

```bash
curl "https://javdb.com/search?q=STARS-001&f=all" \
  -H "User-Agent: Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36" \
  -H "Cookie: over18=1"
```

### 测试验证 (2026-01-18)

| 页面 | 不带 cookie | 带 `over18=1` cookie |
|------|-------------|---------------------|
| 搜索页 `/search?q=XXX` | HTML 包含搜索结果 + 年龄验证弹窗 | 正常显示搜索结果 |
| 详情页 `/v/XXX` | HTML 包含磁力链接 + 年龄验证弹窗 | 正常显示磁力链接 |

**结论**：
- 技术上，即使不带 cookie，搜索结果和磁力链接数据也会在 HTML 中返回
- 但前端会显示 `over18-modal` 弹窗遮挡内容
- **建议**：始终设置 `over18=1` cookie，避免潜在的网站行为变更风险