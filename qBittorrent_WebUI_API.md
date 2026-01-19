# qBittorrent WebUI API 文档

> 版本：qBittorrent 5.0+ / API v2.11.3
> 官方文档：https://github.com/qbittorrent/qBittorrent/wiki/WebUI-API-(qBittorrent-5.0)

---

## 概述

所有 API 方法遵循格式：`/api/v2/APIName/methodName`

- `GET`：查询操作
- `POST`：修改状态操作
- 所有 API（除登录外）都需要认证

---

## 认证

### 登录

**端点：** `/api/v2/auth/login`

**方法：** `POST`

**参数：**

| 参数 | 类型 | 说明 |
|------|------|------|
| `username` | string | WebUI 用户名 |
| `password` | string | WebUI 密码 |

**返回：**

| 状态码 | 场景 |
|--------|------|
| 403 | IP 因多次登录失败被禁 |
| 200 | 其他所有场景 |

**响应：** 成功时返回包含 SID 的 Cookie

**示例：**

```bash
curl -i --header 'Referer: http://localhost:8080' \
     --data 'username=admin&password=adminadmin' \
     http://localhost:8080/api/v2/auth/login
```

> 注意：必须设置 `Referer` 或 `Origin` 头部为请求的主机地址

### 登出

**端点：** `/api/v2/auth/logout`

**方法：** `POST`

**返回：** `200 OK`

---

## 查询 API

### 获取种子列表

**端点：** `/api/v2/torrents/info`

**方法：** `GET`

**参数：**

| 参数 | 类型 | 说明 |
|------|------|------|
| `filter` | string | 状态过滤：`all`, `downloading`, `seeding`, `completed`, `stopped`, `active`, `inactive`, `running`, `stalled`, `stalled_uploading`, `stalled_downloading`, `errored` |
| `category` | string | 按分类过滤（空字符串表示无分类，不传表示任意分类） |
| `tag` | string | 按标签过滤（空字符串表示无标签，不传表示任意标签） |
| `sort` | string | 排序字段（可用响应 JSON 数组的任意字段） |
| `reverse` | bool | 反向排序 |
| `limit` | integer | 限制返回数量 |
| `offset` | integer | 设置偏移量（负数表示从末尾偏移） |
| `hashes` | string | 按 hash 过滤，多个用 `\|` 分隔 |

**示例：**

```
GET /api/v2/torrents/info?filter=downloading&category=movies&sort=ratio
```

**返回：** JSON 数组

| 字段 | 类型 | 说明 |
|------|------|------|
| `added_on` | integer | 添加时间（Unix 时间戳） |
| `amount_left` | integer | 剩余数据量（字节） |
| `auto_tmm` | bool | 是否启用自动种子管理 |
| `availability` | float | 可用片段百分比 |
| `category` | string | 分类 |
| `completed` | integer | 已完成传输数据（字节） |
| `completion_on` | integer | 完成时间（Unix 时间戳） |
| `content_path` | string | 内容绝对路径 |
| `dl_limit` | integer | 下载限速（字节/s，-1 表示无限制） |
| `dlspeed` | integer | 下载速度（字节/s） |
| `downloaded` | integer | 已下载数据量 |
| `downloaded_session` | integer | 本次会话已下载 |
| `eta` | integer | 预计完成时间（秒） |
| `f_l_piece_prio` | bool | 是否首尾片段优先 |
| `force_start` | bool | 是否强制开始 |
| `hash` | string | 种子哈希 |
| `isPrivate` | bool | 是否来自私有追踪器 |
| `last_activity` | integer | 最后活动时间（Unix 时间戳） |
| `magnet_uri` | string | 磁力链接 |
| `max_ratio` | float | 最大分享比率 |
| `max_seeding_time` | integer | 最大做种时间（秒） |
| `name` | string | 种子名称 |
| `num_complete` | integer | 群体中完成者数量 |
| `num_incomplete` | integer | 群体中未完成者数量 |
| `num_leechs` | integer | 已连接的下载者数量 |
| `num_seeds` | integer | 已连接的种子数量 |
| `priority` | integer | 优先级（-1 表示队列未启用或种子模式） |
| `progress` | float | 进度（百分比/100） |
| `ratio` | float | 分享比率 |
| `reannounce` | integer | 下次重新公告时间（秒） |
| `save_path` | string | 保存路径 |
| `seeding_time` | integer | 做种时间（秒） |
| `seq_dl` | bool | 是否顺序下载 |
| `size` | integer | 选中文件总大小（字节） |
| `state` | string | 状态（见下表） |
| `super_seeding` | bool | 是否超级做种 |
| `tags` | string | 标签列表（逗号分隔） |
| `time_active` | integer | 总活跃时间（秒） |
| `total_size` | integer | 所有文件总大小（字节） |
| `tracker` | string | 首个工作追踪器 URL |
| `up_limit` | integer | 上传限速（字节/s，-1 表示无限制） |
| `uploaded` | integer | 已上传数据量 |
| `uploaded_session` | integer | 本次会话已上传 |
| `upspeed` | integer | 上传速度（字节/s） |

