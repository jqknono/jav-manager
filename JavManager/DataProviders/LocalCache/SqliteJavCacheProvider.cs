using JavManager.Core.Interfaces;
using JavManager.Core.Models;
using JavManager.Core.Configuration.ConfigSections;
using Microsoft.Data.Sqlite;
using Newtonsoft.Json;
using System.Security.Cryptography;
using System.Text.RegularExpressions;

namespace JavManager.DataProviders.LocalCache;

/// <summary>
/// SQLite 本地缓存提供者
/// </summary>
public class SqliteJavCacheProvider : IJavLocalCacheProvider
{
    private const string JavInfoTable = "JavInfo";
    private readonly string _dbPath;
    private readonly LocalCacheConfig _config;
    private static readonly JsonSerializerSettings JsonSettings = new()
    {
        NullValueHandling = NullValueHandling.Ignore
    };

    public SqliteJavCacheProvider(LocalCacheConfig config)
    {
        _config = config;
        _dbPath = GetDatabasePath();
    }

    private string GetDatabasePath()
    {
        if (!string.IsNullOrWhiteSpace(_config.DatabasePath))
        {
            return _config.DatabasePath;
        }

        // 默认存储在应用目录下
        var appDir = AppContext.BaseDirectory;
        return Path.Combine(appDir, "jav_cache.db");
    }

    private SqliteConnection CreateConnection()
    {
        var builder = new SqliteConnectionStringBuilder
        {
            DataSource = _dbPath,
            Mode = SqliteOpenMode.ReadWriteCreate,
            Cache = SqliteCacheMode.Shared
        };
        return new SqliteConnection(builder.ToString());
    }

    /// <summary>
    /// 初始化数据库
    /// </summary>
    public async Task InitializeAsync()
    {
        // 确保目录存在
        var dir = Path.GetDirectoryName(_dbPath);
        if (!string.IsNullOrEmpty(dir) && !Directory.Exists(dir))
        {
            Directory.CreateDirectory(dir);
        }

        await using var connection = CreateConnection();
        await connection.OpenAsync();

        await ExecuteNonQueryAsync(
            connection,
            $"""
             CREATE TABLE IF NOT EXISTS {JavInfoTable} (
                 Id INTEGER PRIMARY KEY AUTOINCREMENT,
                 JavId TEXT NOT NULL,
                 Title TEXT NOT NULL,
                 CoverUrl TEXT NOT NULL,
                 ReleaseDate TEXT NULL,
                 Duration INTEGER NOT NULL,
                 Director TEXT NOT NULL,
                 Maker TEXT NOT NULL,
                 Publisher TEXT NOT NULL,
                 Series TEXT NOT NULL,
                 DetailUrl TEXT NOT NULL,
                 CreatedAt TEXT NOT NULL,
                 UpdatedAt TEXT NOT NULL,
                 ActorsJson TEXT NOT NULL DEFAULT '[]',
                 CategoriesJson TEXT NOT NULL DEFAULT '[]',
                 TorrentsJson TEXT NOT NULL DEFAULT '[]',
                 TorrentCount INTEGER NOT NULL DEFAULT 0
             );
             """);

        await ExecuteNonQueryAsync(connection, $"CREATE UNIQUE INDEX IF NOT EXISTS IX_{JavInfoTable}_JavId ON {JavInfoTable}(JavId);");

        // Back-compat: ensure new columns exist even if DB was created by older EF schema.
        await EnsureColumnAsync(connection, "ActorsJson", "TEXT NOT NULL DEFAULT '[]'");
        await EnsureColumnAsync(connection, "CategoriesJson", "TEXT NOT NULL DEFAULT '[]'");
        await EnsureColumnAsync(connection, "TorrentsJson", "TEXT NOT NULL DEFAULT '[]'");
        await EnsureColumnAsync(connection, "TorrentCount", "INTEGER NOT NULL DEFAULT 0");

        var migrated = await TryMigrateLegacyTablesAsync(connection);
        if (migrated)
        {
            await DropLegacyTablesAsync(connection);
        }
        else
        {
            // If legacy tables exist but are empty, remove them so the cache is truly "single-table".
            await TryDropLegacyTablesIfEmptyAsync(connection);
        }
    }

