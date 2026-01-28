# qBittorrent WebUI API Documentation

> Version: qBittorrent 5.0+ / API v2.11.3
> Official Documentation: https://github.com/qbittorrent/qBittorrent/wiki/WebUI-API-(qBittorrent-5.0)

---

## Overview

All API methods follow the format: `/api/v2/APIName/methodName`

- `GET`: Query operations
- `POST`: Modify state operations
- All APIs (except login) require authentication

---

## Authentication

### Login

**Endpoint:** `/api/v2/auth/login`

**Method:** `POST`

**Parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `username` | string | WebUI username |
| `password` | string | WebUI password |

**Returns:**

| Status Code | Scenario |
|-------------|----------|
| 403 | IP disabled due to multiple login failures |
| 200 | All other scenarios |

**Response:** Returns a Cookie containing SID on success

**Example:**

```bash
curl -i --header 'Referer: http://localhost:8080' \
     --data 'username=admin&password=adminadmin' \
     http://localhost:8080/api/v2/auth/login
```

> Note: Must set `Referer` or `Origin` header to the request host address

### Logout

**Endpoint:** `/api/v2/auth/logout`

**Method:** `POST`

**Returns:** `200 OK`

---

## Query API

### Get Torrent List

**Endpoint:** `/api/v2/torrents/info`

**Method:** `GET`

**Parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `filter` | string | Status filter: `all`, `downloading`, `seeding`, `completed`, `stopped`, `active`, `inactive`, `running`, `stalled`, `stalled_uploading`, `stalled_downloading`, `errored` |
| `category` | string | Filter by category (empty string means no category, not passing means any category) |
| `tag` | string | Filter by tag (empty string means no tag, not passing means any tag) |
| `sort` | string | Sort field (any field in the response JSON array) |
| `reverse` | bool | Reverse sort |
| `limit` | integer | Limit the number of results returned |
| `offset` | integer | Set offset (negative value means offset from the end) |
| `hashes` | string | Filter by hash, multiple separated by `\|` |

**Example:**

```
GET /api/v2/torrents/info?filter=downloading&category=movies&sort=ratio
```

**Returns:** JSON array

| Field | Type | Description |
|-------|------|-------------|
| `added_on` | integer | Added time (Unix timestamp) |
| `amount_left` | integer | Remaining data (bytes) |
| `auto_tmm` | bool | Whether automatic torrent management is enabled |
| `availability` | float | Percentage of available pieces |
| `category` | string | Category |
| `completed` | integer | Completed transferred data (bytes) |
| `completion_on` | integer | Completion time (Unix timestamp) |
| `content_path` | string | Absolute path of content |
| `dl_limit` | integer | Download speed limit (bytes/s, -1 means unlimited) |
| `dlspeed` | integer | Download speed (bytes/s) |
| `downloaded` | integer | Amount of data downloaded |
| `downloaded_session` | integer | Downloaded in this session |
| `eta` | integer | Estimated completion time (seconds) |
| `f_l_piece_prio` | bool | Whether first and last pieces have priority |
| `force_start` | bool | Whether force start is enabled |
| `hash` | string | Torrent hash |
| `isPrivate` | bool | Whether from private tracker |
| `last_activity` | integer | Last activity time (Unix timestamp) |
| `magnet_uri` | string | Magnet link |
| `max_ratio` | float | Maximum share ratio |
| `max_seeding_time` | integer | Maximum seeding time (seconds) |
| `name` | string | Torrent name |
| `num_complete` | integer | Number of completers in the swarm |
| `num_incomplete` | integer | Number of incompleters in the swarm |
| `num_leechs` | integer | Number of connected leechers |
| `num_seeds` | integer | Number of connected seeds |
| `priority` | integer | Priority (-1 means queue not enabled or seeding mode) |
| `progress` | float | Progress (percentage/100) |
| `ratio` | float | Share ratio |
| `reannounce` | integer | Time to next reannounce (seconds) |
| `save_path` | string | Save path |
| `seeding_time` | integer | Seeding time (seconds) |
| `seq_dl` | bool | Whether sequential download |
| `size` | integer | Total size of selected files (bytes) |
| `state` | string | State (see table below) |
| `super_seeding` | bool | Whether super seeding |
| `tags` | string | List of tags (comma-separated) |
| `time_active` | integer | Total active time (seconds) |
| `total_size` | integer | Total size of all files (bytes) |
| `tracker` | string | First working tracker URL |
| `up_limit` | integer | Upload speed limit (bytes/s, -1 means unlimited) |
| `uploaded` | integer | Amount of data uploaded |
| `uploaded_session` | integer | Uploaded in this session |
| `upspeed` | integer | Upload speed (bytes/s) |

