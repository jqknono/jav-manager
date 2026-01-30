# JavManager 项目指南

## 项目概述

JavManager 是一个 C# .NET 8.0 应用程序，用于自动化 JAV 内容管理。支持 **GUI** 和 **控制台** 两种运行模式。

**核心工作流程**:
1. 输入番号 (如 XXX-123)
2. 优先从本地 SQLite 缓存查找
3. 未命中则从 JavDB 爬取种子链接并缓存
4. 按权重排序选择最佳片源
5. 使用 Everything 检查本地文件
6. 通过 qBittorrent 下载

---

## 构建与运行

```bash
# 构建项目
cd f:\code\jav-manager\JavManager
dotnet build

# 运行项目 (默认 GUI 模式)
dotnet run

# 控制台模式
dotnet run -- --no-gui

# 直接搜索 (控制台模式)
dotnet run -- STARS-001
```

### 运行模式

- **GUI 模式** (默认): 直接运行 `dotnet run` 或双击可执行文件
- **控制台模式**: 使用 `--no-gui` 或 `-c` 参数，或直接传入番号参数

---

## 项目架构

### 分层架构

```
Core/                  # 核心层：模型、接口、配置
├── Models/           # 数据模型 (TorrentInfo, JavSearchResult, LocalFileInfo)
├── Interfaces/       # 服务接口定义
└── Configuration/    # 配置类 (appsettings.json 绑定)

DataProviders/        # 数据访问层：外部服务客户端
├── JavDb/           # JavDB HTTP 爬虫 (HtmlAgilityPack)
├── Everything/      # Everything HTTP API 客户端
├── QBittorrent/     # qBittorrent WebUI API 客户端
└── LocalCache/      # SQLite 本地缓存 (EF Core)

Services/            # 业务逻辑层
├── JavSearchService/          # 主业务编排
├── TorrentSelectionService/   # 种子权重排序
├── LocalFileCheckService/     # 本地文件检查
└── DownloadService/           # 下载编排

ConsoleUI/           # 表示层：控制台交互
├── UserInputHandler/  # 用户输入处理
└── DisplayService/   # 格式化输出

Gui/                 # 表示层：图形界面 (Avalonia)
├── Views/           # AXAML 视图
├── ViewModels/      # MVVM ViewModels
└── App.axaml        # Avalonia 应用入口

Utils/              # 工具类
├── WeightCalculator/   # 权重计算
├── TorrentNameParser/  # 种子名称解析
└── HttpHelper/        # HTTP 辅助
```

---

## 外部服务依赖

### 1. Everything (本地文件搜索)
- **版本**: 1.5a+
- **用途**: 下载前检查本地是否已存在文件
- **配置**: `appsettings.json` -> `Everything`
- **认证**: 支持 Basic Auth

### 2. JavDB (远程数据库)
- **用途**: 爬取种子磁力链接
- **实现**: 纯 HTTP 客户端 + HtmlAgilityPack
- **重要**: **禁止使用 Playwright**，仅允许 HTTP API
- **配置**: `appsettings.json` -> `JavDb`

### 3. qBittorrent (下载器)
- **版本**: WebUI API v2.11.3+
- **位置**: 远程服务器
- **认证**: 用户名密码 (SID Cookie)
- **配置**: `appsettings.json` -> `QBittorrent`

---

## 权重算法

### 种子优先级规则

| 标记 | 权重 |
|------|------|
| 无码标记 (-UC) | 1200 (1000 + 200) |
| 无码标记 (-U)  | 1100 (1000 + 100) |
| 无码标记 (-C)  | 1050 (1000 + 50) |
| 字幕标记       | 500 |

**注意**: HTTP 爬虫无法获取文件大小和做种人数，因此权重仅基于标题标记。

---

## 关键接口

### IJavDbDataProvider
```csharp
// JavDB 数据提供者接口
Task<JavSearchResult> SearchAsync(string javId);
Task<JavSearchResult> GetDetailAsync(string detailUrl);
```

### IEverythingSearchProvider
```csharp
// Everything 本地搜索接口
Task<List<LocalFileInfo>> SearchAsync(string searchTerm);
```