    /// <summary>
    /// 从本地缓存获取 JAV 信息
    /// </summary>
    public async Task<JavSearchResult?> GetAsync(string javId)
    {
        var normalizedId = NormalizeJavId(javId);
        
        await using var connection = CreateConnection();
        await connection.OpenAsync();

        await using var command = connection.CreateCommand();
        command.CommandText =
            $"""
             SELECT
                 JavId,
                 Title,
                 CoverUrl,
                 ReleaseDate,
                 Duration,
                 Director,
                 Maker,
                 Publisher,
                 Series,
                 DetailUrl,
                 UpdatedAt,
                 ActorsJson,
                 CategoriesJson,
                 TorrentsJson
             FROM {JavInfoTable}
             WHERE JavId = $javId
             LIMIT 1;
             """;
        command.Parameters.AddWithValue("$javId", normalizedId);

        await using var reader = await command.ExecuteReaderAsync();
        if (!await reader.ReadAsync())
            return null;

        var result = new JavSearchResult
        {
            JavId = reader.GetString(0),
            Title = reader.GetString(1),
            CoverUrl = reader.GetString(2),
            ReleaseDate = TryParseDate(reader.IsDBNull(3) ? null : reader.GetString(3)) ?? DateTime.MinValue,
            Duration = reader.GetInt32(4),
            Director = reader.GetString(5),
            Maker = reader.GetString(6),
            Publisher = reader.GetString(7),
            Series = reader.GetString(8),
            DetailUrl = reader.GetString(9),
            DataSource = "Local"
        };

        var updatedAtText = reader.IsDBNull(10) ? null : reader.GetString(10);
        result.CachedAt = TryParseDateTime(updatedAtText);

        var actorsJson = reader.IsDBNull(11) ? "[]" : reader.GetString(11);
        var categoriesJson = reader.IsDBNull(12) ? "[]" : reader.GetString(12);
        var torrentsJson = reader.IsDBNull(13) ? "[]" : reader.GetString(13);

        result.Actors = DeserializeList<string>(actorsJson);
        result.Categories = DeserializeList<string>(categoriesJson);
        result.Torrents = DeserializeList<TorrentInfo>(torrentsJson);

        return result;
    }

    /// <summary>
    /// 保存 JAV 信息到本地缓存
    /// </summary>
    public async Task SaveAsync(JavSearchResult result)
    {
        var normalizedId = NormalizeJavId(result.JavId);
        if (string.IsNullOrWhiteSpace(normalizedId))
            throw new ArgumentException("JavId is required.", nameof(result));

        await using var connection = CreateConnection();
        await connection.OpenAsync();
        await using var transaction = connection.BeginTransaction();

        var now = DateTime.UtcNow;
        var nowText = now.ToString("O");

        var releaseDateText = result.ReleaseDate == DateTime.MinValue ? null : result.ReleaseDate.ToString("yyyy-MM-dd");
        var actorsJson = JsonConvert.SerializeObject(result.Actors ?? new List<string>(), JsonSettings);
        var categoriesJson = JsonConvert.SerializeObject(result.Categories ?? new List<string>(), JsonSettings);
        var torrentsJson = JsonConvert.SerializeObject(result.Torrents ?? new List<TorrentInfo>(), JsonSettings);
        var torrentCount = result.Torrents?.Count ?? 0;

        await using (var command = connection.CreateCommand())
        {
            command.Transaction = transaction;
            command.CommandText =
                $"""
                 INSERT INTO {JavInfoTable} (
                     JavId,
                     Title,
                     CoverUrl,
                     ReleaseDate,
                     Duration,
                     Director,
                     Maker,
                     Publisher,
                     Series,
                     DetailUrl,
                     CreatedAt,
                     UpdatedAt,
                     ActorsJson,
                     CategoriesJson,
                     TorrentsJson,
                     TorrentCount
                 )
                 VALUES (
                     $javId,
                     $title,
                     $coverUrl,
                     $releaseDate,
                     $duration,
                     $director,
                     $maker,
                     $publisher,
                     $series,
                     $detailUrl,
                     $createdAt,
                     $updatedAt,
                     $actorsJson,
                     $categoriesJson,
                     $torrentsJson,
                     $torrentCount
                 )
                 ON CONFLICT(JavId) DO UPDATE SET
                     Title = excluded.Title,
                     CoverUrl = excluded.CoverUrl,
                     ReleaseDate = excluded.ReleaseDate,
                     Duration = excluded.Duration,
                     Director = excluded.Director,
                     Maker = excluded.Maker,
                     Publisher = excluded.Publisher,
                     Series = excluded.Series,
                     DetailUrl = excluded.DetailUrl,
                     UpdatedAt = excluded.UpdatedAt,
                     ActorsJson = excluded.ActorsJson,
                     CategoriesJson = excluded.CategoriesJson,
                     TorrentsJson = excluded.TorrentsJson,
                     TorrentCount = excluded.TorrentCount;
                 """;

            command.Parameters.AddWithValue("$javId", normalizedId);
            command.Parameters.AddWithValue("$title", result.Title ?? string.Empty);
            command.Parameters.AddWithValue("$coverUrl", result.CoverUrl ?? string.Empty);
            command.Parameters.AddWithValue("$releaseDate", (object?)releaseDateText ?? DBNull.Value);
            command.Parameters.AddWithValue("$duration", result.Duration);
            command.Parameters.AddWithValue("$director", result.Director ?? string.Empty);
            command.Parameters.AddWithValue("$maker", result.Maker ?? string.Empty);
            command.Parameters.AddWithValue("$publisher", result.Publisher ?? string.Empty);
            command.Parameters.AddWithValue("$series", result.Series ?? string.Empty);
            command.Parameters.AddWithValue("$detailUrl", result.DetailUrl ?? string.Empty);
            command.Parameters.AddWithValue("$createdAt", nowText);
            command.Parameters.AddWithValue("$updatedAt", nowText);
            command.Parameters.AddWithValue("$actorsJson", actorsJson);
            command.Parameters.AddWithValue("$categoriesJson", categoriesJson);
            command.Parameters.AddWithValue("$torrentsJson", torrentsJson);
            command.Parameters.AddWithValue("$torrentCount", torrentCount);

            await command.ExecuteNonQueryAsync();
        }

        await UpdateCategoryColumnsAsync(connection, transaction, normalizedId, result.Categories ?? new List<string>());
        await transaction.CommitAsync();
    }

