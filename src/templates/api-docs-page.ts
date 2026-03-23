import { layout } from "./layout";
import { config } from "../config";

function code(text: string): string {
  return `<code class="px-1.5 py-0.5 bg-surface-3 rounded-md text-xs font-mono text-text-primary">${text}</code>`;
}

function codeBlock(code: string): string {
  // Trim leading/trailing newlines and dedent
  const lines = code.replace(/^\n/, "").replace(/\n\s*$/, "").split("\n");
  const indent = lines.reduce((min, line) => {
    if (!line.trim()) return min;
    const match = line.match(/^(\s*)/);
    return Math.min(min, match ? match[1].length : 0);
  }, Infinity);
  const dedented = lines.map((l) => l.slice(indent === Infinity ? 0 : indent)).join("\n");

  return `<div class="relative group">
    <pre class="bg-surface-3 rounded-2xl p-5 text-[13px] leading-relaxed font-mono text-text-primary overflow-x-auto"><code>${dedented}</code></pre>
  </div>`;
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
    GET: "bg-success/15 text-success border border-success/25",
    POST: "bg-accent/15 text-accent-hover border border-accent/25",
    DELETE: "bg-danger/10 text-danger border border-danger/25",
  };
  const color = methodColors[method] ?? "bg-surface-3 text-text-secondary";

  const sections: string[] = [];

  if (details.body) {
    sections.push(`
      <div>
        <p class="text-xs font-semibold text-text-secondary uppercase tracking-wider mb-2.5">Request</p>
        ${codeBlock(details.body)}
      </div>`);
  }

  if (details.query) {
    sections.push(`
      <div>
        <p class="text-xs font-semibold text-text-secondary uppercase tracking-wider mb-2.5">Parameters</p>
        ${codeBlock(details.query)}
      </div>`);
  }

  sections.push(`
    <div>
      <p class="text-xs font-semibold text-text-secondary uppercase tracking-wider mb-2.5">Response</p>
      ${codeBlock(details.response)}
    </div>`);

  return `
    <div class="py-7 first:pt-0">
      <div class="flex items-center gap-3 mb-2">
        <span class="inline-flex items-center px-2.5 py-0.5 rounded-lg text-xs font-bold tracking-wide ${color}">${method}</span>
        <code class="text-[13px] font-mono text-text-primary font-semibold">${path}</code>
      </div>
      <p class="text-sm text-text-secondary mb-5 text-pretty">${description}</p>
      <div class="space-y-4">
        ${sections.join("")}
      </div>
      ${details.notes ? `<p class="text-xs text-text-secondary mt-4 leading-relaxed">${details.notes}</p>` : ""}
    </div>`;
}

function sectionDivider(): string {
  return `<div class="border-t border-border/40"></div>`;
}

