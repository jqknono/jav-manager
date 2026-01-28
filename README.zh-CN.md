# JavManager

用于自动化 JAV 内容管理的命令行工具，支持本地缓存、种子搜索和 qBittorrent 集成。

[English](README.md) | [日本語](README.ja.md) | [한국어](README.ko.md)

> **注意：** 目前支持 Everything（本地搜索）和 qBittorrent（下载）。如需支持其他具有 HTTP API 的工具（如其他搜索引擎或下载客户端），请[创建 issue](../../issues/new)。

## 功能特性

- 从 JavDB 搜索 JAV 元数据和磁力链接
- 本地缓存，加速重复搜索
- 通过 Everything 搜索引擎检查本地文件
- 通过 qBittorrent WebUI API 下载
- 基于权重排序的智能种子选择

## 外部依赖

| 服务 | 用途 | 链接 |
|------|------|------|
| Everything | 本地文件搜索 | [voidtools.com](https://www.voidtools.com/everything-1.5a/) ([HTTP 插件](https://www.voidtools.com/forum/viewtopic.php?f=12&t=9799)) |
| JavDB | 元数据和磁力链接 | [javdb.com](https://javdb.com/) |
| qBittorrent | 种子下载 | [qBittorrent](https://github.com/qbittorrent/qBittorrent) |

### Cloudflare 403 问题

如果 JavDB 返回 HTTP 403，通常是 Cloudflare 挑战导致的。JavManager 内部使用 Chrome 风格请求并会反复重试，不依赖第三方工具。如果仍然出现 403，请在配置中提供浏览器获取的 `cf_clearance` 和对应的 `UserAgent`（参见 `doc/CloudflareBypass.md`）。

## 使用方法

```bash
# 交互模式
dotnet run --project JavManager/JavManager.csproj

# 直接搜索
dotnet run --project JavManager/JavManager.csproj -- STARS-001

# 显示帮助
dotnet run --project JavManager/JavManager.csproj -- help

# 显示版本
dotnet run --project JavManager/JavManager.csproj -- version
```

**交互命令：**

| 命令 | 说明 |
|------|------|
| `<番号>` | 按番号搜索（如 `STARS-001`） |
| `r <番号>` | 刷新搜索（跳过缓存） |
| `c` | 显示缓存统计 |
| `h` | 显示帮助 |
| `q` | 退出 |

## 构建与打包

```bash
# 构建
dotnet build JavManager/JavManager.csproj

# 运行测试
dotnet test JavManager.Tests/JavManager.Tests.csproj

# 打包（Windows 独立 zip）
pwsh scripts/package.ps1

# 安装到 PATH（Windows）
pwsh scripts/install-windows.ps1 -AddToPath
```