    /// <summary>
    /// 更新种子列表
    /// </summary>
    public async Task UpdateTorrentsAsync(string javId, List<TorrentInfo> torrents)
    {
        var normalizedId = NormalizeJavId(javId);
        
        await using var connection = CreateConnection();
        await connection.OpenAsync();

        var nowText = DateTime.UtcNow.ToString("O");
        var torrentsJson = JsonConvert.SerializeObject(torrents ?? new List<TorrentInfo>(), JsonSettings);
        var torrentCount = torrents?.Count ?? 0;

        await using var command = connection.CreateCommand();
        command.CommandText =
            $"""
             UPDATE {JavInfoTable}
             SET
                 TorrentsJson = $torrentsJson,
                 TorrentCount = $torrentCount,
                 UpdatedAt = $updatedAt
             WHERE JavId = $javId;
             """;
        command.Parameters.AddWithValue("$javId", normalizedId);
        command.Parameters.AddWithValue("$torrentsJson", torrentsJson);
        command.Parameters.AddWithValue("$torrentCount", torrentCount);
        command.Parameters.AddWithValue("$updatedAt", nowText);
        await command.ExecuteNonQueryAsync();
    }

    /// <summary>
    /// 检查缓存是否存在
    /// </summary>
    public async Task<bool> ExistsAsync(string javId)
    {
        var normalizedId = NormalizeJavId(javId);
        
        await using var connection = CreateConnection();
        await connection.OpenAsync();

        await using var command = connection.CreateCommand();
        command.CommandText = $"SELECT 1 FROM {JavInfoTable} WHERE JavId = $javId LIMIT 1;";
        command.Parameters.AddWithValue("$javId", normalizedId);
        var obj = await command.ExecuteScalarAsync();
        return obj != null && obj != DBNull.Value;
    }

    /// <summary>
    /// 删除缓存
    /// </summary>
    public async Task DeleteAsync(string javId)
    {
        var normalizedId = NormalizeJavId(javId);
        
        await using var connection = CreateConnection();
        await connection.OpenAsync();

        await using var command = connection.CreateCommand();
        command.CommandText = $"DELETE FROM {JavInfoTable} WHERE JavId = $javId;";
        command.Parameters.AddWithValue("$javId", normalizedId);
        await command.ExecuteNonQueryAsync();
    }

