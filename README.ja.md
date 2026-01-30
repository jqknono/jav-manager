# JavManager

コマンドラインツールで、JAVコンテンツの自動管理、高速なリピート検索、トレント検索、qBittorrent統合機能を提供します。

[中文](README.zh-CN.md) | [日本語](README.ja.md) | [한국어](README.ko.md)

> **注意:** Everything（ローカル検索）とqBittorrent（ダウンロード）はオプションの統合機能です。これらがなくてもJavManagerは動作します（JavDBの検索とマグネットリンクの出力は可能です）。HTTP APIをサポートする他のツール（他の検索エンジンやダウンロードクライアントなど）が必要な場合は、[Issueを作成してください](../../issues/new)。

## 機能

- JavDBからJAVのメタデータとマグネットリンクを検索
- 高速検索
- Everything検索エンジンによるローカルファイルの確認
- qBittorrent WebUI API経由でのダウンロード
- 重みベースのランキングによるスマートなトレント選択

## ワークフロー

```mermaid
flowchart TD
    A[JAV IDの入力] --> B{データは利用可能?}
    B -->|はい| C[既存のメタデータを使用]
    B -->|いいえ| D[JavDBから取得]
    C --> E[トレントをランク付け]
    D --> E
    E --> F[ローカルファイルは存在する?]
    F -->|はい| G[オプションを表示]
    F -->|いいえ| H[ダウンローダーに追加]
    G --> H
    H --> I[完了]

    classDef primary fill:#2563eb,stroke:#1d4ed8,color:#ffffff;
    classDef decision fill:#f59e0b,stroke:#d97706,color:#111827;
    classDef neutral fill:#ffffff,stroke:#e5e7eb,color:#1f2937;

    class A,H,I primary;
    class B,F decision;
    class C,D,E,G neutral;
```

## 外部依存関係