**State Values (state):**

| Value | Description |
|-------|-------------|
| `error` | Error occurred (paused) |
| `missingFiles` | Files missing |
| `uploading` | Uploading, data transfer in progress |
| `pausedUP` | Paused, download completed |
| `queuedUP` | Queued for upload |
| `stalledUP` | Seeding, no connections |
| `checkingUP` | Completed, checking |
| `forcedUP` | Forced upload, ignoring queue |
| `allocating` | Allocating disk space |
| `downloading` | Downloading, data transfer in progress |
| `metaDL` | Getting metadata |
| `pausedDL` | Paused, download not completed |
| `queuedDL` | Queued for download |
| `stalledDL` | Downloading, no connections |
| `checkingDL` | Checking, download not completed |
| `forcedDL` | Forced download, ignoring queue |
| `checkingResumeData` | Checking resume data on startup |
| `moving` | Moving to another location |
| `unknown` | Unknown state |

---

### Get Torrent General Properties

**Endpoint:** `/api/v2/torrents/properties`

**Method:** `GET`

**Parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `hash` | string | Torrent hash |

**Returns:** JSON object

| Field | Type | Description |
|-------|------|-------------|
| `save_path` | string | Save path |
| `creation_date` | integer | Creation date (Unix timestamp) |
| `piece_size` | integer | Piece size (bytes) |
| `comment` | string | Comment |
| `total_wasted` | integer | Wasted data (bytes) |
| `total_uploaded` | integer | Total uploaded (bytes) |
| `total_uploaded_session` | integer | Uploaded in this session (bytes) |
| `total_downloaded` | integer | Total downloaded (bytes) |
| `total_downloaded_session` | integer | Downloaded in this session (bytes) |
| `up_limit` | integer | Upload speed limit (bytes/s) |
| `dl_limit` | integer | Download speed limit (bytes/s) |
| `time_elapsed` | integer | Elapsed time (seconds) |
| `seeding_time` | integer | Seeding time (seconds) |
| `nb_connections` | integer | Number of connections |
| `nb_connections_limit` | integer | Connection limit |
| `share_ratio` | float | Share ratio |
| `addition_date` | integer | Addition date (Unix timestamp) |
| `completion_date` | integer | Completion date (Unix timestamp) |
| `created_by` | string | Creator |
| `dl_speed_avg` | integer | Average download speed (bytes/s) |
| `dl_speed` | integer | Download speed (bytes/s) |
| `eta` | integer | Estimated completion time (seconds) |
| `last_seen` | integer | Last seen complete time (Unix timestamp) |
| `peers` | integer | Number of connected peers |
| `peers_total` | integer | Total peers in swarm |
| `pieces_have` | integer | Number of pieces owned |
| `pieces_num` | integer | Total number of pieces |
| `reannounce` | integer | Time to next announce (seconds) |
| `seeds` | integer | Number of connected seeds |
| `seeds_total` | integer | Total seeds in swarm |
| `total_size` | integer | Total size (bytes) |
| `up_speed_avg` | integer | Average upload speed (bytes/s) |
| `up_speed` | integer | Upload speed (bytes/s) |
| `isPrivate` | bool | Whether private torrent |

---

### Get Torrent Trackers

**Endpoint:** `/api/v2/torrents/trackers`

**Method:** `GET`

**Parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `hash` | string | Torrent hash |

**Returns:** JSON array

| Field | Type | Description |
|-------|------|-------------|
| `url` | string | Tracker URL |
| `status` | integer | Status: 0=disabled, 1=not contacted, 2=working, 3=updating, 4=not working |
| `tier` | integer | Priority tier |
| `num_peers` | integer | Number of peers |
| `num_seeds` | integer | Number of seeds |
| `num_leeches` | integer | Number of leechers |
| `num_downloaded` | integer | Number of completed downloads |
| `msg` | string | Tracker message |