export function apiDocsPage(): string {
  const base = config.baseUrl;

  const body = `
    <div class="animate-fade-in">
      <h1 class="text-4xl font-semibold tracking-tight text-text-primary mb-3 text-balance">API Reference</h1>
      <p class="text-lg text-text-secondary mb-12 text-pretty">
        Upload, download, and manage files programmatically. Includes an MCP server for AI agents.
      </p>
    </div>

    <!-- Quick Start -->
    <section class="card-elevated rounded-2xl p-8 mb-6 animate-fade-in-delay-1">
      <h2 class="text-xl font-semibold text-text-primary mb-2">Quick Start</h2>
      <p class="text-sm text-text-secondary mb-5 text-pretty">
        Get an API key from the <a href="/admin" class="text-accent hover:text-accent-hover transition-colors underline decoration-accent/50 underline-offset-2">admin dashboard</a>, then start making requests:
      </p>
      ${codeBlock(`
# Upload a file
curl -X POST ${base}/api/v1/files \\
  -H "Authorization: Bearer snag_your_key_here" \\
  -F "file=@photo.jpg" \\
  -F "expiry=168"

# Download a file
curl ${base}/api/v1/files/abc1234/content \\
  -H "Authorization: Bearer snag_your_key_here" \\
  -o photo.jpg

# Create a folder
curl -X POST ${base}/api/v1/folders \\
  -H "Authorization: Bearer snag_your_key_here" \\
  -H "Content-Type: application/json" \\
  -d '{"title": "My Photos", "expiry": "720"}'

# List all files
curl ${base}/api/v1/files \\
  -H "Authorization: Bearer snag_your_key_here"
      `)}
    </section>

    <!-- Auth + Base URL + Errors + Rate Limits in a grid -->
    <div class="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6 animate-fade-in-delay-1">

      <!-- Authentication -->
      <section class="card-elevated rounded-2xl p-8">
        <h2 class="text-xl font-semibold text-text-primary mb-2">Authentication</h2>
        <p class="text-sm text-text-secondary mb-5 text-pretty">
          All requests require an API key via the ${code("Authorization")} header.
        </p>
        ${codeBlock("Authorization: Bearer snag_your_key_here")}
        <p class="text-xs text-text-secondary mt-4 leading-relaxed">
          Create keys in the <a href="/admin" class="text-accent hover:text-accent-hover transition-colors underline decoration-accent/50 underline-offset-2">admin dashboard</a>.
          Keys are prefixed with ${code("snag_")} for easy identification.
        </p>
      </section>

      <!-- Base URL + Rate Limits -->
      <div class="space-y-6">
        <section class="card-elevated rounded-2xl p-8">
          <h2 class="text-xl font-semibold text-text-primary mb-2">Base URL</h2>
          ${codeBlock(base + "/api/v1")}
        </section>

        <section class="card-elevated rounded-2xl p-8">
          <h2 class="text-xl font-semibold text-text-primary mb-4">Rate Limits</h2>
          <div class="space-y-2.5">
            <div class="flex items-center justify-between text-sm">
              <span class="text-text-secondary">General requests</span>
              <span class="text-text-primary font-medium tabular-nums">60 / min</span>
            </div>
            <div class="border-t border-border/30"></div>
            <div class="flex items-center justify-between text-sm">
              <span class="text-text-secondary">Uploads</span>
              <span class="text-text-primary font-medium tabular-nums">10 / min</span>
            </div>
          </div>
          <p class="text-xs text-text-secondary mt-4">Per IP address. Returns ${code("429")} with ${code("rate_limited")} error code.</p>
        </section>
      </div>
    </div>

    <!-- Errors -->
    <section class="card-elevated rounded-2xl p-8 mb-6 animate-fade-in-delay-2">
      <h2 class="text-xl font-semibold text-text-primary mb-2">Errors</h2>
      <p class="text-sm text-text-secondary mb-5 text-pretty">
        All errors return a consistent JSON envelope:
      </p>
      ${codeBlock(`
{
  "error": {
    "code": "not_found",
    "message": "File not found"
  }
}
      `)}
      <div class="mt-6 space-y-0">
        <div class="grid grid-cols-[3rem_1fr_1fr] gap-x-4 py-2.5 text-xs font-semibold text-text-secondary uppercase tracking-wider">
          <span>HTTP</span><span>Code</span><span>Description</span>
        </div>
        ${[
          ["400", "bad_request", "Invalid input or missing fields"],
          ["401", "unauthorized", "Missing/invalid API key or wrong password"],
          ["404", "not_found", "Resource does not exist"],
          ["410", "expired", "File or folder has expired"],
          ["413", "file_too_large", "File exceeds size limit"],
          ["429", "rate_limited", "Too many requests"],
          ["502", "storage_error", "S3 storage operation failed"],
        ]
          .map(
            ([status, errCode, desc]) => `
        <div class="grid grid-cols-[3rem_1fr_1fr] gap-x-4 py-2.5 border-t border-border/30 text-sm">
          <span class="text-text-primary font-medium tabular-nums">${status}</span>
          <span class="font-mono text-xs text-text-secondary">${errCode}</span>
          <span class="text-text-secondary">${desc}</span>
        </div>`,
          )
          .join("")}
      </div>
    </section>

    <!-- Files -->
    <section class="card-elevated rounded-2xl p-8 mb-6 animate-fade-in-delay-2">
      <h2 class="text-xl font-semibold text-text-primary mb-1">Files</h2>

      ${endpoint("POST", "/api/v1/files", "Upload a file. Send as multipart/form-data.", {
        body: `
// multipart/form-data fields:
file        File    (required) The file to upload
expiry      string  (optional) Hours until expiration (max 8760)
password    string  (optional) Password-protect the file
folder_id   string  (optional) Add to an existing folder
        `,
        response: `
{
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
}
        `,
      })}

      ${sectionDivider()}

      ${endpoint("GET", "/api/v1/files", "List all files.", {
        response: `
{
  "files": [
    {
      "id": "abc1234",
      "filename": "photo.jpg",
      "size": 1048576,
      ...
    }
  ]
}
        `,
      })}

      ${sectionDivider()}

      ${endpoint("GET", "/api/v1/files/:id", "Get file metadata.", {
        response: `
{
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
}
        `,
      })}

      ${sectionDivider()}

      ${endpoint("GET", "/api/v1/files/:id/content", "Download file content. Returns the raw file as a binary stream.", {
        query: "password   string  (required if file is password-protected)",
        response: "Binary file stream with Content-Type, Content-Disposition, and Content-Length headers.",
        notes: `For password-protected files, pass the password as a query parameter: ${code("?password=secret")}`,
      })}

      ${sectionDivider()}

      ${endpoint("DELETE", "/api/v1/files/:id", "Delete a file and its S3 object.", {
        response: `{ "ok": true }`,
      })}
    </section>

    <!-- Multipart Upload -->
    <section class="card-elevated rounded-2xl p-8 mb-6 animate-fade-in-delay-2">
      <h2 class="text-xl font-semibold text-text-primary mb-1">Multipart Upload</h2>
      <p class="text-sm text-text-secondary mb-2 text-pretty">
        For large files, use multipart upload: ${code("init")} &rarr; ${code("presign")} &rarr; upload parts to S3 &rarr; ${code("complete")}.
      </p>

      ${endpoint("POST", "/api/v1/files/multipart/init", "Start a multipart upload.", {
        body: `
{
  "filename": "large-file.zip",
  "content_type": "application/zip",
  "size": 52428800,
  "folder_id": "optional_folder_id"
}
        `,
        response: `
{
  "file_id": "abc1234",
  "upload_id": "s3-multipart-upload-id",
  "part_size": 5242880,
  "total_parts": 10
}
        `,
      })}

      ${sectionDivider()}

      ${endpoint("POST", "/api/v1/files/multipart/presign", "Get presigned URLs for uploading parts directly to S3.", {
        body: `
{
  "file_id": "abc1234",
  "part_numbers": [1, 2, 3]
}
        `,
        response: `
{
  "urls": {
    "1": "https://s3.example.com/...?X-Amz-Signature=...",
    "2": "https://s3.example.com/...?X-Amz-Signature=...",
    "3": "https://s3.example.com/...?X-Amz-Signature=..."
  }
}
        `,
        notes: `Upload each part with a PUT request to the presigned URL. Capture the ${code("ETag")} response header for each part.`,
      })}

      ${sectionDivider()}

      ${endpoint("POST", "/api/v1/files/multipart/complete", "Complete the multipart upload and create the file record.", {
        body: `
{
  "file_id": "abc1234",
  "parts": [
    { "partNumber": 1, "etag": "\\"abc123\\"" },
    { "partNumber": 2, "etag": "\\"def456\\"" }
  ],
  "expiry": "168",
  "password": "optional"
}
        `,
        response: `
{
  "id": "abc1234",
  "filename": "large-file.zip",
  "size": 52428800,
  "type": "application/zip",
  ...
}
        `,
      })}

      ${sectionDivider()}

      ${endpoint("POST", "/api/v1/files/multipart/abort", "Cancel an in-progress multipart upload.", {
        body: `{ "file_id": "abc1234" }`,
        response: `{ "ok": true }`,
      })}
    </section>

    <!-- Folders -->
    <section class="card-elevated rounded-2xl p-8 mb-6 animate-fade-in-delay-2">
      <h2 class="text-xl font-semibold text-text-primary mb-1">Folders</h2>

      ${endpoint("POST", "/api/v1/folders", `Create a folder. Upload files into it using the folder's ${code("id")} as ${code("folder_id")} in upload requests.`, {
        body: `
{
  "slug": "my-photos",
  "title": "My Photos",
  "description": "Vacation photos",
  "expiry": "720"
}
        `,
        response: `
{
  "id": "xyz7890",
  "slug": "my-photos",
  "title": "My Photos",
  "description": "Vacation photos",
  "created_at": "2026-03-10 12:00:00",
  "expires_at": "2026-04-09 12:00:00",
  "url": "${base}/f/my-photos"
}
        `,
        notes: `All fields are optional. If ${code("slug")} conflicts, a random one is generated.`,
      })}

      ${sectionDivider()}

      ${endpoint("GET", "/api/v1/folders/:slug", "Get folder info and its files.", {
        response: `
{
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
}
        `,
      })}

      ${sectionDivider()}

      ${endpoint("DELETE", "/api/v1/folders/:slug", "Delete a folder and all its files.", {
        response: `{ "ok": true, "deleted_files": 5 }`,
      })}
    </section>

    <!-- Stats -->
    <section class="card-elevated rounded-2xl p-8 mb-6 animate-fade-in-delay-2">
      <h2 class="text-xl font-semibold text-text-primary mb-1">Stats</h2>

      ${endpoint("GET", "/api/v1/stats", "Get instance-wide statistics.", {
        response: `
{
  "total_files": 150,
  "total_size": 5368709120,
  "total_downloads": 3420
}
        `,
        notes: `${code("total_size")} is in bytes.`,
      })}
    </section>

    <!-- MCP Server -->
    <section class="card-elevated rounded-2xl p-8 animate-fade-in-delay-2">
      <h2 class="text-xl font-semibold text-text-primary mb-2">MCP Server</h2>
      <p class="text-sm text-text-secondary mb-5 text-pretty">
        snag.zip includes a built-in <a href="https://modelcontextprotocol.io" class="text-accent hover:text-accent-hover transition-colors underline decoration-accent/50 underline-offset-2">Model Context Protocol</a> (MCP) server
        so AI agents can create and share text files directly. Connect any MCP-compatible client using Streamable HTTP transport.
      </p>

      <div class="mb-6">
        <p class="text-xs font-semibold text-text-secondary uppercase tracking-wider mb-2.5">Endpoint</p>
        ${codeBlock(`${base}/mcp`)}
        <p class="text-xs text-text-secondary mt-3 leading-relaxed">Transport: Streamable HTTP. No authentication required.</p>
      </div>

      <div class="mb-6">
        <p class="text-xs font-semibold text-text-secondary uppercase tracking-wider mb-2.5">Available Tools</p>
        <div class="space-y-0">
          <div class="grid grid-cols-[10rem_1fr] gap-x-4 py-2.5 text-xs font-semibold text-text-secondary uppercase tracking-wider">
            <span>Tool</span><span>Description</span>
          </div>
          ${[
            ["create_text_file", "Create a .txt, .md, or .json file and get a shareable download link"],
            ["upload_file", "Upload any file type via base64 encoding (screenshots, images, snippets)"],
            ["upload_from_url", "Fetch a file from a URL and store it (PDFs, datasets, archives)"],
            ["list_files", "List all uploaded files with metadata and download URLs"],
            ["get_file_info", "Get metadata for a specific file by its ID"],
            ["create_folder", "Create a folder to group files together"],
            ["list_folders", "List all folders with URLs"],
          ]
            .map(
              ([tool, desc]) => `
          <div class="grid grid-cols-[10rem_1fr] gap-x-4 py-2.5 border-t border-border/30 text-sm">
            <span class="font-mono text-xs text-text-primary">${tool}</span>
            <span class="text-text-secondary">${desc}</span>
          </div>`,
            )
            .join("")}
        </div>
      </div>

      <div class="space-y-6">
        <div>
          <p class="text-xs font-semibold text-text-secondary uppercase tracking-wider mb-2.5">${code("create_text_file")} Parameters</p>
          ${codeBlock(`
filename      string  (required) Filename with extension (.txt, .md, .json only)
content       string  (required) Text content of the file
expiry_hours  number  (optional) Hours until expiration (max 8760)
password      string  (optional) Password-protect the download
folder_id     string  (optional) Add to an existing folder
          `)}
          <p class="text-xs text-text-secondary mt-3 leading-relaxed">
            Only ${code(".txt")}, ${code(".md")}, and ${code(".json")} files are supported.
          </p>
        </div>

        <div class="border-t border-border/30 pt-6">
          <p class="text-xs font-semibold text-text-secondary uppercase tracking-wider mb-2.5">${code("upload_file")} Parameters</p>
          ${codeBlock(`
filename        string  (required) Filename with extension (any type allowed)
content_base64  string  (required) Base64-encoded file content
expiry_hours    number  (optional) Hours until expiration (max 8760)
password        string  (optional) Password-protect the download
folder_id       string  (optional) Add to an existing folder
          `)}
          <p class="text-xs text-text-secondary mt-3 leading-relaxed">
            Any file type is allowed. Best for small files like screenshots or images.
          </p>
        </div>

        <div class="border-t border-border/30 pt-6">
          <p class="text-xs font-semibold text-text-secondary uppercase tracking-wider mb-2.5">${code("upload_from_url")} Parameters</p>
          ${codeBlock(`
url           string  (required) URL to fetch (http/https only)
filename      string  (optional) Override filename (derived from URL if omitted)
expiry_hours  number  (optional) Hours until expiration (max 8760)
password      string  (optional) Password-protect the download
folder_id     string  (optional) Add to an existing folder
          `)}
          <p class="text-xs text-text-secondary mt-3 leading-relaxed">
            The server fetches the file directly — no base64 overhead. SSRF protection prevents fetching from private/internal addresses.
          </p>
        </div>
      </div>

      <p class="text-xs text-text-secondary mt-6 leading-relaxed">
        All tools enforce app settings (expiry rules, max file size). ${code("upload_from_url")} size limit can be configured separately via ${code("MCP_MAX_URL_FILE_SIZE")}.
      </p>
    </section>
  `;

  return layout("API Docs", body, "", { wide: true });
}