| サービス | 必須 | 目的 | リンク |
|---------|----------|---------|------|
| JavDB | はい | メタデータとマグネットリンク | [javdb.com](https://javdb.com/) |
| Everything | いいえ（オプション） | ローカルファイル検索 | [voidtools.com](https://www.voidtools.com/everything-1.5a/) ([HTTPプラグイン](https://www.voidtools.com/forum/viewtopic.php?f=12&t=9799)) |
| qBittorrent | いいえ（オプション） | トレントダウンロード | [qBittorrent](https://github.com/qbittorrent/qBittorrent) |

### Cloudflare 403問題

JavDBがHTTP 403を返す場合、Cloudflareのチャレンジが原因である可能性が高いです。JavManagerは**デフォルトでcurl-impersonateを使用して**、実際のブラウザのTLS/HTTP2フィンガープリントを模倣します（ブラウザ自動化は行いません）。それでも403が表示される場合は、別のミラーURLを試すか、IPがブロックされていないか確認してください（`doc/CloudflareBypass.md`を参照）。

## 設定

すべての設定は`JavManager/appsettings.json`で構成されます（ローカル上書きには`appsettings.Development.json`を使用）。環境変数による上書きはサポートされていません。

設定リファレンス:

| セクション | キー | 必須 | デフォルト | 説明 |
|---------|-----|----------|---------|-------------|
| Everything | `BaseUrl` | いいえ（オプション） | `http://localhost` | Everything HTTPサーバーのベースURL（スキームとホストを含む）。利用できない場合、ローカルの重複排除がスキップされます。 |
| Everything | `UserName` | いいえ（オプション） | _(空)_ | Basic認証のユーザー名。 |
| Everything | `Password` | いいえ（オプション） | _(空)_ | Basic認証のパスワード。 |
| QBittorrent | `BaseUrl` | いいえ（オプション） | `http://localhost:8080` | qBittorrent WebUIのベースURL（必要に応じてポートを含む）。利用できない/認証に失敗した場合、JavManagerはマグネットリンクを表示するだけでダウンロードキューには追加しません。 |
| QBittorrent | `UserName` | いいえ（オプション） | `admin` | WebUIのユーザー名。 |
| QBittorrent | `Password` | いいえ（オプション） | _(空)_ | WebUIのパスワード。 |
| JavDb | `BaseUrl` | はい | `https://javdb.com` | プライマリJavDBのベースURL。 |
| JavDb | `MirrorUrls` | いいえ（オプション） | `[]` | 追加のミラーURL（配列）。 |
| JavDb | `RequestTimeout` | いいえ（オプション） | `30000` | リクエストタイムアウト（ミリ秒）。 |
| JavDb | `UserAgent` | いいえ（オプション） | _(空)_ | カスタムUser-Agent文字列（HttpClientフォールバックモードでのみ使用）。 |
| JavDb | `CurlImpersonate:Enabled` | いいえ（オプション） | `true` | JavDBリクエストでcurl-impersonateを有効にする（推奨）。 |
| JavDb | `CurlImpersonate:Target` | いいえ（オプション） | `chrome116` | `curl_easy_impersonate()`の偽装ターゲット名（例: `chrome116`）。 |
| JavDb | `CurlImpersonate:LibraryPath` | いいえ（オプション） | _(空)_ | `libcurl.dll`へのオプションの明示的なパス（自動検出されない場合）。 |
| JavDb | `CurlImpersonate:CaBundlePath` | いいえ（オプション） | _(空)_ | `cacert.pem`へのオプションのパス（自動検出されない場合）。 |
| JavDb | `CurlImpersonate:DefaultHeaders` | いいえ（オプション） | `true` | curl-impersonateの組み込みデフォルトHTTPヘッダーを使用する。 |
| Download | `DefaultSavePath` | いいえ（オプション） | _(空)_ | qBittorrentにトレントを追加するときのデフォルト保存パス。 |
| Download | `DefaultCategory` | いいえ（オプション） | `jav` | qBittorrentのデフォルトカテゴリ。 |
| Download | `DefaultTags` | いいえ（オプション） | `auto-download` | 作成されたダウンロードのデフォルトタグ。 |
| LocalCache | `Enabled` | いいえ（オプション） | `true` | ローカルキャッシュストレージを有効または無効にする。 |
| LocalCache | `DatabasePath` | いいえ（オプション） | _(空)_ | JSONキャッシュファイルのパス（空のままにすると実行ファイルの隣のデフォルトの`jav_cache.json`が使用される）。 |
| LocalCache | `CacheExpirationDays` | いいえ（オプション） | `0` | キャッシュのTTL（日数）（0は期限切れを無効にする）。 |
| Console | `Language` | いいえ（オプション） | `en` | UI言語（`en`、`zh`、または`auto`）。 |
| Console | `HideOtherTorrents` | いいえ（オプション） | `true` | リスト内の一致しないトレントを非表示にする。 |
| Telemetry | `Enabled` | いいえ（オプション） | `true` | 匿名テレメトリを有効または無効にする。 |
| Telemetry | `Endpoint` | いいえ（オプション） | _(空)_ | テレメトリエンドポイントURL（空のままにするとデフォルトが使用される）。 |
| JavInfoSync | `Enabled` | いいえ（オプション） | `false` | JavInfo同期を有効または無効にする。 |
| JavInfoSync | `Endpoint` | 有効時 | _(空)_ | JavInfo同期エンドポイントURL。 |
| JavInfoSync | `ApiKey` | いいえ（オプション） | _(空)_ | オプションのAPIキー（`X-API-Key`経由で送信）。 |

## 使用方法

```bash
# 対話モード
dotnet run --project JavManager/JavManager.csproj

# 直接検索
dotnet run --project JavManager/JavManager.csproj -- STARS-001

# ヘルプを表示
dotnet run --project JavManager/JavManager.csproj -- help

# バージョンを表示
dotnet run --project JavManager/JavManager.csproj -- version
```

**対話コマンド:**

| コマンド | 説明 |
|---------|-------------|
| `<code>` | JAVコードで検索（例: `STARS-001`） |
| `r <code>` | 検索をリフレッシュ |
| `c` | 保存されたデータ統計を表示 |
| `h` | ヘルプを表示 |
| `q` | 終了 |

## ビルドとパッケージ化

```bash
# ビルド
dotnet build JavManager/JavManager.csproj

# テストを実行
dotnet test JavManager.Tests/JavManager.Tests.csproj

# パッケージ化（Windowsスタンドアロンzip）
pwsh scripts/package.ps1

# PATHにインストール（Windows）
pwsh scripts/install-windows.ps1 -AddToPath
```