# Cloudflare Access Guide

JavDB uses Cloudflare protection to prevent automated access. JavManager uses **built-in** Chrome impersonation without relying on third-party tools.

## Built-in Bypass Strategy

JavManager implements multiple techniques to bypass Cloudflare detection:

- **HTTP/1.1 Protocol**: Avoids HTTP/2 fingerprinting (SETTINGS frame order, etc.)
- **Chrome-like Headers**: Correct header order matching real Chrome requests
  - `sec-ch-ua`, `sec-ch-ua-mobile`, `sec-ch-ua-platform`
  - `Sec-Fetch-Site`, `Sec-Fetch-Mode`, `Sec-Fetch-User`, `Sec-Fetch-Dest`
  - `DNT`, `Upgrade-Insecure-Requests`, etc.
- **Cookies**: `over18=1`, `locale=zh`
- **Human-like Behavior**: Random delays between requests
- **Automatic Retries**: Tries base site + mirrors with exponential backoff

In most cases, this is sufficient to access JavDB without additional configuration.

## Use Browser Cookies (Recommended)

When Cloudflare challenges are active, you need a real browser session to obtain a valid cookie.

### Steps to Obtain Cookies

1. Open your browser (Chrome/Edge/Firefox)
2. Navigate to https://javdb.com
3. Complete any Cloudflare challenges if prompted
4. Open Developer Tools (F12)
5. Go to Application/Storage tab → Cookies
6. Find and copy these cookie values:
   - `cf_clearance` (required)
   - `__cf_bm` (optional, improves success rate)
7. Also note your browser's User-Agent (Network tab → any request → Headers → User-Agent)

### Configuration

Add the cookies to your configuration file:

**appsettings.Development.json (recommended for local):**
```json
{
  "JavDb": {
    "BaseUrl": "https://javdb.com",
    "CfClearance": "your_cf_clearance_value_here",
    "CfBm": "your___cf_bm_value_here",
    "UserAgent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36"
  }
}
```
You can also place the same `JavDb` section in `appsettings.json` for production use.

### Important Notes

1. **User-Agent must match**: The User-Agent in configuration MUST exactly match the browser that obtained the cookies
2. **Cookies expire**: `cf_clearance` typically expires after 30 minutes to 2 hours
3. **IP binding**: Cookies are often bound to your IP address
4. **Refresh when needed**: If you start getting 403 errors again, refresh the cookies

## Troubleshooting

### Still getting 403?

1. Run diagnostics: `dotnet run -- --test-curl`
2. Verify cookies haven't expired
3. Ensure User-Agent matches the browser that obtained the cookie
4. Try a different mirror URL
5. Check if your IP is blocked (try from a different network)

### Debug mode

Run JavManager diagnostics to see detailed request information:
```bash
dotnet run -- --test-curl
```
