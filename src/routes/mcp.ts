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

const ALLOWED_EXTENSIONS: Record<string, string> = {
  txt: "text/plain",
  md: "text/markdown",
  json: "application/json",
};

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
