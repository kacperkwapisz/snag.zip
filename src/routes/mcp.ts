import { Elysia } from "elysia";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { WebStandardStreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js";
import { z } from "zod";
import { config } from "../config";
import { generateId } from "../lib/id";
import { sanitizeFilename } from "../lib/format";
import { uploadFile } from "../s3";
import {
  insertFile,
  getFile,
  listFiles,
  getFolder,
  insertFolder,
  listFolders,
} from "../db";
import { parseExpiry } from "./upload";
import { lookup as dnsLookup } from "node:dns/promises";

// --- Helpers ---

const ALLOWED_TEXT_EXTENSIONS: Record<string, string> = {
  txt: "text/plain",
  md: "text/markdown",
  json: "application/json",
};

const MIME_MAP: Record<string, string> = {
  txt: "text/plain", md: "text/markdown", json: "application/json",
  html: "text/html", css: "text/css", js: "application/javascript",
  ts: "text/typescript", xml: "application/xml", csv: "text/csv",
  yaml: "text/yaml", yml: "text/yaml", svg: "image/svg+xml",
  png: "image/png", jpg: "image/jpeg", jpeg: "image/jpeg",
  gif: "image/gif", webp: "image/webp", pdf: "application/pdf",
  zip: "application/zip", gz: "application/gzip",
  mp3: "audio/mpeg", mp4: "video/mp4", wav: "audio/wav",
};

function mimeFromFilename(filename: string): string {
  const ext = filename.split(".").pop()?.toLowerCase() ?? "";
  return MIME_MAP[ext] ?? "application/octet-stream";
}

function mcpError(text: string) {
  return { content: [{ type: "text" as const, text }], isError: true };
}

function mcpResult(data: Record<string, unknown>) {
  return { content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }] };
}

/** Ensure filename has a basename (not just ".md" or empty) */
function ensureBasename(filename: string, fallback: string): string {
  const name = sanitizeFilename(filename);
  if (!name) return fallback;
  // If name starts with a dot and has no basename (e.g. ".md"), prepend fallback
  if (name.startsWith(".") && !name.slice(1).includes(".")) return fallback + name;
  return name;
}

/** Validate folder_id exists if provided */
function validateFolderId(folderId: string | undefined): string | null {
  if (!folderId) return null;
  const folder = getFolder(folderId);
  if (!folder) return `Folder "${folderId}" not found`;
  return null;
}

/** Upload to S3 + insert DB record. Returns result or error. */
async function doUpload(opts: {
  filename: string;
  data: Uint8Array | Buffer;
  contentType: string;
  expiry_hours?: number;
  password?: string;
  folder_id?: string;
  extra?: Record<string, unknown>;
}) {
  const id = generateId();
  const s3Key = `files/${id}/${opts.filename}`;

  try {
    await uploadFile(s3Key, opts.data, opts.filename);
  } catch (err) {
    return mcpError(`Error: S3 upload failed: ${err instanceof Error ? err.message : String(err)}`);
  }

  const expiresAt = parseExpiry(opts.expiry_hours?.toString());

  let passwordHash: string | null = null;
  if (opts.password) {
    passwordHash = await Bun.password.hash(opts.password);
  }

  try {
    insertFile({
      id,
      filename: opts.filename,
      size: opts.data.byteLength,
      type: opts.contentType,
      s3_key: s3Key,
      folder_id: opts.folder_id ?? null,
      expires_at: expiresAt,
      password_hash: passwordHash,
    });
  } catch (err) {
    return mcpError(`Error: Database insert failed: ${err instanceof Error ? err.message : String(err)}`);
  }

  return mcpResult({
    id,
    url: `${config.baseUrl}/d/${id}`,
    filename: opts.filename,
    size: opts.data.byteLength,
    expires_at: expiresAt,
    ...opts.extra,
  });
}

// --- SSRF protection ---

function isPrivateIp(ip: string): boolean {
  const parts = ip.split(".").map(Number);
  if (parts.length === 4 && parts.every((n) => n >= 0 && n <= 255)) {
    if (parts[0] === 127) return true;
    if (parts[0] === 10) return true;
    if (parts[0] === 172 && parts[1] >= 16 && parts[1] <= 31) return true;
    if (parts[0] === 192 && parts[1] === 168) return true;
    if (parts[0] === 169 && parts[1] === 254) return true;
    if (parts[0] === 0) return true;
  }
  if (ip === "::1" || ip === "::") return true;
  if (ip.startsWith("fc") || ip.startsWith("fd")) return true;
  if (ip.startsWith("fe80")) return true;
  return false;
}