---

### Get Torrent Web Seeds

**Endpoint:** `/api/v2/torrents/webseeds`

**Method:** `GET`

**Parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `hash` | string | Torrent hash |

**Returns:** JSON array

| Field | Type | Description |
|-------|------|-------------|
| `url` | string | Web seed URL |

---

### Get Torrent File List

**Endpoint:** `/api/v2/torrents/files`

**Method:** `GET`

**Parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `hash` | string | Torrent hash |
| `indexes` | string | File indexes, multiple separated by `\|` |

**Returns:** JSON array

| Field | Type | Description |
|-------|------|-------------|
| `index` | integer | File index |
| `name` | string | File name (including relative path) |
| `size` | integer | File size (bytes) |
| `progress` | float | Download progress |
| `priority` | integer | Priority: 0=do not download, 1=normal, 6=high, 7=highest |
| `is_seed` | bool | Whether completed |
| `piece_range` | array | Piece range [start, end] |
| `availability` | float | Availability |

---

### Get Torrent Download Speed Limit

**Endpoint:** `/api/v2/torrents/downloadLimit`

**Method:** `POST`

**Parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `hashes` | string | Torrent hashes, multiple separated by `\|`, or `all` |

**Returns:** JSON object `{hash: limit}`

---

### Get Torrent Upload Speed Limit

**Endpoint:** `/api/v2/torrents/uploadLimit`

**Method:** `POST`

**Parameters:** Same as download limit

**Returns:** JSON object `{hash: limit}`

---

## Creation API

### Add New Torrent

**Endpoint:** `/api/v2/torrents/add`

**Method:** `POST` (`multipart/form-data`)

**Parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `urls` | string | List of URLs (newline separated) |
| `torrents` | raw | Raw data of torrent file (can be multiple) |
| `savepath` | string | Save directory |
| `category` | string | Category |
| `tags` | string | Tags (comma separated) |
| `skip_checking` | string | Skip checking: `true`/`false` |
| `paused` | string | Pause after adding: `true`/`false` |
| `root_folder` | string | Create root folder: `true`/`false` |
| `rename` | string | Rename torrent |
| `upLimit` | integer | Upload speed limit (bytes/s) |
| `dlLimit` | integer | Download speed limit (bytes/s) |
| `ratioLimit` | float | Share ratio limit |
| `seedingTimeLimit` | integer | Seeding time limit (minutes) |
| `autoTMM` | bool | Whether to use automatic torrent management |
| `sequentialDownload` | string | Sequential download: `true`/`false` |
| `firstLastPiecePrio` | string | First and last priority: `true`/`false` |

**Returns:**

| Status Code | Scenario |
|-------------|----------|
| 415 | Invalid torrent file |
| 200 | Success |

**Example (Add from URL):**

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

**Example (Add from file):**

```http
POST /api/v2/torrents/add HTTP/1.1
Content-Type: multipart/form-data; boundary=---------------------------acebdf13572468

---------------------------acebdf13572468
Content-Disposition: form-data; name="torrents"; filename="file.torrent"
Content-Type: application/x-bittorrent

<binary file data>
---------------------------acebdf13572468--
```

---

### Add Trackers

**Endpoint:** `/api/v2/torrents/addTrackers`

**Method:** `POST` (`application/x-www-form-urlencoded`)

**Parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `hash` | string | Torrent hash |
| `urls` | string | Tracker URLs (newline separated `%0A`) |

**Returns:**

| Status Code | Scenario |
|-------------|----------|
| 404 | Torrent not found |
| 200 | Success |

**Example:**

```http
POST /api/v2/torrents/addTrackers
hash=xxx&urls=http://tracker1.com%0Ahttp://tracker2.com
```

---

### Add Peers

**Endpoint:** `/api/v2/torrents/addPeers`

**Method:** `POST`

**Parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `hashes` | string | Torrent hashes (multiple separated by `\|`) |
| `peers` | string | Peer `host:port` (multiple separated by `\|`) |

