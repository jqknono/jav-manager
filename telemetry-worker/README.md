# JavManager Telemetry Worker

A Cloudflare Worker for collecting anonymous usage telemetry from JavManager clients.

## Features

- Non-blocking telemetry collection
- D1 database storage
- Admin page with pagination
- Geo-location tracking (via Cloudflare)
- Statistics dashboard

## Deployment

### Prerequisites

- Node.js 18+
- Cloudflare account with Workers enabled
- Wrangler CLI (`npm install -g wrangler`)

### Steps

1. **Login to Cloudflare**
   ```bash
   wrangler login
   ```

2. **Install dependencies**
   ```bash
   cd telemetry-worker
   npm install
   ```

3. **Create D1 database**
   ```bash
   npm run db:create
   ```
   
   Copy the `database_id` from the output and update `wrangler.toml`:
   ```toml
   [[d1_databases]]
   binding = "DB"
   database_name = "jav-manager-telemetry"
   database_id = "YOUR_DATABASE_ID_HERE"  # Replace with actual ID
   ```

4. **Initialize database schema**
   ```bash
   # For production
   npm run db:init
   
   # For local development
   npm run db:init-local
   ```

5. **Configure admin credentials (required for `/admin`)**
   ```bash
   wrangler secret put ADMIN_USERNAME
   wrangler secret put ADMIN_PASSWORD
   ```
   For local development, you can also set them in `.dev.vars`:
   ```env
   ADMIN_USERNAME=your-admin-user
   ADMIN_PASSWORD=your-strong-password
   ```

6. **Deploy**
   ```bash
   npm run deploy
   ```

7. **Update JavManager configuration**
   
   In `appsettings.json`, set the telemetry endpoint:
   ```json
   {
     "Telemetry": {
       "Enabled": true,
       "Endpoint": "https://jav-manager-telemetry.YOUR_SUBDOMAIN.workers.dev/api/telemetry"
     }
   }
   ```

## Local Development

```bash
npm run dev
```

This starts a local worker at `http://localhost:8787` with a local D1 database.

## API Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/telemetry` | POST | Receive telemetry data (non-blocking) |
| `/api/stats` | GET | Get aggregated statistics |
| `/api/data` | GET | Get paginated telemetry records |
| `/api/javinfo` | POST | Store JavInfo metadata (idempotent, no torrents) |
| `/` or `/admin` | GET | Admin dashboard page |

### Telemetry Payload

```json
{
  "machine_name": "DESKTOP-ABC123",
  "user_name": "john",
  "app_version": "1.0.0",
  "os_info": "Win32NT 10.0.22000.0",
  "event_type": "startup",
  "event_data": null
}
```

### Pagination Query Parameters

- `page` - Page number (default: 1)
- `pageSize` - Items per page (default: 20, max: 100)

## Data Collected

- Machine name (or random ID if unavailable)
- User name (or random ID if unavailable)
- Application version
- OS information
- Event type (startup, search, download)
- IP address (via Cloudflare)
- Country/City (via Cloudflare geo-IP)
- Timestamp

## Privacy

- No personal data is collected beyond machine/user identifiers
- IP addresses are not stored in detail, only country/city
- Users can disable telemetry in `appsettings.json`

## JavInfo Sync (optional)

`POST /api/javinfo` stores JavInfo metadata, including torrent list and magnet links (as provided by the client).

If you set `API_KEY` as a Worker secret/variable, clients must send it via `X-API-Key`.