    /// <summary>
    /// 获取缓存统计信息
    /// </summary>
    public async Task<CacheStatistics> GetStatisticsAsync()
    {
        await using var connection = CreateConnection();
        await connection.OpenAsync();

        var javCount = await ExecuteScalarIntAsync(connection, $"SELECT COUNT(*) FROM {JavInfoTable};");
        var torrentCount = await ExecuteScalarIntAsync(connection, $"SELECT COALESCE(SUM(TorrentCount), 0) FROM {JavInfoTable};");

        string? lastUpdatedText;
        await using (var command = connection.CreateCommand())
        {
            command.CommandText = $"SELECT UpdatedAt FROM {JavInfoTable} ORDER BY UpdatedAt DESC LIMIT 1;";
            lastUpdatedText = (await command.ExecuteScalarAsync())?.ToString();
        }
        var lastUpdated = TryParseDateTime(lastUpdatedText);

        var dbSize = 0L;
        if (File.Exists(_dbPath))
        {
            dbSize = new FileInfo(_dbPath).Length;
        }

        return new CacheStatistics
        {
            TotalJavCount = javCount,
            TotalTorrentCount = torrentCount,
            DatabaseSizeBytes = dbSize,
            LastUpdatedAt = lastUpdated
        };
    }

    #region Private Helpers

    private static string NormalizeJavId(string javId)
    {
        if (string.IsNullOrWhiteSpace(javId))
            return string.Empty;

        // 转大写，去除多余空格
        var normalized = javId.Trim().ToUpperInvariant();
        
        // 处理缺少连字符的情况: ABC123 -> ABC-123
        if (!normalized.Contains('-'))
        {
            var match = Regex.Match(normalized, @"^([A-Z]+)(\d+)$");
            if (match.Success)
            {
                normalized = $"{match.Groups[1].Value}-{match.Groups[2].Value}";
            }
        }

        return normalized;
    }

    private static async Task ExecuteNonQueryAsync(SqliteConnection connection, string sql)
    {
        await using var command = connection.CreateCommand();
        command.CommandText = sql;
        await command.ExecuteNonQueryAsync();
    }

    private static async Task<int> ExecuteScalarIntAsync(SqliteConnection connection, string sql)
    {
        await using var command = connection.CreateCommand();
        command.CommandText = sql;
        var obj = await command.ExecuteScalarAsync();
        if (obj == null || obj == DBNull.Value)
            return 0;
        return Convert.ToInt32(obj);
    }

    private static async Task TryDropLegacyTablesIfEmptyAsync(SqliteConnection connection)
    {
        var existingTables = await GetTableNamesAsync(connection);
        var legacyTables = new[] { "JavActors", "JavCategories", "Torrents" };

        foreach (var legacy in legacyTables)
        {
            if (!existingTables.Contains(legacy))
                continue;

            try
            {
                var count = await ExecuteScalarIntAsync(connection, $"SELECT COUNT(*) FROM {legacy};");
                if (count == 0)
                    await ExecuteNonQueryAsync(connection, $"DROP TABLE IF EXISTS {legacy};");
            }
            catch
            {
                // Best-effort cleanup only.
            }
        }
    }

    private static async Task DropLegacyTablesAsync(SqliteConnection connection)
    {
        var legacyTables = new[] { "JavActors", "JavCategories", "Torrents" };
        foreach (var legacy in legacyTables)
        {
            try
            {
                await ExecuteNonQueryAsync(connection, $"DROP TABLE IF EXISTS {legacy};");
            }
            catch
            {
                // Best-effort cleanup only.
            }
        }
    }