**Returns:**

| Status Code | Scenario |
|-------------|----------|
| 400 | No valid peers |
| 200 | Success |

---

## Update API

### Pause Torrents

**Endpoint:** `/api/v2/torrents/stop`

**Method:** `POST`

**Parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `hashes` | string | Torrent hashes (multiple separated by `\|`) or `all` |

**Example:**

```
POST /api/v2/torrents/stop?hashes=hash1|hash2
```

---

### Resume Torrents

**Endpoint:** `/api/v2/torrents/start`

**Method:** `POST`

**Parameters:** Same as pause torrents

---

### Recheck Torrents

**Endpoint:** `/api/v2/torrents/recheck`

**Method:** `POST`

**Parameters:** Same as pause torrents

---

### Reannounce Torrents

**Endpoint:** `/api/v2/torrents/reannounce`

**Method:** `POST`

**Parameters:** Same as pause torrents

---

### Edit Tracker

**Endpoint:** `/api/v2/torrents/editTracker`

**Method:** `POST`

**Parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `hash` | string | Torrent hash |
| `origUrl` | string | Original tracker URL |
| `newUrl` | string | New tracker URL |

**Returns:**

| Status Code | Scenario |
|-------------|----------|
| 400 | New URL invalid |
| 404 | Torrent not found |
| 409 | New URL already exists or original URL not found |
| 200 | Success |

---

### Remove Trackers

**Endpoint:** `/api/v2/torrents/removeTrackers`

**Method:** `POST`

**Parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `hash` | string | Torrent hash |
| `urls` | string | URLs to remove (separated by `\|`) |

**Returns:**

| Status Code | Scenario |
|-------------|----------|
| 404 | Torrent not found |
| 409 | All URLs not found |
| 200 | Success |

---

### Set File Priority

**Endpoint:** `/api/v2/torrents/filePrio`

**Method:** `POST`

**Parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `hash` | string | Torrent hash |
| `id` | string | File IDs (separated by `\|`) |
| `priority` | number | Priority: 0=do not download, 1=normal, 6=high, 7=highest |

**Returns:**

| Status Code | Scenario |
|-------------|----------|
| 400 | Invalid priority or invalid ID |
| 404 | Torrent not found |
| 409 | Metadata not downloaded or ID not found |
| 200 | Success |

---

### Set Download Speed Limit

**Endpoint:** `/api/v2/torrents/setDownloadLimit`

**Method:** `POST`

**Parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `hashes` | string | Torrent hashes (multiple separated by `\|`) or `all` |
| `limit` | integer | Speed limit (bytes/s) |

**Returns:** `200 OK`

---

### Set Upload Speed Limit

**Endpoint:** `/api/v2/torrents/setUploadLimit`

**Method:** `POST`

**Parameters:** Same as download speed limit

---

### Set Share Limits

**Endpoint:** `/api/v2/torrents/setShareLimits`

**Method:** `POST`

**Parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `hashes` | string | Torrent hashes (multiple separated by `\|`) or `all` |
| `ratioLimit` | float | Share ratio limit (-2=global, -1=unlimited) |
| `seedingTimeLimit` | integer | Seeding time limit (minutes, -2=global, -1=unlimited) |
| `inactiveSeedingTimeLimit` | integer | Inactive seeding time limit (minutes) |

**Returns:**

| Status Code | Scenario |
|-------------|----------|
| 400 | Missing parameters |
| 200 | Success |

---

### Set Save Location

**Endpoint:** `/api/v2/torrents/setLocation`

**Method:** `POST`

**Parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `hashes` | string | Torrent hashes (multiple separated by `\|`) or `all` |
| `location` | string | New location |

**Returns:**

| Status Code | Scenario |
|-------------|----------|
| 400 | Path is empty |
| 403 | No write permission |
| 409 | Cannot create directory |
| 200 | Success |

---

### Set Torrent Name

**Endpoint:** `/api/v2/torrents/rename`

**Method:** `POST`

**Parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `hash` | string | Torrent hash |
| `name` | string | New name |

**Returns:**

| Status Code | Scenario |
|-------------|----------|
| 404 | Invalid torrent |
| 409 | Name is empty |
| 200 | Success |

