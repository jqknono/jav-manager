# Everything HTTP 服务器 API 文档

## 概述

Everything HTTP 服务器是一个 Web 服务器，允许你通过 Web 浏览器搜索和访问本地文件。

---

## 基本配置

### 启动 HTTP 服务器

1. 在 Everything 中，点击 **工具** 菜单 → **选项**
2. 点击 **HTTP 服务器** 选项卡
3. 勾选 **启用 HTTP 服务器**
4. 点击 **确定**

### 访问地址

| 方式 | URL |
|------|-----|
| 本地访问 | `http://localhost` |
| 计算机名访问 | `http://ComputerName` |
| 指定端口 | `http://localhost:8080` |

> 默认端口：80（可在设置中更改）

### 身份验证

可设置用户名和密码（修改后立即生效）：
1. 工具 → 选项 → HTTP 服务器
2. 输入新的用户名和密码
3. 点击确定

---

## URL 查询参数（核心 API）

### 基本语法

```
http://localhost/?s=搜索词&o=0&c=32&j=0&...
```

### 参数列表

| 完整参数名 | 简写 | 类型 | 说明 |
|-----------|------|------|------|
| `search` | `s`, `q` | string | 搜索文本 |
| `offset` | `o` | number | 从第 n 条结果开始显示 |
| `count` | `c` | number | 返回结果数量限制 |
| `json` | `j` | boolean | 非零值返回 JSON 格式 |
| `case` | `i` | boolean | 非零值区分大小写 |
| `wholeword` | `w` | boolean | 非零值全词匹配 |
| `path` | `p` | boolean | 非零值搜索完整路径 |
| `regex` | `r` | boolean | 非零值使用正则表达式 |
| `diacritics` | `m` | boolean | 非零值匹配变音符号 |
| `path_column` | - | boolean | JSON 中包含路径列 |
| `size_column` | - | boolean | JSON 中包含大小列 |
| `date_modified_column` | - | boolean | JSON 中包含修改日期列 |
| `date_created_column` | - | boolean | JSON 中包含创建日期列 |
| `attributes_column` | - | boolean | JSON 中包含属性列 |
| `sort` | - | string | 排序字段（见下表） |
| `ascending` | - | boolean | 非零值升序排序 |

### 排序字段（sort）

| 值 | 说明 |
|----|------|
| `name` | 按名称排序（默认） |
| `path` | 按路径排序 |
| `date_modified` | 按修改日期排序 |
| `size` | 按大小排序 |

### 默认值

#### HTML 格式默认值

| 参数 | 默认值 |
|------|--------|
| search | 空 |
| offset | 0 |
| count | 32 |
| json | 0 |
| case | 0 |
| wholeword | 0 |
| path | 0 |
| regex | 0 |
| diacritics | 0 |
| sort | name |
| ascending | 1 |

#### JSON 格式默认值

| 参数 | 默认值 |
|------|--------|
| search | 空 |
| offset | 0 |
| count | 4294967295（无限制） |
| json | 1 |
| case | 0 |
| wholeword | 0 |
| path | 0 |
| regex | 0 |
| diacritics | 0 |
| path_column | 0 |
| size_column | 0 |
| date_modified_column | 0 |
| date_created_column | 0 |
| attributes_column | 0 |
| sort | name |
| ascending | 1 |

---

## API 使用示例

### 基础搜索

```
http://localhost/?search=ABC+123
```

### 搜索并返回 JSON（前 100 条）

```
http://localhost/?search=ABC+123&json=1&count=100
```

### 按大小降序排序

```
http://localhost/?search=ABC+123&sort=size&ascending=0
```

### 使用正则表达式搜索

```
http://localhost/?search=test.*log&regex=1&json=1
```

### 搜索完整路径

```
http://localhost/?search=windows&path=1&json=1
```

### 包含大小和日期信息

```
http://localhost/?search=*.jpg&json=1&size_column=1&date_modified_column=1
```

### 分页查询

```
http://localhost/?search=*.txt&json=1&count=50&offset=50
```

---

## 高级功能

### 禁用文件下载

仅允许查看搜索结果，禁止下载文件：

1. 工具 → 选项 → HTTP 服务器
2. 取消勾选 **允许文件下载**
3. 点击确定

### 自定义界面

#### 方法一：自定义 HTML/CSS 文件

1. 在 `%APPDATA%\Everything` 创建 `HTTP Server` 文件夹
   - 如果未启用设置存储在 APPDATA，则在 `Everything.exe` 同目录创建
2. 下载 [Everything-HTTP.Server.Files.zip](https://www.voidtools.com/) 到该文件夹
3. 编辑文件自定义界面
4. 按住 Shift 点击刷新按钮强制刷新

#### 方法二：更改默认页面

1. 工具 → 选项 → HTTP 服务器
2. 设置 **默认页面** 为自定义页面

### 自定义字符串（本地化）

1. 下载 [http_server_strings.zip](https://www.voidtools.com/)
2. 解压 `http_server_strings.ini` 到 `%APPDATA%\Everything\HTTP server\`
3. 编辑 ini 文件
4. 在 Everything 中执行：
   ```
   /http_server_strings=C:\Users\<用户名>\AppData\Roaming\Everything\HTTP Server\http_server_strings.ini
   ```
5. 重启 HTTP 服务器

---

## Range 请求支持

Everything 支持 Range 请求，可用于：
- 视频流式播放
- 音频流式播放
- 大文件分块下载

---

## 安全注意事项

⚠️ **警告**：所有被 Everything 索引的文件和文件夹都可以通过 Web 服务器搜索和下载。

### 安全建议

1. 设置用户名和密码
2. 如仅需查看，禁用文件下载
3. 仅在可信网络环境中使用
4. 考虑更改默认端口

---

## 禁用 HTTP 服务器

如需完全禁用 HTTP 服务器功能：

1. 退出 Everything
2. 打开 `Everything.ini`（与 `Everything.exe` 同目录）
3. 将以下行：
   ```ini
   allow_http_server=1
   ```
   改为：
   ```ini
   allow_http_server=0
   ```
4. 保存并重启 Everything

---

## 故障排除

### 错误：Unable to start HTTP server: bind failed 10048

**原因**：端口 80 已被其他服务占用。

**解决方法**：

1. 工具 → 选项 → HTTP 服务器
2. 将 **监听端口** 改为其他端口（如 8080）
3. 点击确定
4. 访问时需指定端口：`http://localhost:8080`

---

## JSON 响应格式示例

```json
{
  "name": "filename.txt",
  "path": "C:\\Folder\\filename.txt",
  "size": 1024,
  "date_modified": "2024-01-01T12:00:00"
}
```

---

## 参考链接

- [Everything 官方文档](https://www.voidtools.com/support/everything/http/)
- [Everything 主页](https://www.voidtools.com/)
