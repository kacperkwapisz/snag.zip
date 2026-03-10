import { Elysia, t } from "elysia";
import { generateId } from "../lib/id";
import { sanitizeFilename, safeContentDisposition } from "../lib/format";
import { html, isExpired } from "../lib/http";
import { insertFolder, getFolderBySlug, getFilesByFolder } from "../db";
import { getFile as getS3File } from "../s3";
import { config } from "../config";
import { folderPage } from "../templates/folder-page";
import { expiredPage } from "../templates/download-page";
import { createZipStream } from "../lib/zip";
import { isAuthenticated } from "./admin";
import { parseExpiry } from "./upload";

export const folderRoutes = new Elysia()
  .post(
    "/folder",
    async ({ body, request }) => {
      if (!config.publicUploads && !(await isAuthenticated(request.headers))) {
        return new Response("Unauthorized", { status: 401 });
      }
      const id = generateId();
      const slug = body.slug ?? generateId();

      const expiresAt = parseExpiry(body.expiry);

      try {
        insertFolder({
          id,
          slug,
          title: body.title ?? null,
          description: body.description ?? null,
          expires_at: expiresAt,
        });
      } catch {
        const fallbackSlug = generateId();
        insertFolder({
          id,
          slug: fallbackSlug,
          title: body.title ?? null,
          description: body.description ?? null,
          expires_at: expiresAt,
        });
        return { id, slug: fallbackSlug, url: `${config.baseUrl}/f/${fallbackSlug}` };
      }

      return { id, slug, url: `${config.baseUrl}/f/${slug}` };
    },
    {
      body: t.Object({
        slug: t.Optional(t.String()),
        title: t.Optional(t.String()),
        description: t.Optional(t.String()),
        expiry: t.Optional(t.String()),
      }),
    }
  )
  .get("/f/:slug", ({ params }) => {
    const folder = getFolderBySlug(params.slug);
    if (!folder || isExpired(folder.expires_at)) return html(expiredPage(), 410);
    const files = getFilesByFolder(folder.id);
    return html(folderPage(folder, files));
  })
  .get("/f/:slug/zip", ({ params }) => {
    const folder = getFolderBySlug(params.slug);
    if (!folder || isExpired(folder.expires_at)) return new Response("Not found", { status: 410 });
    const files = getFilesByFolder(folder.id);
    if (files.length === 0) return new Response("No files in folder", { status: 404 });

    const zipEntries = files.map((f) => ({
      name: sanitizeFilename(f.filename) || "unnamed",
      stream: () => getS3File(f.s3_key).stream(),
      size: f.size,
    }));
    const zipName = (folder.title ?? folder.slug) + ".zip";

    return new Response(createZipStream(zipEntries), {
      headers: {
        "Content-Type": "application/zip",
        "Content-Disposition": safeContentDisposition(zipName),
      },
    });
  });