---

### Set Category

**Endpoint:** `/api/v2/torrents/setCategory`

**Method:** `POST`

**Parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `hashes` | string | Torrent hashes (multiple separated by `\|`) or `all` |
| `category` | string | Category name |

**Returns:**

| Status Code | Scenario |
|-------------|----------|
| 409 | Category does not exist |
| 200 | Success |

---

### Add Tags

**Endpoint:** `/api/v2/torrents/addTags`

**Method:** `POST`

**Parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `hashes` | string | Torrent hashes (multiple separated by `\|`) or `all` |
| `tags` | string | Tags (comma separated) |

**Returns:** `200 OK`

---

### Remove Tags

**Endpoint:** `/api/v2/torrents/removeTags`

**Method:** `POST`

**Parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `hashes` | string | Torrent hashes (multiple separated by `\|`) or `all` |
| `tags` | string | Tags (comma separated), empty list removes all tags |

**Returns:** `200 OK`

---

### Set Auto Management

**Endpoint:** `/api/v2/torrents/setAutoManagement`

**Method:** `POST`

**Parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `hashes` | string | Torrent hashes (multiple separated by `\|`) or `all` |
| `enable` | bool | Whether to enable |

**Returns:** `200 OK`

---

### Toggle Sequential Download

**Endpoint:** `/api/v2/torrents/toggleSequentialDownload`

**Method:** `POST`

**Parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `hashes` | string | Torrent hashes (multiple separated by `\|`) or `all` |

**Returns:** `200 OK`

---

### Toggle First Last Piece Priority

**Endpoint:** `/api/v2/torrents/toggleFirstLastPiecePrio`

**Method:** `POST`

**Parameters:** Same as sequential download

**Returns:** `200 OK`

---

### Set Force Start

**Endpoint:** `/api/v2/torrents/setForceStart`

**Method:** `POST`

**Parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `hashes` | string | Torrent hashes (multiple separated by `\|`) or `all` |
| `value` | bool | Whether to force start |

**Returns:** `200 OK`

---

### Set Super Seeding

**Endpoint:** `/api/v2/torrents/setSuperSeeding`

**Method:** `POST`

**Parameters:** Same as force start

**Returns:** `200 OK`

---

### Rename File

**Endpoint:** `/api/v2/torrents/renameFile`

**Method:** `POST`

**Parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `hash` | string | Torrent hash |
| `oldPath` | string | Original path |
| `newPath` | string | New path |

**Returns:**

| Status Code | Scenario |
|-------------|----------|
| 400 | Missing newPath |
| 409 | Invalid path or already exists |
| 200 | Success |

---

### Rename Folder

**Endpoint:** `/api/v2/torrents/renameFolder`

**Method:** `POST`

**Parameters:** Same as rename file

**Returns:** Same as rename file

---

### Priority Adjustment

#### Increase Priority

**Endpoint:** `/api/v2/torrents/increasePrio`

**Method:** `POST`

**Parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `hashes` | string | Torrent hashes (multiple separated by `\|`) or `all` |

**Returns:**

| Status Code | Scenario |
|-------------|----------|
| 409 | Queue not enabled |
| 200 | Success |

#### Decrease Priority

**Endpoint:** `/api/v2/torrents/decreasePrio`

**Method/Parameters:** Same as increase priority

#### Top Priority

**Endpoint:** `/api/v2/torrents/topPrio`

**Method/Parameters:** Same as increase priority

#### Bottom Priority

**Endpoint:** `/api/v2/torrents/bottomPrio`

**Method/Parameters:** Same as increase priority

---

## Deletion API

### Delete Torrents

**Endpoint:** `/api/v2/torrents/delete`

**Method:** `POST`

**Parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `hashes` | string | Torrent hashes (multiple separated by `\|`) or `all` |
| `deleteFiles` | bool | Whether to delete downloaded data as well |

**Example:**

```
POST /api/v2/torrents/delete?hashes=hash1|hash2&deleteFiles=false
```

**Returns:** `200 OK`

---

## Category Management

### Get All Categories

**Endpoint:** `/api/v2/torrents/categories`

