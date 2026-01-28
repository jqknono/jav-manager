# JavManager

ローカルキャッシュ、トレント検索、qBittorrent統合を備えたJAVコンテンツ管理用コマンドラインツール。

[English](README.md) | [中文](README.zh-CN.md) | [한국어](README.ko.md)

> **注意：** 現在、Everything（ローカル検索）とqBittorrent（ダウンロード）をサポートしています。HTTP APIを持つ他のツール（他の検索エンジンやダウンロードクライアントなど）のサポートが必要な場合は、[issueを作成](../../issues/new)してください。

## 機能

- JavDBからJAVメタデータとマグネットリンクを検索
- ローカルキャッシュで繰り返し検索を高速化
- Everything検索エンジンでローカルファイルを確認
- qBittorrent WebUI APIでダウンロード
- 重み付けランキングによるスマートなトレント選択

## 外部依存

| サービス | 用途 | リンク |
|----------|------|--------|
| Everything | ローカルファイル検索 | [voidtools.com](https://www.voidtools.com/everything-1.5a/) ([HTTPプラグイン](https://www.voidtools.com/forum/viewtopic.php?f=12&t=9799)) |
| JavDB | メタデータとマグネットリンク | [javdb.com](https://javdb.com/) |
| qBittorrent | トレントダウンロード | [qBittorrent](https://github.com/qbittorrent/qBittorrent) |

## 使用方法

```bash
# インタラクティブモード
dotnet run --project JavManager/JavManager.csproj

# 直接検索
dotnet run --project JavManager/JavManager.csproj -- STARS-001

# ヘルプを表示
dotnet run --project JavManager/JavManager.csproj -- help

# バージョンを表示
dotnet run --project JavManager/JavManager.csproj -- version
```

**インタラクティブコマンド：**

| コマンド | 説明 |
|----------|------|
| `<品番>` | 品番で検索（例：`STARS-001`） |
| `r <品番>` | 検索を更新（キャッシュをバイパス） |
| `c` | キャッシュ統計を表示 |
| `h` | ヘルプを表示 |
| `q` | 終了 |

## ビルドとパッケージ

```bash
# ビルド
dotnet build JavManager/JavManager.csproj

# テストを実行
dotnet test JavManager.Tests/JavManager.Tests.csproj

# パッケージ（Windowsスタンドアロンzip）
pwsh scripts/package.ps1

# PATHにインストール（Windows）
pwsh scripts/install-windows.ps1 -AddToPath
```
