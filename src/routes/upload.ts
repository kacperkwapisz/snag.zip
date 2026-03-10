import { Elysia, t } from "elysia";
import { generateId } from "../lib/id";
import { sanitizeFilename } from "../lib/format";
import {
  uploadFile,
  createMultipartUpload,
  presignUploadPart,
  completeMultipartUpload,
  abortMultipartUpload,
} from "../s3";
import { insertFile, getFolder } from "../db";
import { config } from "../config";
import { isAuthenticated } from "./admin";

const PART_SIZE = 5 * 1024 * 1024; // 5MB

export interface PendingUpload {
  key: string;
  uploadId: string;
  filename: string;
  size: number;
  contentType: string;
  folderId: string | null;
  createdAt: number;
}

export const pendingUploads = new Map<string, PendingUpload>();

export function cleanupPendingUploads() {
  const now = Date.now();
  const maxAge = 60 * 60 * 1000; // 1 hour
  for (const [fileId, upload] of pendingUploads) {
    if (now - upload.createdAt > maxAge) {
      abortMultipartUpload(upload.key, upload.uploadId).catch(() => {});
      pendingUploads.delete(fileId);
    }
  }
}

export function parseExpiry(expiry?: string): string | null {
  if (!expiry) return null;
  const hours = Number(expiry);
  if (hours > 0 && Number.isFinite(hours)) {
    const clamped = Math.min(hours, 8760); // max 1 year
    const d = new Date(Date.now() + clamped * 60 * 60 * 1000);
    return d.toISOString().replace("T", " ").slice(0, 19);
  }
  return null;
}

export const uploadRoutes = new Elysia()
  // Existing direct upload (small files)
  .post(
    "/upload",
    async ({ body, request }) => {
      if (!config.publicUploads && !(await isAuthenticated(request.headers))) {
        return new Response("Unauthorized", { status: 401 });
      }
      const file = body.file;
      const filename = sanitizeFilename(file.name) || "unnamed";
      const id = generateId();
      const s3Key = `files/${id}/${filename}`;

      if (body.folder_id) {
        const folder = getFolder(body.folder_id);
        if (!folder) return new Response("Folder not found", { status: 400 });
      }

      try {
        await uploadFile(s3Key, file, filename);
      } catch {
        return new Response("Storage upload failed", { status: 502 });
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

      return { id, url: `${config.baseUrl}/d/${id}`, filename, size: file.size };
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
  // Multipart: init
  .post(
    "/upload/init",
    async ({ body, request }) => {
      if (!config.publicUploads && !(await isAuthenticated(request.headers))) {
        return new Response("Unauthorized", { status: 401 });
      }

      if (body.size > config.maxFileSize) {
        return new Response("File too large", { status: 413 });
      }

      const filename = sanitizeFilename(body.filename) || "unnamed";

      if (body.folderId) {
        const folder = getFolder(body.folderId);
        if (!folder) return new Response("Folder not found", { status: 400 });
      }

      const fileId = generateId();
      const key = `files/${fileId}/${filename}`;
      const contentType = body.contentType || "application/octet-stream";

      const uploadId = await createMultipartUpload(key, contentType, filename);

      const totalParts = Math.ceil(body.size / PART_SIZE);

      pendingUploads.set(fileId, {
        key,
        uploadId,
        filename,
        size: body.size,
        contentType,
        folderId: body.folderId ?? null,
        createdAt: Date.now(),
      });

      return { fileId, uploadId, key, partSize: PART_SIZE, totalParts };
    },
    {
      body: t.Object({
        filename: t.String(),
        contentType: t.String(),
        size: t.Number(),
        folderId: t.Optional(t.String()),
      }),
    },
  )
  // Multipart: presign parts
  .post(
    "/upload/presign-parts",
    async ({ body, request }) => {
      if (!config.publicUploads && !(await isAuthenticated(request.headers))) {
        return new Response("Unauthorized", { status: 401 });
      }

      const upload = pendingUploads.get(body.fileId);
      if (!upload) return new Response("Upload not found", { status: 404 });

      const urls: Record<number, string> = {};
      for (const partNumber of body.partNumbers) {
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
        fileId: t.String(),
        partNumbers: t.Array(t.Number()),
      }),
    },
  )
  // Multipart: complete
  .post(
    "/upload/complete",
    async ({ body, request }) => {
      if (!config.publicUploads && !(await isAuthenticated(request.headers))) {
        return new Response("Unauthorized", { status: 401 });
      }

      const upload = pendingUploads.get(body.fileId);
      if (!upload) return new Response("Upload not found", { status: 404 });

      try {
        await completeMultipartUpload(upload.key, upload.uploadId, body.parts);
      } catch {
        return new Response("Failed to complete upload", { status: 502 });
      }

      const expiresAt = parseExpiry(body.expiry);

      let passwordHash: string | null = null;
      if (body.password) {
        passwordHash = await Bun.password.hash(body.password);
      }

      insertFile({
        id: body.fileId,
        filename: upload.filename,
        size: upload.size,
        type: upload.contentType,
        s3_key: upload.key,
        folder_id: upload.folderId,
        expires_at: expiresAt,
        password_hash: passwordHash,
      });

      pendingUploads.delete(body.fileId);

      return {
        id: body.fileId,
        url: `${config.baseUrl}/d/${body.fileId}`,
        filename: upload.filename,
        size: upload.size,
      };
    },
    {
      body: t.Object({
        fileId: t.String(),
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
  // Multipart: abort
  .post(
    "/upload/abort",
    async ({ body, request }) => {
      if (!config.publicUploads && !(await isAuthenticated(request.headers))) {
        return new Response("Unauthorized", { status: 401 });
      }

      const upload = pendingUploads.get(body.fileId);
      if (!upload) return new Response("Upload not found", { status: 404 });

      await abortMultipartUpload(upload.key, upload.uploadId).catch(() => {});
      pendingUploads.delete(body.fileId);

      return { ok: true };
    },
    {
      body: t.Object({
        fileId: t.String(),
      }),
    },
  );