**状态值 (state)：**

| 值 | 说明 |
|----|------|
| `error` | 发生错误（已暂停） |
| `missingFiles` | 文件丢失 |
| `uploading` | 正在上传，数据传输中 |
| `pausedUP` | 已暂停，已完成下载 |
| `queuedUP` | 排队等待上传 |
| `stalledUP` | 做种中，无连接 |
| `checkingUP` | 已完成，正在检查 |
| `forcedUP` | 强制上传，忽略队列 |
| `allocating` | 正在分配磁盘空间 |
| `downloading` | 正在下载，数据传输中 |
| `metaDL` | 正在获取元数据 |
| `pausedDL` | 已暂停，未完成下载 |
| `queuedDL` | 排队等待下载 |
| `stalledDL` | 下载中，无连接 |
| `checkingDL` | 正在检查，未完成下载 |
| `forcedDL` | 强制下载，忽略队列 |
| `checkingResumeData` | 启动时检查恢复数据 |
| `moving` | 正在移动到其他位置 |
| `unknown` | 未知状态 |

---

### 获取种子通用属性

**端点：** `/api/v2/torrents/properties`

**方法：** `GET`

**参数：**

| 参数 | 类型 | 说明 |
|------|------|------|
| `hash` | string | 种子哈希 |

**返回：** JSON 对象

| 字段 | 类型 | 说明 |
|------|------|------|
| `save_path` | string | 保存路径 |
| `creation_date` | integer | 创建日期（Unix 时间戳） |
| `piece_size` | integer | 分块大小（字节） |
| `comment` | string | 注释 |
| `total_wasted` | integer | 浪费数据（字节） |
| `total_uploaded` | integer | 总上传（字节） |
| `total_uploaded_session` | integer | 本次会话上传（字节） |
| `total_downloaded` | integer | 总下载（字节） |
| `total_downloaded_session` | integer | 本次会话下载（字节） |
| `up_limit` | integer | 上传限速（字节/s） |
| `dl_limit` | integer | 下载限速（字节/s） |
| `time_elapsed` | integer | 经过时间（秒） |
| `seeding_time` | integer | 做种时间（秒） |
| `nb_connections` | integer | 连接数 |
| `nb_connections_limit` | integer | 连接数限制 |
| `share_ratio` | float | 分享比率 |
| `addition_date` | integer | 添加日期（Unix 时间戳） |
| `completion_date` | integer | 完成日期（Unix 时间戳） |
| `created_by` | string | 创建者 |
| `dl_speed_avg` | integer | 平均下载速度（字节/s） |
| `dl_speed` | integer | 下载速度（字节/s） |
| `eta` | integer | 预计完成时间（秒） |
| `last_seen` | integer | 最后看到完整时间（Unix 时间戳） |
| `peers` | integer | 已连接对等端数量 |
| `peers_total` | integer | 群体中对等端总数 |
| `pieces_have` | integer | 已拥有分块数 |
| `pieces_num` | integer | 总分块数 |
| `reannounce` | integer | 下次公告时间（秒） |
| `seeds` | integer | 已连接种子数 |
| `seeds_total` | integer | 群体中种子总数 |
| `total_size` | integer | 总大小（字节） |
| `up_speed_avg` | integer | 平均上传速度（字节/s） |
| `up_speed` | integer | 上传速度（字节/s） |
| `isPrivate` | bool | 是否私有种子 |

