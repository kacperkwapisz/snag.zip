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
  insertFolder,
  listFolders,
} from "../db";
import { parseExpiry } from "./upload";
import { lookup as dnsLookup } from "node:dns/promises";

const ALLOWED_EXTENSIONS: Record<string, string> = {
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

function isPrivateIp(ip: string): boolean {
  // IPv4 private/reserved ranges
  const parts = ip.split(".").map(Number);
  if (parts.length === 4 && parts.every((n) => n >= 0 && n <= 255)) {
    if (parts[0] === 127) return true;                          // 127.0.0.0/8
    if (parts[0] === 10) return true;                           // 10.0.0.0/8
    if (parts[0] === 172 && parts[1] >= 16 && parts[1] <= 31) return true; // 172.16.0.0/12
    if (parts[0] === 192 && parts[1] === 168) return true;     // 192.168.0.0/16
    if (parts[0] === 169 && parts[1] === 254) return true;     // 169.254.0.0/16 (link-local/AWS metadata)
    if (parts[0] === 0) return true;                            // 0.0.0.0/8
  }
  // IPv6 loopback and private
  if (ip === "::1" || ip === "::") return true;
  if (ip.startsWith("fc") || ip.startsWith("fd")) return true; // fc00::/7
  if (ip.startsWith("fe80")) return true;                       // link-local
  return false;
}

async function validateUrlSafety(url: string): Promise<string | null> {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return "Invalid URL";
  }
  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    return `Protocol "${parsed.protocol}" is not allowed. Only http: and https: are supported.`;
  }
  // Check if hostname is a direct IP
  if (isPrivateIp(parsed.hostname)) {
    return "URL points to a private/internal IP address";
  }
  // Resolve hostname and check for private IPs
  try {
    const { address } = await dnsLookup(parsed.hostname);
    if (isPrivateIp(address)) {
      return "URL resolves to a private/internal IP address";
    }
  } catch {
    return `Could not resolve hostname "${parsed.hostname}"`;
  }
  return null;
}

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
  // Try filename*= (RFC 5987) first, then filename=
  const starMatch = header.match(/filename\*=(?:UTF-8''|utf-8'')([^;\s]+)/i);
  if (starMatch) {
    try { return decodeURIComponent(starMatch[1]); } catch { /* fall through */ }
  }
  const match = header.match(/filename="?([^";\s]+)"?/i);
  return match?.[1] ?? null;
}

