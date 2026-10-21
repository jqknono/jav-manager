# 字幕搜索

CLI 通过 `sub <JAV-ID>` 聚合外挂字幕。

## 命令

```bash
npx jav-manager sub STARS-001
```

交互模式也支持 `sub` / `subtitle` / `zimu` / `zm`。

非交互模式会选择排序后的第一条结果，并按 `Subtitle.PreferredLanguages` 下载现成 `.srt`。

## 数据源

- **SubtitleCat**：用标准番号搜索，解析详情页上已经生成的语言文件（优先简体/繁体中文），直接下载 `.srt`。
- **垂直字幕索引站**：默认包含 JavSubtitled、Javzimu。按番号抓取页面中的字幕链接。站点不可达（例如 Cloudflare 403）时跳过，不影响其他源。

## 保存位置

优先使用 `Subtitle.SavePath`；未配置时回退到 `Download.DefaultSavePath`；再未配置则写入配置目录下的 `subtitles/`。