---

### 获取种子追踪器

**端点：** `/api/v2/torrents/trackers`

**方法：** `GET`

**参数：**

| 参数 | 类型 | 说明 |
|------|------|------|
| `hash` | string | 种子哈希 |

**返回：** JSON 数组

| 字段 | 类型 | 说明 |
|------|------|------|
| `url` | string | 追踪器 URL |
| `status` | integer | 状态：0=禁用，1=未联系，2=工作正常，3=更新中，4=不工作 |
| `tier` | integer | 优先级层级 |
| `num_peers` | integer | 对等端数量 |
| `num_seeds` | integer | 种子数量 |
| `num_leeches` | integer | 下载者数量 |
| `num_downloaded` | integer | 完成下载次数 |
| `msg` | string | 追踪器消息 |

---

### 获取种子 Web 种子

**端点：** `/api/v2/torrents/webseeds`

**方法：** `GET`

**参数：**

| 参数 | 类型 | 说明 |
|------|------|------|
| `hash` | string | 种子哈希 |

**返回：** JSON 数组

| 字段 | 类型 | 说明 |
|------|------|------|
| `url` | string | Web 种子 URL |

---

### 获取种子文件列表

**端点：** `/api/v2/torrents/files`

**方法：** `GET`

**参数：**

| 参数 | 类型 | 说明 |
|------|------|------|
| `hash` | string | 种子哈希 |
| `indexes` | string | 文件索引，多个用 `\|` 分隔 |

**返回：** JSON 数组

| 字段 | 类型 | 说明 |
|------|------|------|
| `index` | integer | 文件索引 |
| `name` | string | 文件名（含相对路径） |
| `size` | integer | 文件大小（字节） |
| `progress` | float | 下载进度 |
| `priority` | integer | 优先级：0=不下载，1=普通，6=高，7=最高 |
| `is_seed` | bool | 是否已完成 |
| `piece_range` | array | 分块范围 [起始, 结束] |
| `availability` | float | 可用性 |

---

### 获取种子下载限速

**端点：** `/api/v2/torrents/downloadLimit`

**方法：** `POST`

**参数：**

| 参数 | 类型 | 说明 |
|------|------|------|
| `hashes` | string | 种子哈希，多个用 `\|` 分隔，或 `all` |

**返回：** JSON 对象 `{hash: limit}`

---

### 获取种子上传限速

**端点：** `/api/v2/torrents/uploadLimit`

**方法：** `POST`

**参数：** 同下载限速

**返回：** JSON 对象 `{hash: limit}`

---

## 创建 API

### 添加新种子

**端点：** `/api/v2/torrents/add`

**方法：** `POST` (`multipart/form-data`)

**参数：**

| 参数 | 类型 | 说明 |
|------|------|------|
| `urls` | string | URL 列表（换行分隔） |
| `torrents` | raw | 种子文件原始数据（可多次） |
| `savepath` | string | 保存目录 |
| `category` | string | 分类 |
| `tags` | string | 标签（逗号分隔） |
| `skip_checking` | string | 跳过校验：`true`/`false` |
| `paused` | string | 添加后暂停：`true`/`false` |
| `root_folder` | string | 创建根目录：`true`/`false` |
| `rename` | string | 重命名种子 |
| `upLimit` | integer | 上传限速（字节/s） |
| `dlLimit` | integer | 下载限速（字节/s） |
| `ratioLimit` | float | 分享比率限制 |
| `seedingTimeLimit` | integer | 做种时间限制（分钟） |
| `autoTMM` | bool | 是否使用自动种子管理 |
| `sequentialDownload` | string | 顺序下载：`true`/`false` |
| `firstLastPiecePrio` | string | 首尾优先：`true`/`false` |

