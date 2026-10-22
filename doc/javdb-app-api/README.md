# JavDB App API 逆向分析

> 分析日期: 2026-03-18
> APK 版本: v1.9.35 (jdb_official_v1.9.35.apk)
> 来源: https://github.com/bdvajstudio/javdb/releases
> 状态: **已成功调用** ✅

## 概述

JavDB 官方 Android App (代号 `astarte`) 是一个 Flutter 应用，通过 `/api/v1/` 和 `/api/v2/`~`v4` REST JSON API 与后端通信。
所有 API 请求需要携带 `jdsignature` HTTP Header，签名算法已完全破解并可成功调用。

## API 域名

| 域名 | 用途 | 状态 |
|------|------|------|
| `apidd.spthgb.com` | App API 后端 (主) | 来自远程 `ds_store` 权威配置 |
| `apidd.czssdgz.com` | App API 后端 (备) | 来自远程 `ds_store` 权威配置 |
| `apidd.btyjscl.com` | App API 后端 (历史主站) | APK 内置快照；可能已过期 |
| `api.btyjscl.com` | App API 后端 (历史备站) | 旧文档值；当前远程配置未包含 |
| `tp.cmastd.com` | 图片 CDN (封面/缩略图/预览) | 活跃 |
| `jdforrepam.com` | 视频预览 CDN (m3u8) | 活跃 |

## 签名机制 (jdsignature) — 已破解

### 算法概述

```
jdsignature = "{timestamp}.{salt}.{md5(timestamp + secret)}"
```

其中:
- `timestamp` = 当前 Unix 时间戳 (秒)
- `salt` = 从 APK 内嵌常量解密得到的固定字符串
- `secret` = 从 APK 内嵌常量解密得到的固定密钥

### 解密流程

1. **获取 APK 签名密钥**: `key = "30820"` (APK 证书 DER 编码的 `toCharsString()` 前 5 字符)
2. **计算 MD5**: `md5Key = MD5(key)` → `"da97c8240e2ad99a2d331eed95c411f5"`
3. **解密 Base64 编码的常量** (两个):
   - 对每个常量: `base64Decode(b64String)` → JSON 整数数组
   - 对数组中每个元素: `charCode = intArray[i] - md5Key.codeUnitAt(min(i, 31))`
   - 将字符码拼成字符串后再 `base64Decode` 得到最终明文
4. **生成签名**:
   - `timestamp = floor(DateTime.now().microsecondsSinceEpoch / 1000000)`
   - `hash = MD5("{timestamp}{secret}")`
   - `jdsignature = "{timestamp}.{salt}.{hash}"`

### 解密后的常量

| 常量 | 值 |
|------|------|
| `secret` (str1) | `71cf27bb3c0bcdf207b64abecddc970098c7421ee7203b9cdae54478478a199e7d5a6e1a57691123c1a931c057842fb73ba3b3c83bcd69c17ccf174081e3d8aa` |
| `salt` (str2) | `lpw6vgqzsp` |

### Python 实现

```python
import hashlib, base64, json, time

KEY = "30820"
B64_SECRET = "WzE3OCwyMTksMTI3LDE2MSwxODksMTYyLDEyMywxMDMsMTM3LDIxMCwxMjMsMjE5LDE4OSwxNzksMTIzLDIwMiwxMzksMTUwLDEzMywxNjAsMTI2LDIwNywxNjYsMTUxLDE0NiwxNTksMTg4LDEwMCwxMzgsMTM2LDE3NiwxNjEsMTQyLDEwMywxMzUsMTYwLDE0MiwxNzUsMTYwLDEwNCwxMzAsMTIxLDExOCwxMDYsMTMyLDEyNCwxMzAsMTA0LDEzMSwxMjEsMTI2LDE3MywxNDMsMTQwLDEzOCwxMDQsMTMwLDE1OSwxMTgsMTc1LDE0MiwxNTksMTYxLDE1OSwxNDMsMTI0LDEyMywxNjEsMTMxLDEzNywxMzQsMTAxLDEzMSwxNzUsMTU2LDEwMSwxMzEsMTc1LDE1NywxNTcsMTMwLDEzNywxNjAsMTA2LDE0MywxMzcsMTUzLDE2MCwxMzEsMTQwLDEyMiwxMDMsMTQzLDEzNywxMjMsMTU3LDEzMSwxMzcsMTUyLDEwMywxMzIsMTM3LDEyMiwxNzMsMTMwLDE1OSwxMzEsMTU5LDEzMCwxNDAsMTIyLDEwNiwxMzAsMTc1LDEyMywxNTksMTMwLDEyMSwxMzgsMTA0LDEzMiwxMjEsMTM0LDE3NCwxNDMsMTYyLDEyNiwxMDQsMTMwLDEwMywxMjcsMTU3LDEzMCwxMDMsMTI2LDE3NSwxNDIsMTc1LDE1NiwxNzUsMTQyLDE2MiwxMzEsMTYwLDEzMSwxNTksMTYxLDE1OSwxMzAsMTM3LDE1MywxNTksMTQyLDEwMywxNDIsMTczLDEzMSwxNzUsMTM0LDE3MiwxMzIsMTIxLDEyMywxNjEsMTMwLDEwMywxMzQsMTA1LDE0MiwxNDAsMTIyLDExNF0="
B64_SALT = "WzE5OCwxNjksMTIzLDEwNiwxNzcsMTY2LDE0MCwxNjIsMTQ3LDE4OSwxNjIsMjE5LDE5OSwxMjIsMTE4LDE1OF0="

def _decrypt(key: str, b64: str) -> str:
    md5_hex = hashlib.md5(key.encode()).hexdigest()
    arr = json.loads(base64.b64decode(b64).decode())
    chars = [arr[i] - ord(md5_hex[min(i, 31)]) for i in range(len(arr))]
    return base64.b64decode("".join(chr(c) for c in chars)).decode()

SECRET = _decrypt(KEY, B64_SECRET)
SALT = _decrypt(KEY, B64_SALT)

def generate_jdsignature() -> str:
    ts = int(time.time())
    md5_hash = hashlib.md5(f"{ts}{SECRET}".encode()).hexdigest()
    return f"{ts}.{SALT}.{md5_hash}"
```

