# JavDB APK Known Facts

来源：`jdb_official_v1.9.35.apk`（Flutter app 代号 `astarte`），仓库内分析文档见 `doc/javdb-app-api/README.md`。

## 加密站点配置

### 文件

- APK 内置：`assets/flutter_assets/assets/data/data.txt`
- 远程备份（v1.9.35 解出）：
  `https://app-1392310394.cos.ap-guangzhou.myqcloud.com/ds_store`

### 算法

```text
Base64Decode(input) = IV[16] || ciphertext
AES-128-CBC decrypt with key = "px0wbsdzxg7f6br9"
PKCS7 unpad
JSON object
```

### 密钥来源

`libapp.so` 内嵌 3 个 `Wz...` Base64(JSON int array) 常量，用 APK 证书 DER hex 前缀 `30820` 按既有 `getDecryptString` 算法解密：

| 明文 | 用途 |
|------|------|
| `71cf27bb3c0bcdf2...e3d8aa` | `jdsignature` secret |
| `lpw6vgqzsp` | `jdsignature` salt |
| `px0wbsdzxg7f6br9` | `data.txt` / `ds_store` AES key |

证书 DER 始终以 ASN.1 `30820...` 开头，因此该前缀可视为固定值。

## 站点快照

### APK 内置 `data.txt`（v1.9.35 打包时）

```json
{
  "apiUrls": [
    "https://apidd.btyjscl.com",
    "https://apidd.czssdgz.com"
  ],
  "backupUrls": [
    "https://app-1392310394.cos.ap-guangzhou.myqcloud.com/ds_store"
  ],
  "unblockedWebDomain": "https://javdb564.com",
  "permanentWebDomain": "https://javdb.com",
  "unblockAppDomain": "https://app.javdb564.com",
  "permanentAppDomain": "https://jav.app",
  "imageEndpoint": "https://tp.cmastd.com"
}
```

### 远程 `ds_store`（校验脚本时更新后的内容）

```json
{
  "apiUrls": [
    "https://apidd.spthgb.com",
    "https://apidd.czssdgz.com"
  ],
  "backupUrls": [
    "https://app-1392310394.cos.ap-guangzhou.myqcloud.com/ds_store"
  ],
  "unblockedWebDomain": "https://javdb573.com",
  "permanentWebDomain": "https://javdb.com",
  "unblockAppDomain": "https://app.javdb573.com",
  "permanentAppDomain": "https://jav.app",
  "imageEndpoint": "https://tp.cmastd.com"
}
```

说明：

- 远程备份可热更新；**以远程为准**，APK 内置只是打包时快照。
- 预览 CDN：`https://jdforrepam.com`（`libapp.so` 明文）
- 残留 staging：`https://staging.letidi.com`（不像主 API）
- 旧文档备站 `https://api.btyjscl.com` **未出现在**上述 `apiUrls`

## jdsignature

```text
timestamp = unix seconds
hash = md5(f"{timestamp}{secret}")
jdsignature = f"{timestamp}.{salt}.{hash}"
```

请求头至少包含：

```http
User-Agent: JavDB-App/1.0
Accept: application/json
jdsignature: <value>
```

常用探活：

```http
GET /api/v1/movies/latest
GET /api/v2/search?q=STARS-804&type=movie
```

## 字符串扫描预期

在 `libapp.so` 中通常能直接看到：

- 大量 `/api/v1/...`、`/api/v2/search`、`/api/v4/movies/%s`
- `baseUrl` / `key_baseurl` / `jdsignature` / `assets/data/data.txt`
- `https://jdforrepam.com`
- `https://staging.letidi.com`

通常**看不到**明文：

- `apidd.btyjscl.com`
- `apidd.czssdgz.com`
- `tp.cmastd.com`

这些来自加密配置。

## 可达性判定备忘

| 观察 | 含义 |
|------|------|
| DNS 到 `28.0.2.x` / `fc00::` | 本机 fake-ip / 透明代理痕迹 |
| TLS ClientHello 后 EOF，无证书、无 `cf-ray` | 握手被掐；不是 Cloudflare 挑战页 |
| HTTP 完成后有 `server: cloudflare` + `cf-ray` | Cloudflare 站点/防护 |
| `127.0.0.1:8788` `ECONNREFUSED` | 本地 backend worker 未启动 |

## 仓库映射提示

`apiUrls` 按可配置默认值维护；远程配置变化后及时同步：

| 文件 | 同步什么 |
|------|----------|
| `apps/client/src/data/javdb.ts` | `DefaultAppApiBaseUrl`、`FallbackAppApiBaseUrl`、`isDirectAppApiBase()` 主机白名单 |
| `apps/backend-worker/src/index.ts` | `JAVDB_APP_API_HOST_PRIMARY`、`JAVDB_APP_API_HOST_FALLBACK` |
| `doc/javdb-app-api/README.md` | API 域名表 |
| `README.md` | 配置默认值说明 |
| `.github/skills/javdb-apk-api-discovery/references/known-facts.md` | 本快照 |

其他：

- 运行时配置段：`JavBackend`（兼容旧名 `JavDb`）
- 直连官方 API 时 path 用 `/api/...`；指向 backend worker 时走 `/api/javdb/app/...`