**返回：**

| 状态码 | 场景 |
|--------|------|
| 415 | 种子文件无效 |
| 200 | 成功 |

**示例（从 URL 添加）：**

```http
POST /api/v2/torrents/add HTTP/1.1
Content-Type: multipart/form-data; boundary=---------------------------6688794727912

-----------------------------6688794727912
Content-Disposition: form-data; name="urls"

https://example.com/file.torrent
-----------------------------6688794727912
Content-Disposition: form-data; name="savepath"

C:/Downloads
-----------------------------6688794727912
Content-Disposition: form-data; name="category"

movies
-----------------------------6688794727912
Content-Disposition: form-data; name="paused"

true
-----------------------------6688794727912--
```

**示例（从文件添加）：**

```http
POST /api/v2/torrents/add HTTP/1.1
Content-Type: multipart/form-data; boundary=---------------------------acebdf13572468

---------------------------acebdf13572468
Content-Disposition: form-data; name="torrents"; filename="file.torrent"
Content-Type: application/x-bittorrent

<文件二进制数据>
---------------------------acebdf13572468--
```

---

### 添加追踪器

**端点：** `/api/v2/torrents/addTrackers`

**方法：** `POST` (`application/x-www-form-urlencoded`)

**参数：**

| 参数 | 类型 | 说明 |
|------|------|------|
| `hash` | string | 种子哈希 |
| `urls` | string | 追踪器 URL（换行分隔 `%0A`） |

**返回：**

| 状态码 | 场景 |
|--------|------|
| 404 | 种子未找到 |
| 200 | 成功 |

**示例：**

```http
POST /api/v2/torrents/addTrackers
hash=xxx&urls=http://tracker1.com%0Ahttp://tracker2.com
```

---

### 添加对等端

**端点：** `/api/v2/torrents/addPeers`

**方法：** `POST`

**参数：**

| 参数 | 类型 | 说明 |
|------|------|------|
| `hashes` | string | 种子哈希（多个用 `\|` 分隔） |
| `peers` | string | 对等端 `host:port`（多个用 `\|` 分隔） |

**返回：**

| 状态码 | 场景 |
|--------|------|
| 400 | 无有效对等端 |
| 200 | 成功 |

---

## 更新 API

### 暂停种子

**端点：** `/api/v2/torrents/stop`

**方法：** `POST`

**参数：**

| 参数 | 类型 | 说明 |
|------|------|------|
| `hashes` | string | 种子哈希（多个用 `\|` 分隔）或 `all` |

**示例：**

```
POST /api/v2/torrents/stop?hashes=hash1|hash2
```

---

### 恢复种子

**端点：** `/api/v2/torrents/start`

**方法：** `POST`

**参数：** 同暂停种子

---

### 重新检查种子

**端点：** `/api/v2/torrents/recheck`

**方法：** `POST`

**参数：** 同暂停种子

---

### 重新公告种子

**端点：** `/api/v2/torrents/reannounce`

**方法：** `POST`

**参数：** 同暂停种子

---

### 编辑追踪器

**端点：** `/api/v2/torrents/editTracker`

**方法：** `POST`

**参数：**

| 参数 | 类型 | 说明 |
|------|------|------|
| `hash` | string | 种子哈希 |
| `origUrl` | string | 原追踪器 URL |
| `newUrl` | string | 新追踪器 URL |

**返回：**

| 状态码 | 场景 |
|--------|------|
| 400 | 新 URL 无效 |
| 404 | 种子未找到 |
| 409 | 新 URL 已存在或原 URL 未找到 |
| 200 | 成功 |

---

### 移除追踪器

**端点：** `/api/v2/torrents/removeTrackers`

**方法：** `POST`

**参数：**

| 参数 | 类型 | 说明 |
|------|------|------|
| `hash` | string | 种子哈希 |
| `urls` | string | 要移除的 URL（`\|` 分隔） |

**返回：**

