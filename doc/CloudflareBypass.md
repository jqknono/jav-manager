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
- You can vendor the files automatically by running: `scripts/fetch-curl-impersonate-libs.ps1`

## Fallback Strategy (Optional): HttpClient best-effort

If `JavDb:CurlImpersonate:Enabled` is disabled, or the native library cannot be loaded, JavManager falls back to a best-effort HttpClient header spoofing mode. This mode may still be blocked by Cloudflare.

## Troubleshooting

### Still getting 403?

1. Run diagnostics: `dotnet run -- --test-curl`
2. Try a different mirror URL
3. Check if your IP is blocked (try from a different network)

### Debug mode

Run JavManager diagnostics to see detailed request information:
```bash
dotnet run -- --test-curl
```
