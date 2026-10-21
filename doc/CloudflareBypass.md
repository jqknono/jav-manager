# Cloudflare Access Guide

JavDB uses Cloudflare protection to prevent automated access. JavManager uses **curl-impersonate** by default to mimic real browser TLS/HTTP2 fingerprints (no browser automation, no browser cookie import).

## Default Strategy: curl-impersonate

JavManager uses:

- **curl-impersonate**: bundled `curl_<target>` / `curl-impersonate` binaries to match browser TLS/HTTP2 fingerprints
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
- Vendored binaries live under `third_party/curl-impersonate/`.
- Fetch prebuilt binaries with: `pwsh scripts/fetch-curl-impersonate.ps1`
- Optional CA bundle path can be set via `JavDb:CurlImpersonate:CaBundlePath`. If omitted, JavManager auto-detects a bundled `cacert.pem` when present.

## Fallback Strategy

If `JavDb:CurlImpersonate:Enabled` is disabled, or the curl-impersonate binary cannot be found, JavManager falls back in this order:

1. **curl-impersonate** (when available): bundled binaries from `third_party/curl-impersonate/`
2. **System curl**: uses system curl with enhanced headers
3. **Enhanced fetch**: Node.js fetch with Cloudflare-oriented headers

This fallback mode may still be blocked by Cloudflare.

## How It Works

The Node.js implementation uses a cascading fallback approach:

1. **Try curl-impersonate**: If `JavDb:CurlImpersonate:Enabled` is `true` and binaries are available
2. **Try system curl**: If curl-impersonate fails, uses system curl with enhanced headers
3. **Enhanced fetch**: Final fallback with headers including:
   - Modern Chrome User-Agent
   - Client Hints (`sec-ch-ua-*`)
   - Sec-Fetch-* headers
   - Proper Accept/Accept-Encoding headers

## Troubleshooting

### Binary Not Found

If you see warnings about curl-impersonate being unavailable:

1. Fetch binaries: `pwsh scripts/fetch-curl-impersonate.ps1`
2. Confirm files exist under `third_party/curl-impersonate/bin/`
3. System curl does not provide TLS fingerprinting

### Still getting 403?

1. Run: `npm run cli -- STARS-001` and check fallback warnings
2. Try a different mirror URL
3. Check if your IP is blocked (try from a different network)
4. Verify `JavDb:CurlImpersonate:Enabled` is `true`

### Debug Mode

The CLI logs warnings when falling back. Check the console output for:

- `curl-impersonate not available`
- `curl-impersonate failed: ...`
- `system curl returned status ...`
- `falling back to enhanced fetch`
