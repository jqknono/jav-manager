# Everything HTTP Server API Documentation

## Overview

Everything HTTP Server is a web server that allows you to search and access local files through a web browser.

---

## Basic Configuration

### Starting the HTTP Server

1. In Everything, click the **Tools** menu → **Options**
2. Click the **HTTP Server** tab
3. Check **Enable HTTP Server**
4. Click **OK**

### Access URLs

| Method | URL |
|--------|-----|
| Local access | `http://localhost` |
| Computer name access | `http://ComputerName` |
| Specified port | `http://localhost:8080` |

> Default port: 80 (can be changed in settings)

### Authentication

You can set a username and password (takes effect immediately):
1. Tools → Options → HTTP Server
2. Enter new username and password
3. Click OK

---

## URL Query Parameters (Core API)

### Basic Syntax

```
http://localhost/?s=search_term&o=0&c=32&j=0&...
```

### Parameter List

| Full Parameter Name | Short | Type | Description |
|---------------------|-------|------|-------------|
| `search` | `s`, `q` | string | Search text |
| `offset` | `o` | number | Display results starting from the nth item |
| `count` | `c` | number | Limit the number of results returned |
| `json` | `j` | boolean | Non-zero value returns JSON format |
| `case` | `i` | boolean | Non-zero value for case-sensitive |
| `wholeword` | `w` | boolean | Non-zero value for whole word matching |
| `path` | `p` | boolean | Non-zero value to search full path |
| `regex` | `r` | boolean | Non-zero value to use regular expressions |
| `diacritics` | `m` | boolean | Non-zero value to match diacritics |
| `path_column` | - | boolean | Include path column in JSON |
| `size_column` | - | boolean | Include size column in JSON |
| `date_modified_column` | - | boolean | Include modified date column in JSON |
| `date_created_column` | - | boolean | Include created date column in JSON |
| `attributes_column` | - | boolean | Include attributes column in JSON |
| `sort` | - | string | Sort field (see table below) |
| `ascending` | - | boolean | Non-zero value for ascending sort |

### Sort Fields (sort)

| Value | Description |
|-------|-------------|
| `name` | Sort by name (default) |
| `path` | Sort by path |
| `date_modified` | Sort by modified date |
| `size` | Sort by size |

### Default Values

#### HTML Format Defaults

| Parameter | Default Value |
|-----------|---------------|
| search | Empty |
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

#### JSON Format Defaults

| Parameter | Default Value |
|-----------|---------------|
| search | Empty |
| offset | 0 |
| count | 4294967295 (unlimited) |
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

## API Usage Examples

### Basic Search

```
http://localhost/?search=ABC+123
```

### Search and Return JSON (First 100 Results)

```
http://localhost/?search=ABC+123&json=1&count=100
```

### Sort by Size in Descending Order

```
http://localhost/?search=ABC+123&sort=size&ascending=0
```

### Search Using Regular Expression

```
http://localhost/?search=test.*log&regex=1&json=1
```

### Search Full Path

```
http://localhost/?search=windows&path=1&json=1
```

### Include Size and Date Information

```
http://localhost/?search=*.jpg&json=1&size_column=1&date_modified_column=1
```

### Paginated Query

```
http://localhost/?search=*.txt&json=1&count=50&offset=50
```

---

## Advanced Features

### Disable File Download

Only allow viewing search results, prohibit file downloads:

1. Tools → Options → HTTP Server
2. Uncheck **Allow file download**
3. Click OK

### Custom Interface

#### Method 1: Custom HTML/CSS Files

1. Create an `HTTP Server` folder in `%APPDATA%\Everything`
   - If settings storage in APPDATA is not enabled, create it in the same directory as `Everything.exe`
2. Download [Everything-HTTP.Server.Files.zip](https://www.voidtools.com/) to that folder
3. Edit files to customize the interface
4. Hold Shift and click the refresh button to force refresh

#### Method 2: Change Default Page

1. Tools → Options → HTTP Server
2. Set **Default page** to a custom page

### Custom Strings (Localization)

1. Download [http_server_strings.zip](https://www.voidtools.com/)
2. Extract `http_server_strings.ini` to `%APPDATA%\Everything\HTTP server\`
3. Edit the ini file
4. Execute in Everything:
   ```
   /http_server_strings=C:\Users\<username>\AppData\Roaming\Everything\HTTP Server\http_server_strings.ini
   ```
5. Restart the HTTP Server

---

## Range Request Support

Everything supports Range requests, which can be used for:
- Video streaming
- Audio streaming
- Large file chunked downloads

---

## Security Considerations

⚠️ **Warning**: All files and folders indexed by Everything can be searched and downloaded through the web server.

### Security Recommendations

1. Set a username and password
2. Disable file download if only viewing is needed
3. Use only in trusted network environments
4. Consider changing the default port

---

## Disabling the HTTP Server

To completely disable the HTTP Server functionality:

1. Exit Everything
2. Open `Everything.ini` (in the same directory as `Everything.exe`)
3. Change the following line:
   ```ini
   allow_http_server=1
   ```
   to:
   ```ini
   allow_http_server=0
   ```
4. Save and restart Everything

---

## Troubleshooting

### Error: Unable to start HTTP server: bind failed 10048

**Cause**: Port 80 is already occupied by another service.

**Solution**:

1. Tools → Options → HTTP Server
2. Change **Listen port** to another port (e.g., 8080)
3. Click OK
4. Access with the specified port: `http://localhost:8080`

---

## JSON Response Format Example

```json
{
  "name": "filename.txt",
  "path": "C:\\Folder\\filename.txt",
  "size": 1024,
  "date_modified": "2024-01-01T12:00:00"
}
```

---

## Reference Links

- [Everything Official Documentation](https://www.voidtools.com/support/everything/http/)
- [Everything Homepage](https://www.voidtools.com/)