| 状态码 | 场景 |
|--------|------|
| 404 | 种子未找到 |
| 409 | 所有 URL 未找到 |
| 200 | 成功 |

---

### 设置文件优先级

**端点：** `/api/v2/torrents/filePrio`

**方法：** `POST`

**参数：**

| 参数 | 类型 | 说明 |
|------|------|------|
| `hash` | string | 种子哈希 |
| `id` | string | 文件 ID（`\|` 分隔） |
| `priority` | number | 优先级：0=不下载，1=普通，6=高，7=最高 |

**返回：**

| 状态码 | 场景 |
|--------|------|
| 400 | 优先级无效或 ID 无效 |
| 404 | 种子未找到 |
| 409 | 元数据未下载或 ID 未找到 |
| 200 | 成功 |

---

### 设置下载限速

**端点：** `/api/v2/torrents/setDownloadLimit`

**方法：** `POST`

**参数：**

| 参数 | 类型 | 说明 |
|------|------|------|
| `hashes` | string | 种子哈希（多个用 `\|` 分隔）或 `all` |
| `limit` | integer | 限速（字节/s） |

**返回：** `200 OK`

---

### 设置上传限速

**端点：** `/api/v2/torrents/setUploadLimit`

**方法：** `POST`

**参数：** 同下载限速

---

### 设置分享限制

**端点：** `/api/v2/torrents/setShareLimits`

**方法：** `POST`

**参数：**

| 参数 | 类型 | 说明 |
|------|------|------|
| `hashes` | string | 种子哈希（多个用 `\|` 分隔）或 `all` |
| `ratioLimit` | float | 分享比率限制（-2=全局，-1=无限制） |
| `seedingTimeLimit` | integer | 做种时间限制（分钟，-2=全局，-1=无限制） |
| `inactiveSeedingTimeLimit` | integer | 非活跃做种时间限制（分钟） |

**返回：**

| 状态码 | 场景 |
|--------|------|
| 400 | 参数缺失 |
| 200 | 成功 |

---

### 设置保存位置

**端点：** `/api/v2/torrents/setLocation`

**方法：** `POST`

**参数：**

| 参数 | 类型 | 说明 |
|------|------|------|
| `hashes` | string | 种子哈希（多个用 `\|` 分隔）或 `all` |
| `location` | string | 新位置 |

**返回：**

| 状态码 | 场景 |
|--------|------|
| 400 | 路径为空 |
| 403 | 无写入权限 |
| 409 | 无法创建目录 |
| 200 | 成功 |

---

### 设置种子名称

**端点：** `/api/v2/torrents/rename`

**方法：** `POST`

**参数：**

| 参数 | 类型 | 说明 |
|------|------|------|
| `hash` | string | 种子哈希 |
| `name` | string | 新名称 |

**返回：**

| 状态码 | 场景 |
|--------|------|
| 404 | 种子无效 |
| 409 | 名称为空 |
| 200 | 成功 |

---

### 设置分类

**端点：** `/api/v2/torrents/setCategory`

**方法：** `POST`

**参数：**

| 参数 | 类型 | 说明 |
|------|------|------|
| `hashes` | string | 种子哈希（多个用 `\|` 分隔）或 `all` |
| `category` | string | 分类名称 |

**返回：**

| 状态码 | 场景 |
|--------|------|
| 409 | 分类不存在 |
| 200 | 成功 |

---

### 添加标签

**端点：** `/api/v2/torrents/addTags`

**方法：** `POST`

**参数：**

| 参数 | 类型 | 说明 |
|------|------|------|
| `hashes` | string | 种子哈希（多个用 `\|` 分隔）或 `all` |
| `tags` | string | 标签（逗号分隔） |

**返回：** `200 OK`

---

### 移除标签

**端点：** `/api/v2/torrents/removeTags`

**方法：** `POST`

**参数：**

| 参数 | 类型 | 说明 |
|------|------|------|
| `hashes` | string | 种子哈希（多个用 `\|` 分隔）或 `all` |
| `tags` | string | 标签（逗号分隔），空列表移除所有标签 |

