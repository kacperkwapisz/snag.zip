import { Elysia, t } from "elysia";
import { generateId } from "../lib/id";
import { sanitizeFilename } from "../lib/format";
import { uploadFile } from "../s3";
import { insertFile, getFolder } from "../db";
import { config } from "../config";
import { isAuthenticated } from "./admin";

export const uploadRoutes = new Elysia()
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

      let expiresAt: string | null = null;
      if (body.expiry) {
        const hours = Number(body.expiry);
        if (hours > 0) {
          const d = new Date(Date.now() + hours * 60 * 60 * 1000);
          expiresAt = d.toISOString().replace("T", " ").slice(0, 19);
        }
      }

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
    }
  );