### 示例请求

```bash
curl -s 'https://apidd.spthgb.com/api/v2/search?q=STARS-804&type=movie' \
  -H 'User-Agent: JavDB-App/1.0' \
  -H 'Accept: application/json' \
  -H 'jdsignature: 1773826819.lpw6vgqzsp.51ed600308da9d9d3f178eeb1a55b820'
```

## 已验证的 API 端点

### 搜索 (v2)

```
GET /api/v2/search?q={query}&type=movie     搜索影片 ✅ (已验证)
GET /api/v2/search_image                     图片搜索
```

### 影片 (v1/v4)

```
GET /api/v1/movies/latest                    最新影片列表 ✅ (已验证)
GET /api/v1/movies/recommend                 推荐影片
GET /api/v1/movies/recommend_periods         推荐周期
GET /api/v1/movies/top                       排行榜
GET /api/v1/movies/tags                      影片标签
GET /api/v1/movies/{id}/magnets              磁力链接
GET /api/v1/movies/{id}/reviews              影片评论
GET /api/v1/movies/{id}/play                 播放
GET /api/v4/movies/{id}                      影片详情 ✅ (已验证，含完整信息)
```

### 用户认证 (v1)

```
POST /api/v1/sessions                        登录 ✅ (已验证)
POST /api/v1/users                           注册
POST /api/v1/users/forgot_password           忘记密码
POST /api/v1/users/reset_password            重置密码
```

#### 登录参数

```json
{
  "username": "string",
  "password": "string",
  "device_uuid": "uuid-string",
  "device_name": "Pixel 7",
  "device_model": "Pixel 7",
  "platform": "android",
  "app_version": "1.9.35",
  "app_version_number": "53",
  "system_version": "14",
  "app_channel": "official"
}
```

#### 登录响应

```json
{
  "success": 1,
  "data": {
    "user": {
      "id": 3704563,
      "username": "jqknono",
      "email": "jqknono@outlook.com",
      "is_vip": false,
      "want_watch_count": 6,
      "watched_count": 0,
      "share_url": "https://app.javdb571.com/?source=dhybsg",
      "promotion_code": "dhybsg"
    },
    "following_tags": [...]
  }
}
```

### 演员/导演/厂商 (v1)

```
GET /api/v1/actors/recommend                 推荐演员
GET /api/v1/actors/{id}                      演员详情
GET /api/v1/actors/{id}/collect_actions       收藏演员
GET /api/v1/directors/{id}                   导演详情
GET /api/v1/makers/{id}                      厂商详情
GET /api/v1/publishers/{id}                  发行商详情
GET /api/v1/series/{id}                      系列详情
```

### 用户收藏/历史 (v1)

```
GET /api/v1/users/collected_codes            收藏的影片
GET /api/v1/users/collected_actors           收藏的演员
GET /api/v1/users/collected_directors        收藏的导演
GET /api/v1/users/collected_lists            收藏的列表
GET /api/v1/users/collected_makers           收藏的厂商
GET /api/v1/users/collected_series           收藏的系列
GET /api/v1/users/recent_viewed              最近浏览
```

### 其他 (v1)

```
GET /api/v1/startup                          App 启动配置 (需 platform, app_channel 参数)
GET /api/v1/rankings                         排行榜
GET /api/v1/rankings/actors                  演员排行
GET /api/v1/articles                         文章列表
GET /api/v1/lists                            列表
GET /api/v1/about                            关于
GET /api/v1/helps                            帮助
GET /api/v1/ads                              广告
GET /api/v3/plans                            会员计划
```