**Method:** `GET`

**Returns:** JSON object

```json
{
  "Video": {
    "name": "Video",
    "savePath": "/home/user/torrents/video/"
  }
}
```

---

### Create Category

**Endpoint:** `/api/v2/torrents/createCategory`

**Method:** `POST`

**Parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `category` | string | Category name |
| `savePath` | string | Save path |

**Returns:**

| Status Code | Scenario |
|-------------|----------|
| 400 | Category name is empty |
| 409 | Category name is invalid |
| 200 | Success |

---

### Edit Category

**Endpoint:** `/api/v2/torrents/editCategory`

**Method:** `POST`

**Parameters:** Same as create category

**Returns:**

| Status Code | Scenario |
|-------------|----------|
| 400 | Category name is empty |
| 409 | Edit failed |
| 200 | Success |

---

### Delete Categories

**Endpoint:** `/api/v2/torrents/removeCategories`

**Method:** `POST`

**Parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `categories` | string | Category list (newline separated `%0A`) |

**Returns:** `200 OK`

---

## Tag Management

### Get All Tags

**Endpoint:** `/api/v2/torrents/tags`

**Method:** `GET`

**Returns:** JSON array

---

### Create Tags

**Endpoint:** `/api/v2/torrents/createTags`

**Method:** `POST`

**Parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `tags` | string | Tag list (comma separated) |

**Returns:** `200 OK`

---

### Delete Tags

**Endpoint:** `/api/v2/torrents/deleteTags`

**Method:** `POST`

**Parameters:** Same as create tags

**Returns:** `200 OK`

---

## Sync API

### Get Main Data

**Endpoint:** `/api/v2/sync/maindata`

**Method:** `GET`

**Parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `rid` | integer | Response ID (default 0) |

**Returns:** JSON object

| Field | Type | Description |
|-------|------|-------------|
| `rid` | integer | Response ID |
| `full_update` | bool | Whether full update |
| `torrents` | object | Torrent data |
| `torrents_removed` | array | Removed torrent hashes |
| `categories` | object | New categories |
| `categories_removed` | array | Removed categories |
| `tags` | array | New tags |
| `tags_removed` | array | Removed tags |
| `server_state` | object | Global transfer information |

---

## Transfer Information

### Get Global Transfer Information

**Endpoint:** `/api/v2/transfer/info`

**Method:** `GET`

**Returns:** JSON object

| Field | Type | Description |
|-------|------|-------------|
| `dl_info_speed` | integer | Global download speed (bytes/s) |
| `dl_info_data` | integer | Downloaded in this session (bytes) |
| `up_info_speed` | integer | Global upload speed (bytes/s) |
| `up_info_data` | integer | Uploaded in this session (bytes) |
| `dl_rate_limit` | integer | Download speed limit (bytes/s) |
| `up_rate_limit` | integer | Upload speed limit (bytes/s) |
| `dht_nodes` | integer | DHT node count |
| `connection_status` | string | Connection status: `connected`/`firewalled`/`disconnected` |

---

## Quick Reference

| Operation | Endpoint | Method |
|-----------|----------|--------|
| Get torrent list | `/api/v2/torrents/info` | GET |
| Get torrent properties | `/api/v2/torrents/properties` | GET |
| Get file list | `/api/v2/torrents/files` | GET |
| Add torrent | `/api/v2/torrents/add` | POST |
| Pause torrent | `/api/v2/torrents/stop` | POST |
| Resume torrent | `/api/v2/torrents/start` | POST |
| Delete torrent | `/api/v2/torrents/delete` | POST |
| Set speed limit | `/api/v2/torrents/setDownloadLimit` | POST |
| Set location | `/api/v2/torrents/setLocation` | POST |
| Set category | `/api/v2/torrents/setCategory` | POST |
| Add tags | `/api/v2/torrents/addTags` | POST |

---

## HTTP Status Code Reference

| Status Code | Description |
|-------------|-------------|
| 200 | Success |
| 400 | Invalid request parameters |
| 403 | Forbidden |
| 404 | Resource not found |
| 409 | Operation conflict (e.g., queue not enabled) |
| 415 | Unsupported media type |
| 500 | Internal server error |