**返回：** `200 OK`

---

### 设置自动管理

**端点：** `/api/v2/torrents/setAutoManagement`

**方法：** `POST`

**参数：**

| 参数 | 类型 | 说明 |
|------|------|------|
| `hashes` | string | 种子哈希（多个用 `\|` 分隔）或 `all` |
| `enable` | bool | 是否启用 |

**返回：** `200 OK`

---

### 切换顺序下载

**端点：** `/api/v2/torrents/toggleSequentialDownload`

**方法：** `POST`

**参数：**

| 参数 | 类型 | 说明 |
|------|------|------|
| `hashes` | string | 种子哈希（多个用 `\|` 分隔）或 `all` |

**返回：** `200 OK`

---

### 切换首尾优先

**端点：** `/api/v2/torrents/toggleFirstLastPiecePrio`

**方法：** `POST`

**参数：** 同顺序下载

**返回：** `200 OK`

---

### 设置强制开始

**端点：** `/api/v2/torrents/setForceStart`

**方法：** `POST`

**参数：**

| 参数 | 类型 | 说明 |
|------|------|------|
| `hashes` | string | 种子哈希（多个用 `\|` 分隔）或 `all` |
| `value` | bool | 是否强制开始 |

**返回：** `200 OK`

---

### 设置超级做种

**端点：** `/api/v2/torrents/setSuperSeeding`

**方法：** `POST`

**参数：** 同强制开始

**返回：** `200 OK`

---

### 重命名文件

**端点：** `/api/v2/torrents/renameFile`

**方法：** `POST`

**参数：**

| 参数 | 类型 | 说明 |
|------|------|------|
| `hash` | string | 种子哈希 |
| `oldPath` | string | 原路径 |
| `newPath` | string | 新路径 |

**返回：**

| 状态码 | 场景 |
|--------|------|
| 400 | 缺少 newPath |
| 409 | 路径无效或已存在 |
| 200 | 成功 |

---

### 重命名文件夹

**端点：** `/api/v2/torrents/renameFolder`

**方法：** `POST`

**参数：** 同重命名文件

**返回：** 同重命名文件

---

### 优先级调整

#### 提高优先级

**端点：** `/api/v2/torrents/increasePrio`

**方法：** `POST`

**参数：**

| 参数 | 类型 | 说明 |
|------|------|------|
| `hashes` | string | 种子哈希（多个用 `\|` 分隔）或 `all` |

**返回：**

| 状态码 | 场景 |
|--------|------|
| 409 | 队列未启用 |
| 200 | 成功 |

#### 降低优先级

**端点：** `/api/v2/torrents/decreasePrio`

**方法/参数：** 同提高优先级

#### 最高优先级

**端点：** `/api/v2/torrents/topPrio`

**方法/参数：** 同提高优先级

#### 最低优先级

**端点：** `/api/v2/torrents/bottomPrio`

**方法/参数：** 同提高优先级

---

## 删除 API

### 删除种子

**端点：** `/api/v2/torrents/delete`

**方法：** `POST`

**参数：**

| 参数 | 类型 | 说明 |
|------|------|------|
| `hashes` | string | 种子哈希（多个用 `\|` 分隔）或 `all` |
| `deleteFiles` | bool | 是否同时删除下载的数据 |

**示例：**

```
POST /api/v2/torrents/delete?hashes=hash1|hash2&deleteFiles=false
```

**返回：** `200 OK`

---

## 分类管理

### 获取所有分类

**端点：** `/api/v2/torrents/categories`

**方法：** `GET`

**返回：** JSON 对象

```json
{
  "Video": {
    "name": "Video",
    "savePath": "/home/user/torrents/video/"
  }
}
```

---

### 创建分类

**端点：** `/api/v2/torrents/createCategory`

**方法：** `POST`

**参数：**

| 参数 | 类型 | 说明 |
|------|------|------|
| `category` | string | 分类名称 |
| `savePath` | string | 保存路径 |

**返回：**