### 磁力搜索 (v1)

```
GET /api/v1/search_magnet                    磁力搜索
```

## API 响应格式

### 成功

```json
{
  "success": 1,
  "action": null,
  "message": null,
  "data": { ... }
}
```

### 认证错误

| 状态 | 响应 |
|------|------|
| 缺少签名 | `{"success":0,"action":"ParameterInvalid","message":"參數不能爲空: jdsignature"}` |
| 无效签名 | `{"success":0,"action":"InvalidSignature","message":"無效的簽名"}` (HTTP 400) |
| 缺少参数 | `{"success":0,"action":"ParameterInvalid","message":"參數不能爲空: {param}"}` |

### 影片详情响应示例 (GET /api/v4/movies/{id})

```json
{
  "success": 1,
  "data": {
    "movie": {
      "id": "qDYQzM",
      "number": "STARS-804",
      "title": "本能で絡み合う極上のランジェリー＆オイリー4本番 神木麗",
      "thumb_url": "https://tp.cmastd.com/.../qDYQzM.jpg",
      "cover_url": "https://tp.cmastd.com/.../qDYQzM.jpg",
      "has_cnsub": true,
      "duration": 160,
      "score": "4.7",
      "reviews_count": 46452,
      "magnets_count": 21,
      "release_date": "2023-04-06",
      "maker_name": "SOD Create",
      "director_name": "チク兄",
      "tags": [{"id": "14", "name": "乳交"}, ...],
      "actors": [{"id": "65v5Q", "name": "神木麗", "gender": 0}, ...],
      "preview_video_url": "https://jdforrepam.com/api/v1/movies/ttm3u8/preview/..."
    }
  }
}
```

## 逆向工程方法论

### 工具链

1. **androguard** (Python) — 提取 APK 签名证书 DER 字节
2. **blutter** (C++/Python, Docker) — 反编译 Flutter Dart AOT snapshot (`libapp.so`)
3. **strings/objdump** — 分析 native 库 (`libsecurity.so`)

### 签名密钥来源

APK 使用 v1 签名方案。`libsecurity.so` 中的 `getSecret()` JNI 函数:
1. 通过 `ActivityThread.currentApplication()` 获取应用上下文
2. 调用 `PackageManager.getPackageInfo(packageName, GET_SIGNATURES)`
3. 取 `signatures[0].toCharsString()` 的前 5 个字符作为密钥
4. 该密钥通过 Flutter MethodChannel (`"commonTool"` / `"getKey"`) 传递给 Dart 层

APK 证书 DER 的 hex 编码始终以 `30820` 开头（ASN.1 SEQUENCE tag + length），这就是固定密钥。

### blutter 反编译关键发现

反编译输出位于 `asm/astarte/` 目录:

- **`net/intercept.dart`** — `AuthInterceptor.onRequest()`: 在每个请求中添加 `authorization`、`accept-language`、`jdsignature`、`connection: keep-alive` 头
- **`utils/common_tools.dart`** — `getSignature()`: 签名生成核心逻辑；`getDecryptString()`: 常量解密
- **`utils/common_utils.dart`** — `CommonUtils.getKey()`: 通过 MethodChannel 获取 native 密钥

### libsecurity.so 分析

- **架构**: ARM64 (aarch64), ELF shared object, Android NDK r26b
- **大小**: 19,056 bytes
- **导出函数**: `JNI_OnLoad`, `getSecret` (JNI), `encrypt`/`decrypt` (XOR 0x32), `AesEncrypt`/`Contrary_AesEncrypt`, `MD5*`, `byteToHexString`
- **关键常量**: `"security"`, `"astarte"`, AES S-box

## App 技术栈

- **框架**: Flutter 3.24.x (Dart 3.5.4 AOT 编译)
- **内部代号**: `astarte`
- **网络库**: Dio (拦截器链: AuthInterceptor → TokenInterceptor → DioCacheInterceptor → AdapterInterceptor)
- **加密**: pointycastle (AES/MD5/SHA256/HMAC), libsecurity.so (native JNI)
- **本地存储**: Hive, SharedPreferences (sp_util)
- **协议**: 自定义 `astarte://` URL scheme

## 结论

JavDB App 的 JSON API 已完全可用。通过逆向 APK 签名机制，成功实现了 `jdsignature` 的生成算法。
相比 Web 端 HTML 抓取方案，App API 具有以下优势:

1. **无 Cloudflare 防护** — 直接 HTTP 请求，无需 curl-impersonate
2. **结构化 JSON** — 无需 HTML 解析
3. **丰富数据** — 包含评分、磁力链接数、预览视频、演员信息等
4. **稳定性** — 不受 Web 前端改版影响
