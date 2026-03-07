import { staticPlugin } from "@elysiajs/static";
import { Elysia } from "elysia";
import { config } from "./config";
import {
  deleteFileRecord,
  deleteFolderRecord,
  getExpiredFiles,
  getExpiredFolders,
  getFilesByFolder,
} from "./db";
import { adminRoutes } from "./routes/admin";
import { downloadRoutes } from "./routes/download";
import { folderRoutes } from "./routes/folder";
import { pageRoutes } from "./routes/pages";
import { uploadRoutes, cleanupPendingUploads } from "./routes/upload";
import { deleteFile } from "./s3";
import { cleanupExpiredTokens } from "./routes/download";

// --- Rate limiting ---
const rateLimitMap = new Map<string, { count: number; reset: number }>();
const uploadRateLimitMap = new Map<string, { count: number; reset: number }>();
const RATE_LIMIT = 60;
const UPLOAD_RATE_LIMIT = 10;
const RATE_WINDOW = 60_000;

function checkRateLimit(
  map: Map<string, { count: number; reset: number }>,
  ip: string,
  limit: number,
): boolean {
  const now = Date.now();
  const entry = map.get(ip);
  if (!entry || now > entry.reset) {
    map.set(ip, { count: 1, reset: now + RATE_WINDOW });
    return false;
  }
  entry.count++;
  return entry.count > limit;
}

// --- App ---
new Elysia()
  .onBeforeHandle(({ request }) => {
    const ip =
      request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
      request.headers.get("cf-connecting-ip") ??
      "unknown";
    const url = new URL(request.url);

    if (
      request.method === "POST" &&
      (url.pathname === "/upload" || url.pathname === "/upload/init")
    ) {
      if (checkRateLimit(uploadRateLimitMap, ip, UPLOAD_RATE_LIMIT)) {
        return new Response("Too many uploads", { status: 429 });
      }
    }

    if (checkRateLimit(rateLimitMap, ip, RATE_LIMIT)) {
      return new Response("Too many requests", { status: 429 });
    }
  })
  .onAfterHandle(({ request, response }) => {
    if (response instanceof Response) {
      response.headers.set("X-Content-Type-Options", "nosniff");
      response.headers.set("X-Frame-Options", "DENY");
      response.headers.set("Referrer-Policy", "no-referrer");
      const s3Origin = config.s3.endpoint ? new URL(config.s3.endpoint).origin : "";
      const connectSrc = s3Origin ? `'self' ${s3Origin}` : "'self'";
      response.headers.set(
        "Content-Security-Policy",
        `default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; font-src 'self'; connect-src ${connectSrc}`,
      );

      const url = new URL(request.url);
      if (url.pathname.startsWith("/upload") && config.publicUploads) {
        response.headers.set("Access-Control-Allow-Origin", "*");
        response.headers.set("Access-Control-Allow-Methods", "POST, OPTIONS");
        response.headers.set("Access-Control-Allow-Headers", "Content-Type");
      }
    }
  })
  .use(staticPlugin({ prefix: "/public" }))
  .use(pageRoutes)
  .use(uploadRoutes)
  .use(folderRoutes)
  .use(adminRoutes)
  .use(downloadRoutes)
  .listen(config.port);

console.log(`snag.zip running at ${config.baseUrl}`);

// --- Cleanup expired files/folders every hour ---
async function cleanup() {
  const expiredFiles = getExpiredFiles();
  for (const file of expiredFiles) {
    try {
      await deleteFile(file.s3_key);
      deleteFileRecord(file.id);
    } catch {
      console.error(`Cleanup: failed to delete S3 object ${file.s3_key}`);
    }
  }
  const expiredFolders = getExpiredFolders();
  for (const folder of expiredFolders) {
    const files = getFilesByFolder(folder.id);
    let allDeleted = true;
    for (const file of files) {
      try {
        await deleteFile(file.s3_key);
        deleteFileRecord(file.id);
      } catch {
        console.error(`Cleanup: failed to delete S3 object ${file.s3_key}`);
        allDeleted = false;
      }
    }
    if (allDeleted) deleteFolderRecord(folder.id);
  }
  if (expiredFiles.length || expiredFolders.length) {
    console.log(
      `Cleanup: removed ${expiredFiles.length} files, ${expiredFolders.length} folders`,
    );
  }
}

setInterval(cleanup, 60 * 60 * 1000);

setInterval(
  () => {
    const now = Date.now();
    for (const [ip, entry] of rateLimitMap) {
      if (now > entry.reset) rateLimitMap.delete(ip);
    }
    for (const [ip, entry] of uploadRateLimitMap) {
      if (now > entry.reset) uploadRateLimitMap.delete(ip);
    }
    cleanupExpiredTokens();
    cleanupPendingUploads();
  },
  5 * 60 * 1000,
);