    private static async Task<bool> TryMigrateLegacyTablesAsync(SqliteConnection connection)
    {
        var existingTables = await GetTableNamesAsync(connection);
        if (!existingTables.Contains("JavActors") &&
            !existingTables.Contains("JavCategories") &&
            !existingTables.Contains("Torrents"))
            return false;

        var legacyHasRows = false;
        foreach (var table in new[] { "JavActors", "JavCategories", "Torrents" })
        {
            if (!existingTables.Contains(table))
                continue;

            try
            {
                var count = await ExecuteScalarIntAsync(connection, $"SELECT COUNT(*) FROM {table};");
                if (count > 0)
                {
                    legacyHasRows = true;
                    break;
                }
            }
            catch
            {
                // Ignore; migration is best-effort.
            }
        }

        if (!legacyHasRows)
            return false;

        try
        {
            await using var transaction = connection.BeginTransaction();

            var rows = new List<(int Id, string JavId, string ActorsJson, string CategoriesJson, string TorrentsJson)>();
            await using (var select = connection.CreateCommand())
            {
                select.Transaction = transaction;
                select.CommandText = $"SELECT Id, JavId, ActorsJson, CategoriesJson, TorrentsJson FROM {JavInfoTable};";
                await using var reader = await select.ExecuteReaderAsync();
                while (await reader.ReadAsync())
                {
                    rows.Add((
                        reader.GetInt32(0),
                        reader.GetString(1),
                        reader.IsDBNull(2) ? "[]" : reader.GetString(2),
                        reader.IsDBNull(3) ? "[]" : reader.GetString(3),
                        reader.IsDBNull(4) ? "[]" : reader.GetString(4)
                    ));
                }
            }

            foreach (var row in rows)
            {
                var needsActors = row.ActorsJson == "[]" || string.IsNullOrWhiteSpace(row.ActorsJson);
                var needsCategories = row.CategoriesJson == "[]" || string.IsNullOrWhiteSpace(row.CategoriesJson);
                var needsTorrents = row.TorrentsJson == "[]" || string.IsNullOrWhiteSpace(row.TorrentsJson);

                if (!needsActors && !needsCategories && !needsTorrents)
                    continue;

                var actors = needsActors ? await ReadLegacyStringsAsync(connection, transaction, "JavActors", row.Id) : DeserializeList<string>(row.ActorsJson);
                var categories = needsCategories ? await ReadLegacyStringsAsync(connection, transaction, "JavCategories", row.Id) : DeserializeList<string>(row.CategoriesJson);
                var torrents = needsTorrents ? await ReadLegacyTorrentsAsync(connection, transaction, row.Id) : DeserializeList<TorrentInfo>(row.TorrentsJson);

                var actorsJson = JsonConvert.SerializeObject(actors, JsonSettings);
                var categoriesJson = JsonConvert.SerializeObject(categories, JsonSettings);
                var torrentsJson = JsonConvert.SerializeObject(torrents, JsonSettings);
                var torrentCount = torrents.Count;

                await using (var update = connection.CreateCommand())
                {
                    update.Transaction = transaction;
                    update.CommandText =
                        $"""
                         UPDATE {JavInfoTable}
                         SET
                             ActorsJson = $actorsJson,
                             CategoriesJson = $categoriesJson,
                             TorrentsJson = $torrentsJson,
                             TorrentCount = $torrentCount
                         WHERE Id = $id;
                         """;
                    update.Parameters.AddWithValue("$actorsJson", actorsJson);
                    update.Parameters.AddWithValue("$categoriesJson", categoriesJson);
                    update.Parameters.AddWithValue("$torrentsJson", torrentsJson);
                    update.Parameters.AddWithValue("$torrentCount", torrentCount);
                    update.Parameters.AddWithValue("$id", row.Id);
                    await update.ExecuteNonQueryAsync();
                }

                await UpdateCategoryColumnsAsync(connection, transaction, row.JavId, categories);
            }

            await transaction.CommitAsync();
            return true;
        }
        catch
        {
            return false;
        }
    }

    private static async Task<List<string>> ReadLegacyStringsAsync(
        SqliteConnection connection,
        SqliteTransaction transaction,
        string tableName,
        int javInfoId)
    {
        var list = new List<string>();
        if (tableName != "JavActors" && tableName != "JavCategories")
            return list;

        await using var command = connection.CreateCommand();
        command.Transaction = transaction;
        command.CommandText = $"SELECT Name FROM {tableName} WHERE JavInfoId = $id ORDER BY Id ASC;";
        command.Parameters.AddWithValue("$id", javInfoId);
        await using var reader = await command.ExecuteReaderAsync();
        while (await reader.ReadAsync())
        {
            var name = reader.IsDBNull(0) ? string.Empty : reader.GetString(0);
            if (!string.IsNullOrWhiteSpace(name))
                list.Add(name);
        }

        return list;
    }

