# Cloudflare Access Guide

JavDB uses Cloudflare protection to prevent automated access. JavManager uses **curl-impersonate** by default to mimic real browser TLS/HTTP2 fingerprints (no browser automation, no browser cookie import).

## Default Strategy: curl-impersonate

JavManager uses:

- **curl-impersonate**: `curl_easy_impersonate()` to match browser TLS/HTTP2 fingerprints
- **Built-in default headers**: when `DefaultHeaders=true` (recommended)
- **Session/Preference cookies**: `over18=1`, `locale=zh` (not for Cloudflare bypass)
- **Human-like behavior**: small random delays between requests
- **Automatic retries**: tries base site + mirrors with exponential backoff

In most cases, this is sufficient to access JavDB without any extra configuration.

## Configuration

```json
{
  "JavDb": {
    "CurlImpersonate": {
      "Enabled": true,
      "Target": "chrome116",
      "LibraryPath": "",
      "CaBundlePath": "",
      "DefaultHeaders": true
    }
  }
}
```

Notes:
- On Windows, the lexiforest build ships a patched **`libcurl.dll`** and typically needs a CA bundle (**`cacert.pem`**). JavManager will auto-detect a bundled `cacert.pem` under `JavManager/native/curl-impersonate/<rid>/`.
- On Windows, you can vendor the files automatically by running: `scripts/fetch-curl-impersonate-libs.ps1`
- On Linux/macOS, `libcurl-impersonate` is built from source (git submodule) in CI and bundled into release builds. For local builds on Linux/macOS, run: `bash scripts/build-curl-impersonate.sh <rid>`

## Fallback Strategy (Optional): HttpClient best-effort

If `JavDb:CurlImpersonate:Enabled` is disabled, or the native library cannot be loaded, JavManager falls back to a best-effort HttpClient header spoofing mode. This mode may still be blocked by Cloudflare.

## Node.js/TypeScript Version

**Note**: The Node.js version currently has limited Cloudflare bypass capabilities due to incomplete curl-impersonate binaries.

### Current Implementation Status

The Node.js implementation includes a multi-tier fallback strategy:

1. **curl-impersonate** (when available): Attempts to use bundled binaries from `third_party/curl-impersonate/`
2. **System curl** (fallback): Uses system curl with enhanced headers
3. **Enhanced fetch** (final fallback): Uses Node.js fetch with sophisticated Cloudflare bypass headers

### Limitations

The bundled curl-impersonate binaries in `third_party/curl-impersonate/` are incomplete - they are wrapper scripts (`.bat` files on Windows) that require a `curl.exe` which doesn't exist. The .NET version uses `libcurl.dll` directly, which provides full TLS fingerprinting capabilities.

### How It Works

The Node.js implementation uses a cascading fallback approach:

1. **Try curl-impersonate**: If `JavDb:CurlImpersonate:Enabled` is `true` and binaries are available
2. **Try system curl**: If curl-impersonate fails, uses system curl with enhanced headers
3. **Enhanced fetch**: Final fallback with sophisticated headers including:
   - Modern Chrome User-Agent
   - Client Hints (`sec-ch-ua-*`)
   - Sec-Fetch-* headers
   - Proper Accept/Accept-Encoding headers

### Configuration

```json
{
  "JavDb": {
    "CurlImpersonate": {
      "Enabled": true,
      "Target": "chrome116",
      "LibraryPath": "",
      "CaBundlePath": "",
      "DefaultHeaders": true
    }
  }
}
```

### Recommended Workaround

For reliable Cloudflare bypass, **use the .NET version** instead:

```bash
dotnet run --project JavManager/JavManager.csproj -- STARS-001
```

The .NET version has full curl-impersonate support via `libcurl.dll` and can successfully bypass Cloudflare protection.

### Troubleshooting (Node.js)

#### Binary Not Found

If you see warnings about curl-impersonate being unavailable:

1. The bundled binaries in `third_party/curl-impersonate/` are incomplete
2. For Windows, `.bat` files require a `curl.exe` that doesn't exist
3. System curl doesn't have TLS fingerprinting capabilities

#### Still getting 403?

1. **Use the .NET version** for reliable Cloudflare bypass
2. Try a different mirror URL
3. Check if your IP is blocked (try from a different network)
4. Verify `JavDb:CurlImpersonate:Enabled` is `true`

#### Debug Mode

The Node.js version will log warnings when falling back. Check the console output for:
- `curl-impersonate not available`
- `curl-impersonate failed: ...`
- `system curl returned status ...`
- `falling back to enhanced fetch`

## Troubleshooting (Common)

### Still getting 403?

1. Run diagnostics: `dotnet run -- --test-curl` (for .NET version)
2. Try a different mirror URL
3. Check if your IP is blocked (try from a different network)
4. For Node.js version, check console for fallback warnings

### Debug mode

Run JavManager diagnostics to see detailed request information:

**.NET version:**
```bash
dotnet run -- --test-curl
```

**Node.js version:**
```bash
npm run cli -- STARS-001
```
