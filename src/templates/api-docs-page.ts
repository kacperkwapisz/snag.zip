import { layout } from "./layout";
import { config } from "../config";

function codeBlock(code: string): string {
  return `<pre class="bg-surface-3 rounded-xl p-4 text-sm font-mono text-text-primary overflow-x-auto"><code>${code}</code></pre>`;
}

function endpoint(
  method: string,
  path: string,
  description: string,
  details: {
    body?: string;
    query?: string;
    response: string;
    notes?: string;
  },
): string {
  const methodColors: Record<string, string> = {
    GET: "bg-success/15 text-success",
    POST: "bg-accent/15 text-accent",
    DELETE: "bg-danger/15 text-danger",
  };
  const color = methodColors[method] ?? "bg-surface-3 text-text-secondary";

  return `
    <div class="border-t border-border/50 py-6">
      <div class="flex items-center gap-3 mb-2">
        <span class="inline-flex items-center px-2.5 py-1 rounded-lg text-xs font-bold ${color}">${method}</span>
        <code class="text-sm font-mono text-text-primary font-medium">${path}</code>
      </div>
      <p class="text-sm text-text-secondary mb-4 text-pretty">${description}</p>
      ${details.body ? `<p class="text-xs font-medium text-text-tertiary uppercase tracking-wider mb-2">Request Body</p>${codeBlock(details.body)}` : ""}
      ${details.query ? `<p class="text-xs font-medium text-text-tertiary uppercase tracking-wider mb-2 ${details.body ? "mt-4" : ""}">Query Parameters</p>${codeBlock(details.query)}` : ""}
      <p class="text-xs font-medium text-text-tertiary uppercase tracking-wider mb-2 ${details.body || details.query ? "mt-4" : ""}">Response</p>
      ${codeBlock(details.response)}
      ${details.notes ? `<p class="text-xs text-text-tertiary mt-3">${details.notes}</p>` : ""}
    </div>`;
}