    private static async Task<List<TorrentInfo>> ReadLegacyTorrentsAsync(
        SqliteConnection connection,
        SqliteTransaction transaction,
        int javInfoId)
    {
        var list = new List<TorrentInfo>();

        await using var command = connection.CreateCommand();
        command.Transaction = transaction;
        command.CommandText =
            """
            SELECT
                Title,
                MagnetLink,
                TorrentUrl,
                Size,
                HasUncensoredMarker,
                UncensoredMarkerType,
                HasSubtitle,
                HasHd,
                Seeders,
                Leechers,
                SourceSite
            FROM Torrents
            WHERE JavInfoId = $id
            ORDER BY Id ASC;
            """;
        command.Parameters.AddWithValue("$id", javInfoId);

        await using var reader = await command.ExecuteReaderAsync();
        while (await reader.ReadAsync())
        {
            var uncensoredMarkerType = reader.IsDBNull(5) ? 0 : reader.GetInt32(5);
            list.Add(new TorrentInfo
            {
                Title = reader.IsDBNull(0) ? string.Empty : reader.GetString(0),
                MagnetLink = reader.IsDBNull(1) ? string.Empty : reader.GetString(1),
                TorrentUrl = reader.IsDBNull(2) ? string.Empty : reader.GetString(2),
                Size = reader.IsDBNull(3) ? 0 : reader.GetInt64(3),
                HasUncensoredMarker = !reader.IsDBNull(4) && reader.GetBoolean(4),
                UncensoredMarkerType = (UncensoredMarkerType)uncensoredMarkerType,
                HasSubtitle = !reader.IsDBNull(6) && reader.GetBoolean(6),
                HasHd = !reader.IsDBNull(7) && reader.GetBoolean(7),
                Seeders = reader.IsDBNull(8) ? 0 : reader.GetInt32(8),
                Leechers = reader.IsDBNull(9) ? 0 : reader.GetInt32(9),
                SourceSite = reader.IsDBNull(10) ? string.Empty : reader.GetString(10)
            });
        }

        return list;
    }

    private static async Task<HashSet<string>> GetTableNamesAsync(SqliteConnection connection)
    {
        var tables = new HashSet<string>(StringComparer.OrdinalIgnoreCase);
        await using var command = connection.CreateCommand();
        command.CommandText = "SELECT name FROM sqlite_master WHERE type='table';";
        await using var reader = await command.ExecuteReaderAsync();
        while (await reader.ReadAsync())
        {
            tables.Add(reader.GetString(0));
        }

        return tables;
    }

    private static async Task EnsureColumnAsync(SqliteConnection connection, string columnName, string columnDefinition)
    {
        var existing = await GetColumnNamesAsync(connection);
        if (existing.Contains(columnName))
            return;

        await using var command = connection.CreateCommand();
        command.CommandText = $"ALTER TABLE {JavInfoTable} ADD COLUMN {QuoteIdentifier(columnName)} {columnDefinition};";
        await command.ExecuteNonQueryAsync();
    }

    private static async Task<HashSet<string>> GetColumnNamesAsync(SqliteConnection connection)
    {
        var cols = new HashSet<string>(StringComparer.OrdinalIgnoreCase);
        await using var command = connection.CreateCommand();
        command.CommandText = $"PRAGMA table_info('{JavInfoTable}');";
        await using var reader = await command.ExecuteReaderAsync();
        while (await reader.ReadAsync())
        {
            var name = reader.GetString(1);
            cols.Add(name);
        }

        return cols;
    }

    private static async Task<List<string>> GetCategoryColumnNamesAsync(SqliteConnection connection, SqliteTransaction transaction)
    {
        var list = new List<string>();
        await using var command = connection.CreateCommand();
        command.Transaction = transaction;
        command.CommandText = $"PRAGMA table_info('{JavInfoTable}');";
        await using var reader = await command.ExecuteReaderAsync();
        while (await reader.ReadAsync())
        {
            var name = reader.GetString(1);
            if (name.StartsWith("Cat_", StringComparison.OrdinalIgnoreCase))
                list.Add(name);
        }

        return list;
    }