const BASE64_REGEX = /^[A-Za-z0-9+/]*={0,2}$/;

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
    const safeName = sanitizeFilename(filename) || "unnamed.txt";
    const ext = safeName.split(".").pop()?.toLowerCase() ?? "";

    if (!ALLOWED_EXTENSIONS[ext]) {
      return {
        content: [{
          type: "text" as const,
          text: `Error: Only .txt, .md, and .json files are allowed. Got ".${ext}". Please use a .txt extension instead.`,
        }],
        isError: true,
      };
    }

    const data = new TextEncoder().encode(content);

    if (data.byteLength > config.maxFileSize) {
      return {
        content: [{
          type: "text" as const,
          text: `Error: Content size (${data.byteLength} bytes) exceeds max file size (${config.maxFileSize} bytes)`,
        }],
        isError: true,
      };
    }

    const contentType = ALLOWED_EXTENSIONS[ext];
    const id = generateId();
    const s3Key = `files/${id}/${safeName}`;

    await uploadFile(s3Key, data, safeName);

    const expiresAt = parseExpiry(expiry_hours?.toString());

    let passwordHash: string | null = null;
    if (password) {
      passwordHash = await Bun.password.hash(password);
    }

    insertFile({
      id,
      filename: safeName,
      size: data.byteLength,
      type: contentType,
      s3_key: s3Key,
      folder_id: folder_id ?? null,
      expires_at: expiresAt,
      password_hash: passwordHash,
    });

    const url = `${config.baseUrl}/d/${id}`;

    return {
      content: [{
        type: "text" as const,
        text: JSON.stringify({ id, url, filename: safeName, size: data.byteLength, expires_at: expiresAt }, null, 2),
      }],
    };
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
    const safeName = sanitizeFilename(filename) || "unnamed";

    // Early size check before decoding (base64 is ~33% larger than raw)
    if (content_base64.length > config.maxFileSize * 1.4) {
      return {
        content: [{
          type: "text" as const,
          text: `Error: File too large. Max size is ${config.maxFileSize} bytes.`,
        }],
        isError: true,
      };
    }

    if (!BASE64_REGEX.test(content_base64)) {
      return {
        content: [{
          type: "text" as const,
          text: "Error: Invalid base64 content. The content_base64 field must contain valid base64-encoded data.",
        }],
        isError: true,
      };
    }

    const data = Buffer.from(content_base64, "base64");

    if (data.byteLength > config.maxFileSize) {
      return {
        content: [{
          type: "text" as const,
          text: `Error: File size (${data.byteLength} bytes) exceeds max file size (${config.maxFileSize} bytes)`,
        }],
        isError: true,
      };
    }

    const contentType = mimeFromFilename(safeName);
    const id = generateId();
    const s3Key = `files/${id}/${safeName}`;

    await uploadFile(s3Key, data, safeName);

    const expiresAt = parseExpiry(expiry_hours?.toString());

    let passwordHash: string | null = null;
    if (password) {
      passwordHash = await Bun.password.hash(password);
    }

    insertFile({
      id,
      filename: safeName,
      size: data.byteLength,
      type: contentType,
      s3_key: s3Key,
      folder_id: folder_id ?? null,
      expires_at: expiresAt,
      password_hash: passwordHash,
    });

    const url = `${config.baseUrl}/d/${id}`;

    return {
      content: [{
        type: "text" as const,
        text: JSON.stringify({ id, url, filename: safeName, size: data.byteLength, expires_at: expiresAt }, null, 2),
      }],
    };
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

    // Validate URL protocol and SSRF
    const urlError = await validateUrlSafety(sourceUrl);
    if (urlError) {
      return {
        content: [{ type: "text" as const, text: `Error: ${urlError}` }],
        isError: true,
      };
    }

    // Fetch with timeout
    let response: Response;
    try {
      response = await fetch(sourceUrl, {
        signal: AbortSignal.timeout(30_000),
        redirect: "follow",
      });
    } catch (err) {
      const msg = err instanceof Error && err.name === "TimeoutError"
        ? "Request timed out after 30 seconds"
        : `Failed to fetch URL: ${err instanceof Error ? err.message : String(err)}`;
      return {
        content: [{ type: "text" as const, text: `Error: ${msg}` }],
        isError: true,
      };
    }

    if (!response.ok) {
      return {
        content: [{
          type: "text" as const,
          text: `Error: URL returned HTTP ${response.status} ${response.statusText}`,
        }],
        isError: true,
      };
    }

    // Pre-check Content-Length
    const contentLength = response.headers.get("content-length");
    if (contentLength && parseInt(contentLength) > maxSize) {
      return {
        content: [{
          type: "text" as const,
          text: `Error: File too large (${contentLength} bytes). Max size for URL uploads is ${maxSize} bytes.`,
        }],
        isError: true,
      };
    }

    // Read body with size limit
    const arrayBuffer = await response.arrayBuffer();
    const data = new Uint8Array(arrayBuffer);

    if (data.byteLength > maxSize) {
      return {
        content: [{
          type: "text" as const,
          text: `Error: Downloaded file (${data.byteLength} bytes) exceeds max size (${maxSize} bytes)`,
        }],
        isError: true,
      };
    }

    // Derive filename
    const contentDisposition = response.headers.get("content-disposition");
    const safeName = sanitizeFilename(
      overrideFilename ?? filenameFromContentDisposition(contentDisposition) ?? filenameFromUrl(sourceUrl),
    ) || "download";

    // MIME type from response or filename
    const responseType = response.headers.get("content-type")?.split(";")[0]?.trim();
    const contentType = responseType && responseType !== "application/octet-stream"
      ? responseType
      : mimeFromFilename(safeName);

    const id = generateId();
    const s3Key = `files/${id}/${safeName}`;

    await uploadFile(s3Key, data, safeName);

    const expiresAt = parseExpiry(expiry_hours?.toString());

    let passwordHash: string | null = null;
    if (password) {
      passwordHash = await Bun.password.hash(password);
    }

    insertFile({
      id,
      filename: safeName,
      size: data.byteLength,
      type: contentType,
      s3_key: s3Key,
      folder_id: folder_id ?? null,
      expires_at: expiresAt,
      password_hash: passwordHash,
    });

    const url = `${config.baseUrl}/d/${id}`;

    return {
      content: [{
        type: "text" as const,
        text: JSON.stringify({ id, url, filename: safeName, size: data.byteLength, expires_at: expiresAt, source_url: sourceUrl }, null, 2),
      }],
    };
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
    return {
      content: [{ type: "text" as const, text: JSON.stringify(summary, null, 2) }],
    };
  });

  mcp.registerTool("get_file_info", {
    title: "Get File Info",
    description: "Get metadata for a specific file by its ID",
    inputSchema: {
      id: z.string().describe("The file ID (7-character alphanumeric)"),
    },
  }, async ({ id }) => {
    const file = getFile(id);
    if (!file) {
      return {
        content: [{ type: "text" as const, text: "Error: File not found" }],
        isError: true,
      };
    }
    return {
      content: [{
        type: "text" as const,
        text: JSON.stringify({ ...file, url: `${config.baseUrl}/d/${file.id}` }, null, 2),
      }],
    };
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
      insertFolder({
        id,
        slug: fallbackSlug,
        title: title ?? null,
        description: description ?? null,
        expires_at: expiresAt,
      });
      return {
        content: [{
          type: "text" as const,
          text: JSON.stringify({ id, slug: fallbackSlug, url: `${config.baseUrl}/f/${fallbackSlug}` }, null, 2),
        }],
      };
    }

    return {
      content: [{
        type: "text" as const,
        text: JSON.stringify({ id, slug: folderSlug, url: `${config.baseUrl}/f/${folderSlug}` }, null, 2),
      }],
    };
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
    return {
      content: [{ type: "text" as const, text: JSON.stringify(summary, null, 2) }],
    };
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
