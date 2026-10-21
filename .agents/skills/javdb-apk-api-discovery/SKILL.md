---
name: javdb-apk-api-discovery
description: "从 JavDB 官方 Flutter APK 解出当前 App API 站点与加密配置。Use when: 解析 jdb_official APK、查找 apidd/baseUrl/apiUrls、解密 data.txt/ds_store、核对 JavDB App API 域名是否过期、区分 Cloudflare 网页站与 App API。"
argument-hint: "[apk路径] [可选: data.txt或ds_store]"
---

# JavDB APK API Discovery

从官方 JavDB Android APK（Flutter / `astarte`）提取当前 App API 站点，并验证是否仍与运行时配置一致。

## When to Use

- 需要确认“现在的 API 站点在哪”
- `apidd.btyjscl.com` / 旧备站疑似失效，要对照 APK 内置配置
- 需要解密 `assets/data/data.txt` 或远程 `ds_store`
- 排查 CLI `JavDB App API request failed: fetch failed` 前，先核对目标域名是否正确

## Expected Outcome

产出一份结构化结论，并在发现差异时落到可配置值：

1. APK 内置 `apiUrls` / `backupUrls` / CDN / Web 域名
2. 远程备份配置是否与内置一致（**远程优先**）
3. 本机探测结果：DNS、TLS、HTTP（只做可达性判断，不做 Cloudflare 绕过）
4. 与仓库可配置默认值对比；不一致则**及时修改**客户端 / worker / 文档中的 `apiUrls` 默认值

## Procedure

### 1. 准备输入

默认 APK：

```bash
APK="${1:-jdb_official_v1.9.35.apk}"
WORKDIR="${TMPDIR:-/tmp}/javdb-apk-discovery"
mkdir -p "$WORKDIR"
unzip -qo "$APK" -d "$WORKDIR/apk" \
  'assets/flutter_assets/assets/data/data.txt' \
  'lib/arm64-v8a/libapp.so' \
  'lib/arm64-v8a/libsecurity.so' \
  'assets/config.properties.default'
```

关键文件：

| 路径 | 作用 |
|------|------|
| `assets/flutter_assets/assets/data/data.txt` | AES 加密的站点配置 |
| `lib/arm64-v8a/libapp.so` | Dart AOT；含 API path、加密常量、少量明文 URL |
| `lib/arm64-v8a/libsecurity.so` | native 签名/加解密辅助 |
| 远程 `backupUrls` 中的 `ds_store` | 与 `data.txt` 同格式的可更新配置 |

### 2. 快速扫字符串

先确认 APK 是否仍把域名藏在加密配置里，而不是明文硬编码：

```bash
strings -n 6 "$WORKDIR/apk/lib/arm64-v8a/libapp.so" \
  | grep -Ei 'https?://|/api/v[0-9]|baseUrl|key_baseurl|jdsignature|data\.txt|javdb|letidi|jdforrepam|apidd|btyjscl|cmastd' \
  | sort -u
```

判定：

- 看到大量 `/api/v1|v2|v4/...`，但几乎看不到 `apidd.*` 明文 → 正常，继续解密 `data.txt`
- 若重新出现明文 `https://apidd...` → 记录为硬编码回退源，仍以 `data.txt` / 远程备份为准

### 3. 解密内置配置

使用本 skill 脚本：

```bash
python3 .github/skills/javdb-apk-api-discovery/scripts/decrypt-data-txt.py \
  "$WORKDIR/apk/assets/flutter_assets/assets/data/data.txt"
```

也可直接解远程备份：

```bash
python3 .github/skills/javdb-apk-api-discovery/scripts/decrypt-data-txt.py \
  --url 'https://app-1392310394.cos.ap-guangzhou.myqcloud.com/ds_store'
```

成功标准：输出可解析 JSON，至少包含：

- `apiUrls`：App API 主/备
- `backupUrls`：加密配置备份
- `imageEndpoint`：图片 CDN
- Web/App 入口域名字段（`unblockedWebDomain` / `permanentWebDomain` / ...）

详细密钥与字段说明见 [known-facts.md](./references/known-facts.md)。

### 4. 对照远程备份

1. 读取本地 JSON 的 `backupUrls`
2. 下载并解密每一项
3. 比较与 APK 内置配置的差异

