import { Elysia, t } from "elysia";
import { getFile, incrementDownloads } from "../db";
import { getFile as getS3File } from "../s3";
import { config } from "../config";
import { safeContentDisposition } from "../lib/format";
import { html, isExpired } from "../lib/http";
import { downloadPage, downloadUnlockedPage, expiredPage } from "../templates/download-page";

// Short-lived single-use download tokens (for all files)
const downloadTokens = new Map<string, number>();

export function cleanupExpiredTokens() {
  const now = Date.now();
  for (const [token, expiry] of downloadTokens) {
    if (now > expiry) downloadTokens.delete(token);
  }
}

function createDownloadToken(fileId: string): string {
  const token = `${fileId}:${crypto.randomUUID()}`;
  downloadTokens.set(token, Date.now() + 5 * 60 * 1000);
  return token;
}

function verifyDownloadToken(token: string, fileId: string): boolean {
  const expiry = downloadTokens.get(token);
  if (!expiry || !token.startsWith(fileId + ":")) return false;
  if (Date.now() > expiry) {
    downloadTokens.delete(token);
    return false;
  }
  downloadTokens.delete(token);
  return true;
}

export const downloadRoutes = new Elysia({ prefix: "/d" })
  .get("/:id", ({ params }) => {
    const file = getFile(params.id);
    if (!file || isExpired(file.expires_at)) return html(expiredPage(), 410);
    const token = file.password_hash ? null : createDownloadToken(file.id);
    return html(downloadPage(file, config.baseUrl, undefined, token));
  })
  .post(
    "/:id",
    async ({ params, body }) => {
      const file = getFile(params.id);
      if (!file || isExpired(file.expires_at)) return html(expiredPage(), 410);
      if (!file.password_hash) return html(downloadPage(file, config.baseUrl));
      const valid = await Bun.password.verify(body.password, file.password_hash);
      if (!valid) return html(downloadPage(file, config.baseUrl, "Wrong password."));
      const token = createDownloadToken(file.id);
      return html(downloadUnlockedPage(file, config.baseUrl, token));
    },
    { body: t.Object({ password: t.String() }) }
  )
  .post(
    "/:id/download",
    ({ params, body }) => {
      const file = getFile(params.id);
      if (!file || isExpired(file.expires_at)) return new Response("Not found", { status: 410 });
      if (!body.token || !verifyDownloadToken(body.token, file.id)) {
        return new Response("Unauthorized", { status: 401 });
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
    },
    { body: t.Object({ token: t.String() }) }
  );