### IQBittorrentClient
```csharp
// qBittorrent API 接口
Task<bool> LoginAsync();
Task<bool> AddTorrentAsync(string magnetLink, string? savePath, ...);
```

### IJavLocalCacheProvider
```csharp
// 本地缓存接口
Task<JavSearchResult?> GetAsync(string javId);
Task SaveAsync(JavSearchResult result);
Task<bool> ExistsAsync(string javId);
Task<CacheStatistics> GetStatisticsAsync();
```

---

## 配置文件

所有配置位于 `appsettings.json`:

```json
{
  "Everything": {
    "BaseUrl": "http://everything.jqknono.com",
    "Port": null,
    "UserName": null,
    "Password": null
  },
  "QBittorrent": {
    "BaseUrl": "http://qbittorrent.jqknono.com/",
    "UserName": "admin",
    "Password": "your_password",
    "UseSsl": false
  },
  "JavDb": {
    "BaseUrl": "https://javdb.com",
    "MirrorUrls": ["https://javdb565.com", "https://javdb564.com"],
    "RequestTimeout": 30000
  },
  "Download": {
    "DefaultSavePath": "/downloads/jav",
    "DefaultCategory": "jav",
    "DefaultTags": "auto-download",
    "PausedOnStart": false
  },
  "LocalCache": {
    "Enabled": true,
    "DatabasePath": "",
    "CacheExpirationDays": 0
  },
  "Weights": {
    "UncensoredWeight": 1000.0,
    "SubtitleWeight": 500.0
  }
}
```

---

## 依赖项

```xml
<!-- 核心 -->
<PackageReference Include="Microsoft.Extensions.Hosting" Version="8.0.0" />
<PackageReference Include="Microsoft.Data.Sqlite" Version="10.0.2" />
<PackageReference Include="HtmlAgilityPack" Version="1.12.1" />
<PackageReference Include="Newtonsoft.Json" Version="13.0.3" />
<PackageReference Include="Spectre.Console" Version="0.50.0" />

<!-- GUI (Avalonia) -->
<PackageReference Include="Avalonia" Version="11.2.3" />
<PackageReference Include="Avalonia.Desktop" Version="11.2.3" />
<PackageReference Include="Avalonia.Themes.Fluent" Version="11.2.3" />
<PackageReference Include="CommunityToolkit.Mvvm" Version="8.4.0" />
```

**已移除**: Microsoft.Playwright (用户要求仅使用 API)

---

## 重要约束

1. **禁止使用 Playwright**: 仅允许 HTTP API 和 HtmlAgilityPack 进行网页爬取
2. **仅磁力链接**: 不获取种子详细信息 (大小、做种数等)
3. **权重简化**: 由于 HTTP 爬虫限制，权重仅基于标题标记 (-UC/-U/-C 和字幕)

---

## 扩展指南

### 添加新的数据源
实现 `IJavDbDataProvider` 接口，注册到 DI 容器:
```csharp
services.AddSingleton<IJavDbDataProvider, JavDbWebScraper>();
```

### 修改权重算法
修改 `Utils/WeightCalculator.cs` 和 `appsettings.json` 中的 `Weights` 配置。

### 添加新的本地搜索引擎
实现 `IEverythingSearchProvider` 接口，替换 EverythingHttpClient。

---

## 本地缓存数据库

### 数据库结构

SQLite 数据库位于应用目录下 `jav_cache.db`（可通过配置修改路径）。

**表结构**:
- `JavInfo`: 番号基本信息（番号、标题、发布日期、导演、制作商、系列等）
- `JavActors`: 演员关联表
- `JavCategories`: 类别关联表  
- `Torrents`: 种子信息表（磁力链接、大小、标记等）

### 缓存策略

1. **搜索优先级**: 本地缓存 -> 远端 JavDB
2. **自动缓存**: 远端搜索结果自动保存到本地
3. **强制刷新**: 使用 `r <番号>` 命令可跳过缓存直接从远端搜索
4. **缓存统计**: 使用 `c` 命令查看缓存统计信息

### 缓存的数据

- 番号基本信息（标题、发布日期、时长）
- 演员列表
- 类别/标签列表
- 制作商、发行商、系列、导演
- 所有种子的详细信息（磁力链接、标记等）
