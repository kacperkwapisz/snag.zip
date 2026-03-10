# snag.zip

Self-hosted file sharing. Upload a file, get a short link.

## Stack

- **Runtime**: Bun
- **Framework**: Elysia
- **Storage**: S3-compatible (Cloudflare R2) via `Bun.S3Client` + `@aws-sdk/client-s3` (multipart)
- **Database**: `bun:sqlite`
- **CSS**: Tailwind CSS v4 via `@tailwindcss/cli`
- **IDs**: nanoid
- **Zip**: fflate (streaming)

## Commands

```sh
pnpm install          # install deps
bun run dev           # server (watch) + css (watch)
bun run dev:server    # server only (watch)
bun run css           # build CSS once (minified)
bun run css:watch     # watch CSS
bun run start         # production start
```

## Project Structure

```
src/
  index.ts              # app entry, middleware, cleanup cron
  config.ts             # env vars with defaults
  db.ts                 # bun:sqlite schema + prepared statements
  s3.ts                 # S3Client singleton + helpers + multipart upload (AWS SDK)
  routes/
    pages.ts            # GET / (upload page), GET /docs (API docs)
    upload.ts           # POST /upload + multipart endpoints
    download.ts         # GET/POST /d/:id, GET /d/:id/raw
    folder.ts           # POST /folder, GET /f/:slug, GET /f/:slug/zip
    admin.ts            # GET /admin, DELETE /admin/files/:id, POST/DELETE /admin/api-keys
    api.ts              # REST API under /api/v1/ (Bearer token auth)
  templates/
    layout.ts           # HTML shell (nav, footer, head)
    components.ts       # drop zone, progress bar, file cards, copy button
    upload-page.ts      # upload form + inline JS
    download-page.ts    # file info card, password form, expired page
    folder-page.ts      # folder grid view
    admin-page.ts       # stats + file table + API key management
    api-docs-page.ts    # API documentation page
  lib/
    id.ts               # nanoid wrapper
    format.ts           # formatBytes, formatDate, timeUntilExpiry, fileExtension, esc, sanitize
    zip.ts              # fflate streaming zip
  styles.css            # Tailwind v4 source (design tokens + custom CSS)
public/
  styles.css            # compiled output (do not edit)
  favicon.ico
```

## Routes

| Method | Path | Description |
|--------|------|-------------|
| GET | `/` | Upload page |
| POST | `/upload` | Upload file (direct, for files <10MB) |
| POST | `/upload/init` | Init S3 multipart upload (files ≥10MB) |
| POST | `/upload/presign-parts` | Get presigned URLs for part uploads |
| POST | `/upload/complete` | Complete multipart upload + save to DB |
| POST | `/upload/abort` | Abort multipart upload |
| GET | `/d/:id` | Download page |
| POST | `/d/:id` | Password verification |
| GET | `/d/:id/raw` | Raw file download |
| POST | `/folder` | Create folder |
| GET | `/f/:slug` | Folder page |
| GET | `/f/:slug/zip` | Download folder as zip |
| GET | `/docs` | API documentation page |
| GET | `/admin` | Admin dashboard (basic auth) |
| DELETE | `/admin/files/:id` | Delete file |
| POST | `/admin/api-keys` | Create API key |
| DELETE | `/admin/api-keys/:id` | Revoke API key |
| POST | `/api/v1/files` | API: Upload file |
| GET | `/api/v1/files` | API: List all files |
| GET | `/api/v1/files/:id` | API: File metadata |
| GET | `/api/v1/files/:id/content` | API: Download file |
| DELETE | `/api/v1/files/:id` | API: Delete file |
| POST | `/api/v1/files/multipart/init` | API: Init multipart upload |
| POST | `/api/v1/files/multipart/presign` | API: Presign part URLs |
| POST | `/api/v1/files/multipart/complete` | API: Complete multipart |
| POST | `/api/v1/files/multipart/abort` | API: Abort multipart |
| POST | `/api/v1/folders` | API: Create folder |
| GET | `/api/v1/folders/:slug` | API: Folder info + files |
| DELETE | `/api/v1/folders/:slug` | API: Delete folder + files |
| GET | `/api/v1/stats` | API: Instance stats |

## Key Gotchas