| 状态码 | 场景 |
|--------|------|
| 400 | 分类名为空 |
| 409 | 分类名无效 |
| 200 | 成功 |

---

### 编辑分类

**端点：** `/api/v2/torrents/editCategory`

**方法：** `POST`

**参数：** 同创建分类

**返回：**

| 状态码 | 场景 |
|--------|------|
| 400 | 分类名为空 |
| 409 | 编辑失败 |
| 200 | 成功 |

---

### 删除分类

**端点：** `/api/v2/torrents/removeCategories`

**方法：** `POST`

**参数：**

| 参数 | 类型 | 说明 |
|------|------|------|
| `categories` | string | 分类列表（换行分隔 `%0A`） |

**返回：** `200 OK`

---

## 标签管理

### 获取所有标签

**端点：** `/api/v2/torrents/tags`

**方法：** `GET`

**返回：** JSON 数组

---

### 创建标签

**端点：** `/api/v2/torrents/createTags`

**方法：** `POST`

**参数：**

| 参数 | 类型 | 说明 |
|------|------|------|
| `tags` | string | 标签列表（逗号分隔） |

**返回：** `200 OK`

---

### 删除标签

**端点：** `/api/v2/torrents/deleteTags`

**方法：** `POST`

**参数：** 同创建标签

**返回：** `200 OK`

---

## 同步 API

### 获取主数据

**端点：** `/api/v2/sync/maindata`

**方法：** `GET`

**参数：**

| 参数 | 类型 | 说明 |
|------|------|------|
| `rid` | integer | 响应 ID（默认 0） |

**返回：** JSON 对象

| 字段 | 类型 | 说明 |
|------|------|------|
| `rid` | integer | 响应 ID |
| `full_update` | bool | 是否全量更新 |
| `torrents` | object | 种子数据 |
| `torrents_removed` | array | 已删除种子哈希 |
| `categories` | object | 新增分类 |
| `categories_removed` | array | 已删除分类 |
| `tags` | array | 新增标签 |
| `tags_removed` | array | 已删除标签 |
| `server_state` | object | 全局传输信息 |

---

## 传输信息

### 获取全局传输信息

**端点：** `/api/v2/transfer/info`

**方法：** `GET`

**返回：** JSON 对象

| 字段 | 类型 | 说明 |
|------|------|------|
| `dl_info_speed` | integer | 全局下载速度（字节/s） |
| `dl_info_data` | integer | 本次会话下载量（字节） |
| `up_info_speed` | integer | 全局上传速度（字节/s） |
| `up_info_data` | integer | 本次会话上传量（字节） |
| `dl_rate_limit` | integer | 下载限速（字节/s） |
| `up_rate_limit` | integer | 上传限速（字节/s） |
| `dht_nodes` | integer | DHT 节点数 |
| `connection_status` | string | 连接状态：`connected`/`firewalled`/`disconnected` |

---

## 快速参考

| 操作 | 端点 | 方法 |
|------|------|------|
| 获取种子列表 | `/api/v2/torrents/info` | GET |
| 获取种子属性 | `/api/v2/torrents/properties` | GET |
| 获取文件列表 | `/api/v2/torrents/files` | GET |
| 添加种子 | `/api/v2/torrents/add` | POST |
| 暂停种子 | `/api/v2/torrents/stop` | POST |
| 恢复种子 | `/api/v2/torrents/start` | POST |
| 删除种子 | `/api/v2/torrents/delete` | POST |
| 设置限速 | `/api/v2/torrents/setDownloadLimit` | POST |
| 设置位置 | `/api/v2/torrents/setLocation` | POST |
| 设置分类 | `/api/v2/torrents/setCategory` | POST |
| 添加标签 | `/api/v2/torrents/addTags` | POST |

---

## HTTP 状态码参考

| 状态码 | 说明 |
|--------|------|
| 200 | 成功 |
| 400 | 请求参数错误 |
| 403 | 禁止访问 |
| 404 | 资源未找到 |
| 409 | 操作冲突（如队列未启用） |
| 415 | 不支持的媒体类型 |
| 500 | 服务器内部错误 |