优先级：

1. **远程 `backupUrls` 最新内容**（可热更新；曾出现主站从 `apidd.btyjscl.com` 换成 `apidd.spthgb.com`）
2. **APK 内置 `data.txt`**（打包时快照，可能落后远程）
3. 仓库文档 / 代码默认值（可能过期）

### 5. 探测可达性（不做绕过）

对 `apiUrls` 做最小探测：

```bash
# 例：签名请求 /api/v1/movies/latest
# jdsignature 算法见 references/known-facts.md
```

记录三类结果即可：

| 现象 | 结论 |
|------|------|
| HTTP 200 + JSON `success` | API 可用 |
| 完成 TLS 后出现 `cf-ray` / 403 / challenge HTML | Cloudflare 网页防护；按仓库约定可停止探索绕过 |
| `fetch failed` / `ECONNREFUSED` / TLS `UNEXPECTED_EOF` / fake-ip `28.0.2.x` | 本地网络/代理/Worker 问题，或域名侧直接掐握手；**不是**挑战页拦截 |

### 6. 对照仓库可配置值并及时修改

把远程 `apiUrls` 视为当前权威可配置值，与仓库默认值对比：

| 位置 | 当前字段 / 常量 |
|------|-----------------|
| `apps/client/src/data/javdb.ts` | `DefaultAppApiBaseUrl` / `FallbackAppApiBaseUrl` / `isDirectAppApiBase()` |
| `apps/backend-worker/src/index.ts` | `JAVDB_APP_API_HOST_PRIMARY` / `JAVDB_APP_API_HOST_FALLBACK` |
| `doc/javdb-app-api/README.md` | API 域名表 |
| `README.md` | `JavDb.BaseUrl` 默认值说明 |
| 本 skill `references/known-facts.md` | 站点快照 |

规则：

1. **权威顺序**：远程 `backupUrls` > APK `data.txt` > 仓库默认值
2. `apiUrls[0]` → 主站可配置默认值；其余项 → 备站 / mirror 可配置默认值
3. 发现不一致：**及时修改**上表中的可配置默认值与文档，不要只停留在报告
4. 同步更新“直连官方 API host”判断列表（例如 `isDirectAppApiBase`），避免新域名被误当成 backend proxy path
5. 修改后跑相关测试 / 类型检查；本 skill 负责发现与改点，不把 Cloudflare 绕过纳入范围

### 7. 输出结论模板

```markdown
## JavDB API Discovery Result
- APK: <path/version>
- Source of truth: <remote ds_store | apk data.txt>
- apiUrls:
  - <primary>
  - <fallback...>
- backupUrls: <...>
- imageEndpoint: <...>
- Reachability:
  - <host>: <ok|tls-reset|dns-fake-ip|http-status>
- Repo sync:
  - remote vs client defaults: <same|updated>
  - remote vs worker defaults: <same|updated>
  - docs/skill snapshot: <same|updated>
  - files changed: <paths>
```

## Decision Rules

1. **找站点**优先解密配置，不优先逆向全部 Dart 控制流。
2. `javdb.com` / `javdbNNN.com` 是 Web 入口；App JSON API 看 `apiUrls`。
3. 本机 TLS 在 ClientHello 后直接 EOF，且无证书/无 `cf-ray` → 不要当成 Cloudflare 挑战。
4. 本地 `JavBackend.BaseUrl` 指向 `127.0.0.1:8788` 但 Worker 未启动时，会先 `ECONNREFUSED`，再回落官方 API。
5. `apiUrls` 是可配置值；远程与仓库默认值不一致时，**及时修改**客户端、worker、文档中的对应默认值。

## Bundled Resources

- [decrypt-data-txt.py](./scripts/decrypt-data-txt.py)：解密 `data.txt` / `ds_store`
- [known-facts.md](./references/known-facts.md)：密钥、域名、签名算法、历史结论

## Completion Checklist

- [ ] 已解出并可解析 `apiUrls`
- [ ] 已核对远程 `backupUrls`（若可下载），并以远程为权威
- [ ] 已区分 App API / Web / CDN
- [ ] 已记录本机可达性，且未把 TLS 重置误判为 Cloudflare 挑战
- [ ] 已对比仓库可配置默认值；不一致时已修改 client / worker / 文档 / skill 快照