async function resolveAndValidate(hostname: string): Promise<{ ip: string } | { error: string }> {
  // Direct IP check
  if (isPrivateIp(hostname)) {
    return { error: "URL points to a private/internal IP address" };
  }
  try {
    const { address } = await dnsLookup(hostname);
    if (isPrivateIp(address)) {
      return { error: "URL resolves to a private/internal IP address" };
    }
    return { ip: address };
  } catch {
    return { error: `Could not resolve hostname "${hostname}"` };
  }
}

async function safeFetch(sourceUrl: string, maxSize: number): Promise<
  { response: Response; data: Uint8Array } | { error: string }
> {
  // Validate URL
  let parsed: URL;
  try {
    parsed = new URL(sourceUrl);
  } catch {
    return { error: "Invalid URL" };
  }
  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    return { error: `Protocol "${parsed.protocol}" is not allowed. Only http: and https: are supported.` };
  }

  // Resolve DNS and check for private IPs
  const dnsResult = await resolveAndValidate(parsed.hostname);
  if ("error" in dnsResult) return dnsResult;

  // Fetch with timeout + redirect disabled to prevent SSRF via redirect
  let response: Response;
  try {
    response = await fetch(sourceUrl, {
      signal: AbortSignal.timeout(30_000),
      redirect: "manual",
    });
  } catch (err) {
    const msg = err instanceof Error && err.name === "TimeoutError"
      ? "Request timed out after 30 seconds"
      : `Failed to fetch URL: ${err instanceof Error ? err.message : String(err)}`;
    return { error: msg };
  }

  // Handle redirects manually to validate each hop
  if (response.status >= 300 && response.status < 400) {
    const location = response.headers.get("location");
    if (!location) return { error: "Redirect with no Location header" };

    let redirectUrl: URL;
    try {
      redirectUrl = new URL(location, sourceUrl);
    } catch {
      return { error: "Redirect to invalid URL" };
    }
    if (redirectUrl.protocol !== "http:" && redirectUrl.protocol !== "https:") {
      return { error: `Redirect to disallowed protocol "${redirectUrl.protocol}"` };
    }
    const redirectDns = await resolveAndValidate(redirectUrl.hostname);
    if ("error" in redirectDns) {
      return { error: `Redirect blocked: ${redirectDns.error}` };
    }

    // Follow the validated redirect (max 1 hop to keep it simple)
    try {
      response = await fetch(redirectUrl.href, {
        signal: AbortSignal.timeout(30_000),
        redirect: "manual",
      });
    } catch (err) {
      const msg = err instanceof Error && err.name === "TimeoutError"
        ? "Request timed out after 30 seconds"
        : `Failed to fetch redirect: ${err instanceof Error ? err.message : String(err)}`;
      return { error: msg };
    }

    // If still redirecting, bail
    if (response.status >= 300 && response.status < 400) {
      return { error: "Too many redirects" };
    }
  }

  if (!response.ok) {
    return { error: `URL returned HTTP ${response.status} ${response.statusText}` };
  }

  // Pre-check Content-Length
  const contentLength = response.headers.get("content-length");
  if (contentLength && parseInt(contentLength) > maxSize) {
    return { error: `File too large (${contentLength} bytes). Max size is ${maxSize} bytes.` };
  }

  // Stream body with size limit to prevent memory exhaustion
  const reader = response.body?.getReader();
  if (!reader) return { error: "No response body" };

  const chunks: Uint8Array[] = [];
  let totalSize = 0;

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      totalSize += value.byteLength;
      if (totalSize > maxSize) {
        reader.cancel();
        return { error: `Downloaded file exceeds max size (${maxSize} bytes). Download aborted.` };
      }
      chunks.push(value);
    }
  } catch (err) {
    return { error: `Download failed: ${err instanceof Error ? err.message : String(err)}` };
  }

  // Concatenate chunks
  const data = new Uint8Array(totalSize);
  let offset = 0;
  for (const chunk of chunks) {
    data.set(chunk, offset);
    offset += chunk.byteLength;
  }

  return { response, data };
}

// --- URL filename helpers ---

function filenameFromUrl(url: string): string {
  try {
    const pathname = new URL(url).pathname;
    const lastSegment = pathname.split("/").pop() ?? "";
    const decoded = decodeURIComponent(lastSegment);
    return decoded || "download";
  } catch {
    return "download";
  }
}

