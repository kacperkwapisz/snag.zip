import { Elysia, t } from "elysia";
import { generateId } from "../lib/id";
import { sanitizeFilename, safeContentDisposition } from "../lib/format";
import {
  uploadFile,
  getFile as getS3File,
  deleteFile as deleteS3File,
  createMultipartUpload,
  presignUploadPart,
  completeMultipartUpload,
  abortMultipartUpload,
} from "../s3";
import {
  insertFile,
  getFile,
  listFiles,
  deleteFileRecord,
  incrementDownloads,
  getFolder,
  insertFolder,
  getFolderBySlug,
  getFilesByFolder,
  deleteFolderRecord,
  getStats,
  getApiKeyByHash,
  updateApiKeyLastUsed,
  type ApiKeyRow,
} from "../db";
import { config } from "../config";
import { isExpired } from "../lib/http";
import { pendingUploads, parseExpiry } from "./upload";
import { customAlphabet } from "nanoid";

// --- Helpers ---

const generateKeySecret = customAlphabet(
  "0123456789abcdefghijklmnopqrstuvwxyz",
  32,
);

export function generateApiKey(): string {
  return `snag_${generateKeySecret()}`;
}

const encoder = new TextEncoder();

export async function hashApiKey(key: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", encoder.encode(key));
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

function apiError(status: number, code: string, message: string) {
  return new Response(JSON.stringify({ error: { code, message } }), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

async function authenticateApiKey(
  request: Request,
): Promise<ApiKeyRow | null> {
  const header = request.headers.get("Authorization");
  if (!header?.startsWith("Bearer ")) return null;
  const key = header.slice(7);
  if (!key.startsWith("snag_")) return null;
  const hash = await hashApiKey(key);
  const apiKey = getApiKeyByHash(hash);
  if (!apiKey) return null;
  updateApiKeyLastUsed(apiKey.id);
  return apiKey;
}

function fileResponse(file: {
  id: string;
  filename: string;
  size: number;
  type: string;
  uploaded_at: string;
  expires_at: string | null;
  downloads: number;
  password_hash: string | null;
  folder_id: string | null;
}) {
  return {
    id: file.id,
    filename: file.filename,
    size: file.size,
    type: file.type,
    uploaded_at: file.uploaded_at,
    expires_at: file.expires_at,
    downloads: file.downloads,
    has_password: !!file.password_hash,
    folder_id: file.folder_id,
    url: `${config.baseUrl}/d/${file.id}`,
    download_url: `${config.baseUrl}/api/v1/files/${file.id}/content`,
  };
}

// --- Routes ---

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
  "Access-Control-Max-Age": "86400",
};

export const apiRoutes = new Elysia({ prefix: "/api/v1" })
  .onError(({ code, error }) => {
    if (code === "VALIDATION") {
      const summary = error.message.match(/"summary":\s*"([^"]+)"/)?.[1] ?? error.message;
      const property = error.message.match(/"property":\s*"\/([^"]+)"/)?.[1];
      const msg = property ? `${property}: ${summary}` : summary;
      return apiError(400, "bad_request", msg);
    }
    if (code === "NOT_FOUND") {
      return apiError(404, "not_found", "Endpoint not found");
    }
  })
  .options("/*", () => new Response(null, { status: 204, headers: corsHeaders }))
  // --- Files ---
  .post(
    "/files",
    async ({ body, request }) => {
      const apiKey = await authenticateApiKey(request);
      if (!apiKey) return apiError(401, "unauthorized", "Invalid or missing API key");

      const file = body.file;
      const filename = sanitizeFilename(file.name) || "unnamed";
      const id = generateId();
      const s3Key = `files/${id}/${filename}`;

      if (body.folder_id) {
        const folder = getFolder(body.folder_id);
        if (!folder) return apiError(400, "bad_request", "Folder not found");
        if (isExpired(folder.expires_at)) return apiError(410, "expired", "Folder has expired");
      }

      try {
        await uploadFile(s3Key, file, filename);
      } catch {
        return apiError(502, "storage_error", "Storage upload failed");
      }

      const expiresAt = parseExpiry(body.expiry);

      let passwordHash: string | null = null;
      if (body.password) {
        passwordHash = await Bun.password.hash(body.password);
      }

      insertFile({
        id,
        filename,
        size: file.size,
        type: file.type || "application/octet-stream",
        s3_key: s3Key,
        folder_id: body.folder_id ?? null,
        expires_at: expiresAt,
        password_hash: passwordHash,
      });

      const inserted = getFile(id)!;
      return fileResponse(inserted);
    },
    {
      body: t.Object({
        file: t.File({ maxSize: config.maxFileSize }),
        expiry: t.Optional(t.String()),
        password: t.Optional(t.String()),
        folder_id: t.Optional(t.String()),
      }),
    },
  )

  .get("/files", async ({ request }) => {
    const apiKey = await authenticateApiKey(request);
    if (!apiKey) return apiError(401, "unauthorized", "Invalid or missing API key");

    const files = listFiles().filter((f) => !isExpired(f.expires_at));
    return { files: files.map(fileResponse) };
  })

  .get("/files/:id", async ({ params, request }) => {
    const apiKey = await authenticateApiKey(request);
    if (!apiKey) return apiError(401, "unauthorized", "Invalid or missing API key");

    const file = getFile(params.id);
    if (!file) return apiError(404, "not_found", "File not found");
    if (isExpired(file.expires_at)) return apiError(410, "expired", "File has expired");

    return fileResponse(file);
  })

  .get("/files/:id/content", async ({ params, request }) => {
    const apiKey = await authenticateApiKey(request);
    if (!apiKey) return apiError(401, "unauthorized", "Invalid or missing API key");

    const file = getFile(params.id);
    if (!file) return apiError(404, "not_found", "File not found");
    if (isExpired(file.expires_at)) return apiError(410, "expired", "File has expired");

    if (file.password_hash) {
      const url = new URL(request.url);
      const password = url.searchParams.get("password");
      if (!password) return apiError(401, "unauthorized", "Password required");
      const valid = await Bun.password.verify(password, file.password_hash);
      if (!valid) return apiError(401, "unauthorized", "Wrong password");
    }

    incrementDownloads(file.id);
    const s3File = getS3File(file.s3_key);
    return new Response(s3File.stream(), {
      headers: {
        "Content-Type": file.type,
        "Content-Disposition": safeContentDisposition(file.filename),
        "Content-Length": String(file.size),
      },
    });
  })

  .delete("/files/:id", async ({ params, request }) => {
    const apiKey = await authenticateApiKey(request);
    if (!apiKey) return apiError(401, "unauthorized", "Invalid or missing API key");

    const file = getFile(params.id);
    if (!file) return apiError(404, "not_found", "File not found");

    try {
      await deleteS3File(file.s3_key);
    } catch {
      return apiError(502, "storage_error", "Failed to delete file from storage");
    }
    deleteFileRecord(file.id);
    return { ok: true };
  })

  // --- Multipart Upload ---
  .post(
    "/files/multipart/init",
    async ({ body, request }) => {
      const apiKey = await authenticateApiKey(request);
      if (!apiKey) return apiError(401, "unauthorized", "Invalid or missing API key");

      if (body.size > config.maxFileSize) {
        return apiError(413, "file_too_large", `File exceeds maximum size of ${config.maxFileSize} bytes`);
      }

      const filename = sanitizeFilename(body.filename) || "unnamed";

      if (body.folder_id) {
        const folder = getFolder(body.folder_id);
        if (!folder) return apiError(400, "bad_request", "Folder not found");
        if (isExpired(folder.expires_at)) return apiError(410, "expired", "Folder has expired");
      }

      const fileId = generateId();
      const key = `files/${fileId}/${filename}`;
      const contentType = body.content_type || "application/octet-stream";
      const PART_SIZE = 5 * 1024 * 1024;

      const uploadId = await createMultipartUpload(key, contentType, filename);
      const totalParts = Math.ceil(body.size / PART_SIZE);

      pendingUploads.set(fileId, {
        key,
        uploadId,
        filename,
        size: body.size,
        contentType,
        folderId: body.folder_id ?? null,
        createdAt: Date.now(),
      });

      return { file_id: fileId, upload_id: uploadId, part_size: PART_SIZE, total_parts: totalParts };
    },
    {
      body: t.Object({
        filename: t.String(),
        content_type: t.String(),
        size: t.Number(),
        folder_id: t.Optional(t.String()),
      }),
    },
  )

  .post(
    "/files/multipart/presign",
    async ({ body, request }) => {
      const apiKey = await authenticateApiKey(request);
      if (!apiKey) return apiError(401, "unauthorized", "Invalid or missing API key");

      const upload = pendingUploads.get(body.file_id);
      if (!upload) return apiError(404, "not_found", "Upload not found");

      const urls: Record<number, string> = {};
      for (const partNumber of body.part_numbers) {
        urls[partNumber] = await presignUploadPart(
          upload.key,
          upload.uploadId,
          partNumber,
        );
      }

      return { urls };
    },
    {
      body: t.Object({
        file_id: t.String(),
        part_numbers: t.Array(t.Number()),
      }),
    },
  )

  .post(
    "/files/multipart/complete",
    async ({ body, request }) => {
      const apiKey = await authenticateApiKey(request);
      if (!apiKey) return apiError(401, "unauthorized", "Invalid or missing API key");

      const upload = pendingUploads.get(body.file_id);
      if (!upload) return apiError(404, "not_found", "Upload not found");

      try {
        await completeMultipartUpload(upload.key, upload.uploadId, body.parts);
      } catch {
        return apiError(502, "storage_error", "Failed to complete upload");
      }

      const expiresAt = parseExpiry(body.expiry);

      let passwordHash: string | null = null;
      if (body.password) {
        passwordHash = await Bun.password.hash(body.password);
      }

      insertFile({
        id: body.file_id,
        filename: upload.filename,
        size: upload.size,
        type: upload.contentType,
        s3_key: upload.key,
        folder_id: upload.folderId,
        expires_at: expiresAt,
        password_hash: passwordHash,
      });

      pendingUploads.delete(body.file_id);

      const inserted = getFile(body.file_id)!;
      return fileResponse(inserted);
    },
    {
      body: t.Object({
        file_id: t.String(),
        parts: t.Array(
          t.Object({
            partNumber: t.Number(),
            etag: t.String(),
          }),
        ),
        expiry: t.Optional(t.String()),
        password: t.Optional(t.String()),
      }),
    },
  )

  .post(
    "/files/multipart/abort",
    async ({ body, request }) => {
      const apiKey = await authenticateApiKey(request);
      if (!apiKey) return apiError(401, "unauthorized", "Invalid or missing API key");

      const upload = pendingUploads.get(body.file_id);
      if (!upload) return apiError(404, "not_found", "Upload not found");

      await abortMultipartUpload(upload.key, upload.uploadId).catch(() => {});
      pendingUploads.delete(body.file_id);

      return { ok: true };
    },
    {
      body: t.Object({
        file_id: t.String(),
      }),
    },
  )

  // --- Folders ---
  .post(
    "/folders",
    async ({ body, request }) => {
      const apiKey = await authenticateApiKey(request);
      if (!apiKey) return apiError(401, "unauthorized", "Invalid or missing API key");

      const id = generateId();
      const slug = body.slug ?? generateId();

      const expiresAt = parseExpiry(body.expiry);

      let usedSlug = slug;
      try {
        insertFolder({
          id,
          slug,
          title: body.title ?? null,
          description: body.description ?? null,
          expires_at: expiresAt,
        });
      } catch {
        usedSlug = generateId();
        insertFolder({
          id,
          slug: usedSlug,
          title: body.title ?? null,
          description: body.description ?? null,
          expires_at: expiresAt,
        });
      }

      const folder = getFolderBySlug(usedSlug)!;
      return {
        id: folder.id,
        slug: folder.slug,
        title: folder.title,
        description: folder.description,
        created_at: folder.created_at,
        expires_at: folder.expires_at,
        url: `${config.baseUrl}/f/${folder.slug}`,
      };
    },
    {
      body: t.Object({
        slug: t.Optional(t.String()),
        title: t.Optional(t.String()),
        description: t.Optional(t.String()),
        expiry: t.Optional(t.String()),
      }),
    },
  )

  .get("/folders/:slug", async ({ params, request }) => {
    const apiKey = await authenticateApiKey(request);
    if (!apiKey) return apiError(401, "unauthorized", "Invalid or missing API key");

    const folder = getFolderBySlug(params.slug);
    if (!folder) return apiError(404, "not_found", "Folder not found");
    if (isExpired(folder.expires_at)) return apiError(410, "expired", "Folder has expired");

    const files = getFilesByFolder(folder.id);
    return {
      id: folder.id,
      slug: folder.slug,
      title: folder.title,
      description: folder.description,
      created_at: folder.created_at,
      expires_at: folder.expires_at,
      url: `${config.baseUrl}/f/${folder.slug}`,
      files: files.map((f) => ({
        id: f.id,
        filename: f.filename,
        size: f.size,
        type: f.type,
        uploaded_at: f.uploaded_at,
        downloads: f.downloads,
        url: `${config.baseUrl}/d/${f.id}`,
      })),
    };
  })

  .delete("/folders/:slug", async ({ params, request }) => {
    const apiKey = await authenticateApiKey(request);
    if (!apiKey) return apiError(401, "unauthorized", "Invalid or missing API key");

    const folder = getFolderBySlug(params.slug);
    if (!folder) return apiError(404, "not_found", "Folder not found");

    const files = getFilesByFolder(folder.id);
    for (const file of files) {
      await deleteS3File(file.s3_key).catch(() => {});
      deleteFileRecord(file.id);
    }
    deleteFolderRecord(folder.id);

    return { ok: true, deleted_files: files.length };
  })

  // --- Stats ---
  .get("/stats", async ({ request }) => {
    const apiKey = await authenticateApiKey(request);
    if (!apiKey) return apiError(401, "unauthorized", "Invalid or missing API key");

    return getStats();
  });