    private static async Task UpdateCategoryColumnsAsync(
        SqliteConnection connection,
        SqliteTransaction transaction,
        string javId,
        IReadOnlyList<string> categories)
    {
        var normalizedCategories = categories
            .Select(c => (c ?? string.Empty).Trim())
            .Where(c => !string.IsNullOrWhiteSpace(c))
            .Distinct(StringComparer.OrdinalIgnoreCase)
            .ToList();

        if (normalizedCategories.Count == 0)
        {
            // Still clear existing flags so updates don't leave stale categories.
            var existingColumns = await GetCategoryColumnNamesAsync(connection, transaction);
            if (existingColumns.Count > 0)
                await UpdateCategoryFlagsAsync(connection, transaction, javId, existingColumns, Array.Empty<string>());
            return;
        }

        var existing = await GetCategoryColumnNamesAsync(connection, transaction);
        var existingSet = new HashSet<string>(existing, StringComparer.OrdinalIgnoreCase);

        var desiredColumns = normalizedCategories
            .Select(GetCategoryColumnName)
            .Distinct(StringComparer.OrdinalIgnoreCase)
            .ToList();

        foreach (var col in desiredColumns)
        {
            if (existingSet.Contains(col))
                continue;

            await using var alter = connection.CreateCommand();
            alter.Transaction = transaction;
            alter.CommandText = $"ALTER TABLE {JavInfoTable} ADD COLUMN {QuoteIdentifier(col)} INTEGER NOT NULL DEFAULT 0;";
            await alter.ExecuteNonQueryAsync();
            existing.Add(col);
            existingSet.Add(col);
        }

        await UpdateCategoryFlagsAsync(connection, transaction, javId, existing, desiredColumns);
    }

    private static async Task UpdateCategoryFlagsAsync(
        SqliteConnection connection,
        SqliteTransaction transaction,
        string javId,
        IReadOnlyList<string> allCategoryColumns,
        IReadOnlyList<string> enabledColumns)
    {
        if (allCategoryColumns.Count == 0)
            return;

        // Clear all category flags for this row first.
        var clearSet = string.Join(", ", allCategoryColumns.Select(c => $"{QuoteIdentifier(c)} = 0"));
        await using (var clear = connection.CreateCommand())
        {
            clear.Transaction = transaction;
            clear.CommandText = $"UPDATE {JavInfoTable} SET {clearSet} WHERE JavId = $javId;";
            clear.Parameters.AddWithValue("$javId", javId);
            await clear.ExecuteNonQueryAsync();
        }

        if (enabledColumns.Count == 0)
            return;

        var enableSet = string.Join(", ", enabledColumns.Select(c => $"{QuoteIdentifier(c)} = 1"));
        await using var enable = connection.CreateCommand();
        enable.Transaction = transaction;
        enable.CommandText = $"UPDATE {JavInfoTable} SET {enableSet} WHERE JavId = $javId;";
        enable.Parameters.AddWithValue("$javId", javId);
        await enable.ExecuteNonQueryAsync();
    }

    private static string GetCategoryColumnName(string category)
    {
        var raw = (category ?? string.Empty).Trim();
        if (string.IsNullOrWhiteSpace(raw))
            return "Cat_Unknown";

        var sanitized = Regex.Replace(raw, @"\s+", "_");
        sanitized = Regex.Replace(sanitized, @"[^\p{L}\p{Nd}_]+", "_");
        sanitized = sanitized.Trim('_');
        if (string.IsNullOrWhiteSpace(sanitized))
            sanitized = "Unknown";

        if (sanitized.Length <= 40)
            return $"Cat_{sanitized}";

        var hash = ShortHash(raw);
        sanitized = sanitized[..40];
        return $"Cat_{sanitized}_{hash}";
    }

    private static string ShortHash(string input)
    {
        var bytes = SHA1.HashData(System.Text.Encoding.UTF8.GetBytes(input));
        return Convert.ToHexString(bytes).Substring(0, 8);
    }

    private static string QuoteIdentifier(string identifier)
        => $"[{identifier.Replace("]", "]]")}]";

    private static List<T> DeserializeList<T>(string json)
    {
        try
        {
            var list = JsonConvert.DeserializeObject<List<T>>(json);
            return list ?? new List<T>();
        }
        catch
        {
            return new List<T>();
        }
    }

    private static DateTime? TryParseDate(string? text)
    {
        if (string.IsNullOrWhiteSpace(text))
            return null;
        return DateTime.TryParse(text, out var dt) ? dt : null;
    }

    private static DateTime? TryParseDateTime(string? text)
    {
        if (string.IsNullOrWhiteSpace(text))
            return null;
        return DateTime.TryParse(text, out var dt) ? dt : null;
    }

    #endregion
}
