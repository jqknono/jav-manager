# JavManager

A command-line tool for automated JAV content management with local caching, torrent search, and qBittorrent integration.

[中文](README.zh-CN.md) | [日本語](README.ja.md) | [한국어](README.ko.md)

> **Note:** Currently supports Everything (local search) and qBittorrent (download). If you need support for other tools with HTTP API (e.g., other search engines or download clients), please [create an issue](../../issues/new).

## Features

- Search JAV metadata and magnet links from JavDB
- Local caching for faster repeated searches
- Check local files via Everything search engine
- Download via qBittorrent WebUI API
- Smart torrent selection with weight-based ranking

## External Dependencies

| Service | Purpose | Link |
|---------|---------|------|
| Everything | Local file search | [voidtools.com](https://www.voidtools.com/everything-1.5a/) ([HTTP plugin](https://www.voidtools.com/forum/viewtopic.php?f=12&t=9799)) |
| JavDB | Metadata & magnet links | [javdb.com](https://javdb.com/) |
| qBittorrent | Torrent download | [qBittorrent](https://github.com/qbittorrent/qBittorrent) |

## Usage

```bash
# Interactive mode
dotnet run --project JavManager/JavManager.csproj

# Direct search
dotnet run --project JavManager/JavManager.csproj -- STARS-001

# Show help
dotnet run --project JavManager/JavManager.csproj -- help

# Show version
dotnet run --project JavManager/JavManager.csproj -- version
```

**Interactive Commands:**

| Command | Description |
|---------|-------------|
| `<code>` | Search by JAV code (e.g., `STARS-001`) |
| `r <code>` | Refresh search (bypass cache) |
| `c` | Show cache statistics |
| `h` | Show help |
| `q` | Quit |

## Build & Package

```bash
# Build
dotnet build JavManager/JavManager.csproj

# Run tests
dotnet test JavManager.Tests/JavManager.Tests.csproj

# Package (Windows standalone zip)
pwsh scripts/package.ps1

# Install to PATH (Windows)
pwsh scripts/install-windows.ps1 -AddToPath
```
