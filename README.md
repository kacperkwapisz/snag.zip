# snag.zip

Self-hosted file sharing. Upload a file, get a short link.

## Features

- Short shareable download links
- Password-protected downloads
- Expiring links with configurable TTL
- Folder sharing (group files, download as zip)
- Admin dashboard with file management
- Light/dark mode (automatic)

## Stack

- **Runtime**: [Bun](https://bun.sh)
- **Framework**: [Elysia](https://elysiajs.com)
- **Database**: bun:sqlite
- **Storage**: S3-compatible (Cloudflare R2)
- **CSS**: Tailwind CSS v4

## Quick Start

Prerequisites: [Bun](https://bun.sh) and [pnpm](https://pnpm.io)

```sh
pnpm install
cp .env.example .env   # configure your S3 credentials
bun run dev
```

## Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `PORT` | `3000` | Server port |
| `BASE_URL` | `http://localhost:3000` | Public URL for generated links |
| `S3_ENDPOINT` | — | S3-compatible endpoint |
| `S3_BUCKET` | `snag-zip` | Bucket name |
| `S3_ACCESS_KEY_ID` | — | S3 access key |
| `S3_SECRET_ACCESS_KEY` | — | S3 secret key |
| `ADMIN_USERNAME` | `admin` | Admin dashboard username |
| `ADMIN_PASSWORD` | `changeme` | Admin dashboard password |
| `PUBLIC_UPLOADS` | `false` | Allow uploads without auth |
| `MAX_FILE_SIZE` | `104857600` | Max upload size in bytes (100MB) |
| `DEFAULT_EXPIRY_HOURS` | `168` | Link expiry in hours (7 days) |
| `DATABASE_PATH` | `snag.db` | SQLite database file path |

## S3/R2 CORS Configuration

Files ≥10MB are uploaded directly from the browser to your S3/R2 bucket via presigned URLs. This requires CORS to be configured on your bucket.

For **Cloudflare R2**, go to your bucket settings in the Cloudflare dashboard and add:

```json
[
  {
    "AllowedOrigins": ["https://your-domain.com"],
    "AllowedMethods": ["PUT"],
    "AllowedHeaders": ["Content-Type"],
    "ExposeHeaders": ["ETag"],
    "MaxAgeSeconds": 3600
  }
]
```

Replace `https://your-domain.com` with your `BASE_URL`. For local development, use `http://localhost:3000`.

## Scripts

```sh
bun run dev           # server (watch) + CSS (watch)
bun run dev:server    # server only (watch)
bun run css           # build CSS once
bun run css:watch     # watch CSS
bun run build         # build for production
bun run start         # production start
```