export function apiDocsPage(): string {
  const base = config.baseUrl;

  const body = `
    <h1 class="text-4xl font-semibold tracking-tight text-text-primary mb-3 animate-fade-in text-balance">API Reference</h1>
    <p class="text-lg text-text-secondary mb-10 animate-fade-in text-pretty">
      Upload, download, and manage files programmatically.
    </p>

    <!-- Quick Start -->
    <div class="card-elevated rounded-2xl p-6 mb-8 animate-fade-in-delay-1">
      <h2 class="text-lg font-semibold text-text-primary mb-4">Quick Start</h2>
      <p class="text-sm text-text-secondary mb-4 text-pretty">
        Get an API key from the <a href="/admin" class="text-accent hover:text-accent-hover transition-colors">admin dashboard</a>, then start making requests:
      </p>
      ${codeBlock(`# Upload a file
curl -X POST ${base}/api/v1/files \\
  -H "Authorization: Bearer snag_your_key_here" \\
  -F "file=@photo.jpg" \\
  -F "expiry=168"

# Download a file
curl ${base}/api/v1/files/abc1234/content \\
  -H "Authorization: Bearer snag_your_key_here" \\
  -o photo.jpg

# Create a folder and upload into it
curl -X POST ${base}/api/v1/folders \\
  -H "Authorization: Bearer snag_your_key_here" \\
  -H "Content-Type: application/json" \\
  -d '{"title": "My Photos", "expiry": "720"}'

# List all files
curl ${base}/api/v1/files \\
  -H "Authorization: Bearer snag_your_key_here"`)}
    </div>

    <!-- Authentication -->
    <div class="card-elevated rounded-2xl p-6 mb-8 animate-fade-in-delay-1">
      <h2 class="text-lg font-semibold text-text-primary mb-4">Authentication</h2>
      <p class="text-sm text-text-secondary mb-4 text-pretty">
        All API requests require a valid API key passed in the <code class="px-1.5 py-0.5 bg-surface-3 rounded-md text-xs font-mono">Authorization</code> header:
      </p>
      ${codeBlock(`Authorization: Bearer snag_your_key_here`)}
      <p class="text-sm text-text-secondary mt-4 text-pretty">
        API keys can be created and managed from the <a href="/admin" class="text-accent hover:text-accent-hover transition-colors">admin dashboard</a>.
        Keys are prefixed with <code class="px-1.5 py-0.5 bg-surface-3 rounded-md text-xs font-mono">snag_</code> for easy identification.
      </p>
    </div>

    <!-- Base URL -->
    <div class="card-elevated rounded-2xl p-6 mb-8 animate-fade-in-delay-1">
      <h2 class="text-lg font-semibold text-text-primary mb-4">Base URL</h2>
      ${codeBlock(base + "/api/v1")}
      <p class="text-sm text-text-secondary mt-3 text-pretty">
        All endpoints are prefixed with <code class="px-1.5 py-0.5 bg-surface-3 rounded-md text-xs font-mono">/api/v1</code>.
      </p>
    </div>

    <!-- Errors -->
    <div class="card-elevated rounded-2xl p-6 mb-8 animate-fade-in-delay-2">
      <h2 class="text-lg font-semibold text-text-primary mb-4">Errors</h2>
      <p class="text-sm text-text-secondary mb-4 text-pretty">
        All errors return a consistent JSON format:
      </p>
      ${codeBlock(`{
  "error": {
    "code": "not_found",
    "message": "File not found"
  }
}`)}
      <div class="mt-4 overflow-x-auto">
        <table class="w-full text-sm">
          <thead>
            <tr class="text-left text-xs font-medium text-text-tertiary uppercase tracking-wider">
              <th class="py-2 pr-4">HTTP</th>
              <th class="py-2 pr-4">Code</th>
              <th class="py-2">Description</th>
            </tr>
          </thead>
          <tbody class="text-text-secondary">
            <tr class="border-t border-border/30"><td class="py-2 pr-4 tabular-nums">400</td><td class="py-2 pr-4 font-mono text-xs">bad_request</td><td class="py-2">Invalid input or missing fields</td></tr>
            <tr class="border-t border-border/30"><td class="py-2 pr-4 tabular-nums">401</td><td class="py-2 pr-4 font-mono text-xs">unauthorized</td><td class="py-2">Missing/invalid API key or wrong password</td></tr>
            <tr class="border-t border-border/30"><td class="py-2 pr-4 tabular-nums">404</td><td class="py-2 pr-4 font-mono text-xs">not_found</td><td class="py-2">Resource does not exist</td></tr>
            <tr class="border-t border-border/30"><td class="py-2 pr-4 tabular-nums">410</td><td class="py-2 pr-4 font-mono text-xs">expired</td><td class="py-2">File or folder has expired</td></tr>
            <tr class="border-t border-border/30"><td class="py-2 pr-4 tabular-nums">413</td><td class="py-2 pr-4 font-mono text-xs">file_too_large</td><td class="py-2">File exceeds size limit</td></tr>
            <tr class="border-t border-border/30"><td class="py-2 pr-4 tabular-nums">429</td><td class="py-2 pr-4 font-mono text-xs">rate_limited</td><td class="py-2">Too many requests</td></tr>
            <tr class="border-t border-border/30"><td class="py-2 pr-4 tabular-nums">502</td><td class="py-2 pr-4 font-mono text-xs">storage_error</td><td class="py-2">S3 storage operation failed</td></tr>
          </tbody>
        </table>
      </div>
    </div>

    <!-- Rate Limits -->
    <div class="card-elevated rounded-2xl p-6 mb-8 animate-fade-in-delay-2">
      <h2 class="text-lg font-semibold text-text-primary mb-4">Rate Limits</h2>
      <div class="overflow-x-auto">
        <table class="w-full text-sm">
          <thead>
            <tr class="text-left text-xs font-medium text-text-tertiary uppercase tracking-wider">
              <th class="py-2 pr-4">Category</th>
              <th class="py-2">Limit</th>
            </tr>
          </thead>
          <tbody class="text-text-secondary">
            <tr class="border-t border-border/30"><td class="py-2 pr-4">General requests</td><td class="py-2 tabular-nums">60 / minute</td></tr>
            <tr class="border-t border-border/30"><td class="py-2 pr-4">Uploads</td><td class="py-2 tabular-nums">10 / minute</td></tr>
          </tbody>
        </table>
      </div>
      <p class="text-xs text-text-tertiary mt-3">Rate limits are per IP address.</p>
    </div>

    <!-- Files Endpoints -->
    <div class="card-elevated rounded-2xl p-6 mb-8 animate-fade-in-delay-2">
      <h2 class="text-lg font-semibold text-text-primary mb-2">Files</h2>

      ${endpoint("POST", "/api/v1/files", "Upload a file. Send as multipart/form-data.", {
        body: `// multipart/form-data fields:
file        File    (required) The file to upload
expiry      string  (optional) Hours until expiration (max 8760)
password    string  (optional) Password-protect the file
folder_id   string  (optional) Add to an existing folder`,
        response: `{
  "id": "abc1234",
  "filename": "photo.jpg",
  "size": 1048576,
  "type": "image/jpeg",
  "uploaded_at": "2026-03-10 12:00:00",
  "expires_at": "2026-03-17 12:00:00",
  "downloads": 0,
  "has_password": false,
  "folder_id": null,
  "url": "${base}/d/abc1234",
  "download_url": "${base}/api/v1/files/abc1234/content"
}`,
      })}

      ${endpoint("GET", "/api/v1/files", "List all files.", {
        response: `{
  "files": [
    {
      "id": "abc1234",
      "filename": "photo.jpg",
      "size": 1048576,
      ...
    }
  ]
}`,
      })}

      ${endpoint("GET", "/api/v1/files/:id", "Get file metadata.", {
        response: `{
  "id": "abc1234",
  "filename": "photo.jpg",
  "size": 1048576,
  "type": "image/jpeg",
  "uploaded_at": "2026-03-10 12:00:00",
  "expires_at": "2026-03-17 12:00:00",
  "downloads": 42,
  "has_password": true,
  "folder_id": null,
  "url": "${base}/d/abc1234",
  "download_url": "${base}/api/v1/files/abc1234/content"
}`,
      })}

      ${endpoint("GET", "/api/v1/files/:id/content", "Download file content. Returns the raw file as a binary stream.", {
        query: `password   string  (required if file is password-protected)`,
        response: `Binary file stream with Content-Type, Content-Disposition, and Content-Length headers.`,
        notes: "For password-protected files, pass the password as a query parameter: <code class='px-1.5 py-0.5 bg-surface-3 rounded-md text-xs font-mono'>?password=secret</code>",
      })}

      ${endpoint("DELETE", "/api/v1/files/:id", "Delete a file and its S3 object.", {
        response: `{ "ok": true }`,
      })}
    </div>

    <!-- Multipart Upload -->
    <div class="card-elevated rounded-2xl p-6 mb-8 animate-fade-in-delay-2">
      <h2 class="text-lg font-semibold text-text-primary mb-2">Multipart Upload</h2>
      <p class="text-sm text-text-secondary mb-2 text-pretty">
        For large files, use multipart upload. The flow is: <strong>init</strong> &rarr; <strong>presign</strong> (for each batch of parts) &rarr; <strong>upload parts to S3</strong> &rarr; <strong>complete</strong>.
      </p>

      ${endpoint("POST", "/api/v1/files/multipart/init", "Start a multipart upload.", {
        body: `{
  "filename": "large-file.zip",
  "content_type": "application/zip",
  "size": 52428800,
  "folder_id": "optional_folder_id"
}`,
        response: `{
  "file_id": "abc1234",
  "upload_id": "s3-multipart-upload-id",
  "part_size": 5242880,
  "total_parts": 10
}`,
      })}

      ${endpoint("POST", "/api/v1/files/multipart/presign", "Get presigned URLs for uploading parts directly to S3.", {
        body: `{
  "file_id": "abc1234",
  "part_numbers": [1, 2, 3]
}`,
        response: `{
  "urls": {
    "1": "https://s3.example.com/...?X-Amz-Signature=...",
    "2": "https://s3.example.com/...?X-Amz-Signature=...",
    "3": "https://s3.example.com/...?X-Amz-Signature=..."
  }
}`,
        notes: "Upload each part with a PUT request to the presigned URL. Capture the <code class='px-1.5 py-0.5 bg-surface-3 rounded-md text-xs font-mono'>ETag</code> response header for each part.",
      })}

      ${endpoint("POST", "/api/v1/files/multipart/complete", "Complete the multipart upload and create the file record.", {
        body: `{
  "file_id": "abc1234",
  "parts": [
    { "partNumber": 1, "etag": "\\"abc123\\"" },
    { "partNumber": 2, "etag": "\\"def456\\"" }
  ],
  "expiry": "168",
  "password": "optional"
}`,
        response: `{
  "id": "abc1234",
  "filename": "large-file.zip",
  "size": 52428800,
  "type": "application/zip",
  ...
}`,
      })}

      ${endpoint("POST", "/api/v1/files/multipart/abort", "Cancel an in-progress multipart upload.", {
        body: `{ "file_id": "abc1234" }`,
        response: `{ "ok": true }`,
      })}
    </div>

    <!-- Folders -->
    <div class="card-elevated rounded-2xl p-6 mb-8 animate-fade-in-delay-2">
      <h2 class="text-lg font-semibold text-text-primary mb-2">Folders</h2>

      ${endpoint("POST", "/api/v1/folders", "Create a folder. Upload files into it using the folder's <code class='px-1.5 py-0.5 bg-surface-3 rounded-md text-xs font-mono'>id</code> as <code class='px-1.5 py-0.5 bg-surface-3 rounded-md text-xs font-mono'>folder_id</code> in upload requests.", {
        body: `{
  "slug": "my-photos",
  "title": "My Photos",
  "description": "Vacation photos",
  "expiry": "720"
}`,
        response: `{
  "id": "xyz7890",
  "slug": "my-photos",
  "title": "My Photos",
  "description": "Vacation photos",
  "created_at": "2026-03-10 12:00:00",
  "expires_at": "2026-04-09 12:00:00",
  "url": "${base}/f/my-photos"
}`,
        notes: "All fields except <code class='px-1.5 py-0.5 bg-surface-3 rounded-md text-xs font-mono'>slug</code> are optional. If the slug conflicts, a random one is generated.",
      })}

      ${endpoint("GET", "/api/v1/folders/:slug", "Get folder info and its files.", {
        response: `{
  "id": "xyz7890",
  "slug": "my-photos",
  "title": "My Photos",
  "description": "Vacation photos",
  "created_at": "2026-03-10 12:00:00",
  "expires_at": "2026-04-09 12:00:00",
  "url": "${base}/f/my-photos",
  "files": [
    {
      "id": "abc1234",
      "filename": "photo.jpg",
      "size": 1048576,
      "type": "image/jpeg",
      "uploaded_at": "2026-03-10 12:00:00",
      "downloads": 5,
      "url": "${base}/d/abc1234"
    }
  ]
}`,
      })}

      ${endpoint("DELETE", "/api/v1/folders/:slug", "Delete a folder and all its files.", {
        response: `{ "ok": true, "deleted_files": 5 }`,
      })}
    </div>

    <!-- Stats -->
    <div class="card-elevated rounded-2xl p-6 animate-fade-in-delay-2">
      <h2 class="text-lg font-semibold text-text-primary mb-2">Stats</h2>

      ${endpoint("GET", "/api/v1/stats", "Get instance-wide statistics.", {
        response: `{
  "total_files": 150,
  "total_size": 5368709120,
  "total_downloads": 3420
}`,
        notes: "<code class='px-1.5 py-0.5 bg-surface-3 rounded-md text-xs font-mono'>total_size</code> is in bytes.",
      })}
    </div>
  `;

  return layout("API Docs", body, "", { wide: true });
}