function filenameFromContentDisposition(header: string | null): string | null {
  if (!header) return null;
  const starMatch = header.match(/filename\*=(?:UTF-8''|utf-8'')([^;\s]+)/i);
  if (starMatch) {
    try { return decodeURIComponent(starMatch[1]); } catch { /* fall through */ }
  }
  const match = header.match(/filename="?([^";\s]+)"?/i);
  return match?.[1] ?? null;
}

// Base64 with optional whitespace/newlines (some encoders add them)
const BASE64_REGEX = /^[A-Za-z0-9+/\s]*={0,2}\s*$/;

function cleanBase64(input: string): string {
  return input.replace(/\s/g, "");
}

// --- MCP Server ---

function createMcpServer() {
  const mcp = new McpServer({
    name: "snag-zip",
    version: "1.0.0",
  });

  mcp.registerTool("create_text_file", {
    title: "Create Text File",
    description:
      "Create a text file on snag.zip and get a shareable download link. Only .txt, .md, and .json files are allowed.",
    inputSchema: {
      filename: z.string().describe("Filename with extension (e.g. 'notes.md'). Only .txt, .md, .json allowed."),
      content: z.string().describe("Text content of the file"),
      expiry_hours: z.number().optional().describe("Hours until the file expires. Omit for default behavior."),
      password: z.string().optional().describe("Optional password to protect the download"),
      folder_id: z.string().optional().describe("Optional folder ID to add the file to"),
    },
  }, async ({ filename, content, expiry_hours, password, folder_id }) => {
    const safeName = ensureBasename(filename, "unnamed.txt");
    const ext = safeName.split(".").pop()?.toLowerCase() ?? "";

    if (!ALLOWED_TEXT_EXTENSIONS[ext]) {
      return mcpError(`Error: Only .txt, .md, and .json files are allowed. Got ".${ext}". Please use a .txt extension instead.`);
    }

    const folderError = validateFolderId(folder_id);
    if (folderError) return mcpError(`Error: ${folderError}`);

    const data = new TextEncoder().encode(content);

    if (data.byteLength > config.maxFileSize) {
      return mcpError(`Error: Content size (${data.byteLength} bytes) exceeds max file size (${config.maxFileSize} bytes)`);
    }

    if (data.byteLength === 0) {
      return mcpError("Error: File content is empty");
    }

    return doUpload({
      filename: safeName,
      data,
      contentType: ALLOWED_TEXT_EXTENSIONS[ext],
      expiry_hours,
      password,
      folder_id,
    });
  });

  mcp.registerTool("upload_file", {
    title: "Upload File",
    description:
      "Upload a binary file (base64-encoded) to snag.zip. Any file type is allowed. Best for small files like screenshots, images, or code snippets.",
    inputSchema: {
      filename: z.string().describe("Filename with extension (e.g. 'screenshot.png')"),
      content_base64: z.string().describe("Base64-encoded file content"),
      expiry_hours: z.number().optional().describe("Hours until the file expires. Omit for default behavior."),
      password: z.string().optional().describe("Optional password to protect the download"),
      folder_id: z.string().optional().describe("Optional folder ID to add the file to"),
    },
  }, async ({ filename, content_base64, expiry_hours, password, folder_id }) => {
    const safeName = ensureBasename(filename, "unnamed");

    const folderError = validateFolderId(folder_id);
    if (folderError) return mcpError(`Error: ${folderError}`);

    if (!BASE64_REGEX.test(content_base64)) {
      return mcpError("Error: Invalid base64 content. The content_base64 field must contain valid base64-encoded data.");
    }

    const cleaned = cleanBase64(content_base64);

    // Early size check before decoding (base64 is ~33% larger than raw)
    if (cleaned.length > config.maxFileSize * 1.4) {
      return mcpError(`Error: File too large. Max size is ${config.maxFileSize} bytes.`);
    }

    const data = Buffer.from(cleaned, "base64");

    if (data.byteLength === 0) {
      return mcpError("Error: File content is empty (base64 decoded to 0 bytes)");
    }

    if (data.byteLength > config.maxFileSize) {
      return mcpError(`Error: File size (${data.byteLength} bytes) exceeds max file size (${config.maxFileSize} bytes)`);
    }

    return doUpload({
      filename: safeName,
      data,
      contentType: mimeFromFilename(safeName),
      expiry_hours,
      password,
      folder_id,
    });
  });

  mcp.registerTool("upload_from_url", {
    title: "Upload from URL",
    description:
      "Fetch a file from a URL and upload it to snag.zip. The server downloads the file directly — no base64 overhead. Best for large files like PDFs, datasets, or archives.",
    inputSchema: {
      url: z.string().describe("URL to fetch the file from (http or https only)"),
      filename: z.string().optional().describe("Override filename. If omitted, derived from URL or Content-Disposition header."),
      expiry_hours: z.number().optional().describe("Hours until the file expires. Omit for default behavior."),
      password: z.string().optional().describe("Optional password to protect the download"),
      folder_id: z.string().optional().describe("Optional folder ID to add the file to"),
    },
  }, async ({ url: sourceUrl, filename: overrideFilename, expiry_hours, password, folder_id }) => {
    const maxSize = config.mcpMaxUrlFileSize ?? config.maxFileSize;

    const folderError = validateFolderId(folder_id);
    if (folderError) return mcpError(`Error: ${folderError}`);

    const result = await safeFetch(sourceUrl, maxSize);
    if ("error" in result) return mcpError(`Error: ${result.error}`);

    const { response, data } = result;

    if (data.byteLength === 0) {
      return mcpError("Error: Downloaded file is empty (0 bytes)");
    }

    // Derive filename
    const contentDisposition = response.headers.get("content-disposition");
    const safeName = ensureBasename(
      overrideFilename ?? filenameFromContentDisposition(contentDisposition) ?? filenameFromUrl(sourceUrl),
      "download",
    );

    // MIME type from response or filename
    const responseType = response.headers.get("content-type")?.split(";")[0]?.trim();
    const contentType = responseType && responseType !== "application/octet-stream"
      ? responseType
      : mimeFromFilename(safeName);

    return doUpload({
      filename: safeName,
      data,
      contentType,
      expiry_hours,
      password,
      folder_id,
      extra: { source_url: sourceUrl },
    });
  });

  mcp.registerTool("list_files", {
    title: "List Files",
    description: "List all uploaded files on this snag.zip instance",
  }, async () => {
    const files = listFiles();
    const summary = files.map((f) => ({
      id: f.id,
      filename: f.filename,
      size: f.size,
      type: f.type,
      uploaded_at: f.uploaded_at,
      expires_at: f.expires_at,
      downloads: f.downloads,
      url: `${config.baseUrl}/d/${f.id}`,
    }));
    return mcpResult({ files: summary });
  });

  mcp.registerTool("get_file_info", {
    title: "Get File Info",
    description: "Get metadata for a specific file by its ID",
    inputSchema: {
      id: z.string().describe("The file ID (7-character alphanumeric)"),
    },
  }, async ({ id }) => {
    const file = getFile(id);
    if (!file) return mcpError("Error: File not found");
    return mcpResult({ ...file, url: `${config.baseUrl}/d/${file.id}` });
  });

  mcp.registerTool("create_folder", {
    title: "Create Folder",
    description: "Create a folder to group files together",
    inputSchema: {
      title: z.string().optional().describe("Folder title"),
      slug: z.string().optional().describe("Custom URL slug. Auto-generated if omitted."),
      description: z.string().optional().describe("Folder description"),
      expiry_hours: z.number().optional().describe("Hours until the folder expires"),
    },
  }, async ({ title, slug, description, expiry_hours }) => {
    const id = generateId();
    const folderSlug = slug ?? generateId();
    const expiresAt = parseExpiry(expiry_hours?.toString());

    try {
      insertFolder({
        id,
        slug: folderSlug,
        title: title ?? null,
        description: description ?? null,
        expires_at: expiresAt,
      });
    } catch {
      const fallbackSlug = generateId();
      try {
        insertFolder({
          id,
          slug: fallbackSlug,
          title: title ?? null,
          description: description ?? null,
          expires_at: expiresAt,
        });
      } catch (err) {
        return mcpError(`Error: Failed to create folder: ${err instanceof Error ? err.message : String(err)}`);
      }
      return mcpResult({ id, slug: fallbackSlug, url: `${config.baseUrl}/f/${fallbackSlug}` });
    }

    return mcpResult({ id, slug: folderSlug, url: `${config.baseUrl}/f/${folderSlug}` });
  });

  mcp.registerTool("list_folders", {
    title: "List Folders",
    description: "List all folders on this snag.zip instance",
  }, async () => {
    const folders = listFolders();
    const summary = folders.map((f) => ({
      ...f,
      url: `${config.baseUrl}/f/${f.slug}`,
    }));
    return mcpResult({ folders: summary });
  });

  return mcp;
}

export const mcpRoutes = new Elysia()
  .all("/mcp", async ({ request }) => {
    const server = createMcpServer();
    const transport = new WebStandardStreamableHTTPServerTransport({
      sessionIdGenerator: undefined,
    });
    await server.connect(transport);
    return transport.handleRequest(request);
  });