- **bun:sqlite `strict: true`**: Parameter keys must NOT have `$` prefix. Use `{ id: x }` not `{ $id: x }`.
- **All routes in separate files under `src/routes/`**, registered via Elysia `.use()` in `src/index.ts`.
- **HTML escaping**: All user strings MUST be escaped via `esc()` from `lib/format.ts` before embedding in templates.
- **Password-protected downloads** use single-use 5-minute tokens, not session cookies.
- **Filenames**: `sanitizeFilename()` strips `../`, leading `/`, null bytes. `safeContentDisposition()` handles RFC 5987 encoding.
- **Large file uploads (≥10MB)** use S3 multipart upload via `@aws-sdk/client-s3`. Client uploads 5MB chunks directly to R2 via presigned PUT URLs (3 concurrent, 3 retries). Requires R2 CORS config allowing PUT from the app's origin with `ETag` exposed.
- **R2 CORS** must be configured in Cloudflare dashboard: `AllowedOrigins: [domain]`, `AllowedMethods: [PUT]`, `AllowedHeaders: [Content-Type]`, `ExposeHeaders: [ETag]`.

## UI Direction

The UI follows an **Apple-like aesthetic** inspired by apple.com.

### Design Principles

- **Light-first with automatic dark mode** via `prefers-color-scheme`
- **Clean, spacious layouts** with generous whitespace
- **System font stack**: SF Pro Text + SF Pro Icons on Apple, Helvetica Neue/Arial fallback
- **Single accent color**: Apple blue (`#007aff` light / `#0a84ff` dark)
- **Cards over borders**: Light mode uses subtle `box-shadow`, dark mode uses `border`
- **Frosted glass nav**: Sticky top bar with `backdrop-filter: blur(20px)`
- **Subtle animations**: Fade-in-up on page load, respects `prefers-reduced-motion`

### Design Tokens

Defined as CSS custom properties in `src/styles.css`, mapped to Tailwind via `@theme`:

| Token | Light | Dark | Usage |
|-------|-------|------|-------|
| `surface` | `#ffffff` | `#1c1c1e` | Primary background (cards) |
| `surface-2` | `#f5f5f7` | `#2c2c2e` | Page background |
| `surface-3` | `#e8e8ed` | `#3a3a3c` | Input backgrounds, preview areas |
| `border` | `#d2d2d7` | `#48484a` | Borders, dividers |
| `accent` | `#007aff` | `#0a84ff` | Primary actions, links |
| `accent-hover` | `#0066d6` | `#409cff` | Hover states |
| `text-primary` | `#1d1d1f` | `#f5f5f7` | Headings, body |
| `text-secondary` | `#6e6e73` | `#98989d` | Descriptions, labels |
| `text-tertiary` | `#86868b` | `#636366` | Metadata, muted |
| `danger` | `#ff3b30` | `#ff453a` | Errors, delete |
| `success` | `#34c759` | `#30d158` | Verified, success |

### Custom CSS Classes

| Class | Purpose |
|-------|---------|
| `.nav-blur` | Frosted glass nav (backdrop-filter + semi-transparent bg) |
| `.card-elevated` | Card with shadow (light) or border (dark) |
| `.drop-zone` | Dashed border upload area with hover/dragging states |
| `.animate-fade-in` | Fade-in-up entrance animation (+ `-delay-1`, `-delay-2`) |

### Typography

- Headings: `text-4xl font-semibold tracking-tight text-balance`
- Body: `text-base text-pretty`
- Metadata: `text-sm text-text-tertiary tabular-nums`

### Layout

- `layout()` accepts `options?: { wide?: boolean }`:
  - Default: `max-w-3xl` (upload, download pages)
  - Wide: `max-w-5xl` (folder, admin pages)
- Folder page uses a responsive grid: `grid-cols-1 sm:grid-cols-2 lg:grid-cols-3`
- File cards in folder grid show the file extension as a large label in a preview area (Dropover Cloud folderlook style)

### When Modifying UI

- Use existing design tokens — don't introduce new colors without updating the token table above
- Keep one accent color per view
- Use `card-elevated` for any content card
- Use `text-balance` on headings, `text-pretty` on body paragraphs
- Use `tabular-nums` on any numeric data
- Escape all user strings with `esc()` — never embed raw user input in templates
- Test both light and dark mode
- Respect `prefers-reduced-motion` for any new animations
