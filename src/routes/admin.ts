import { Elysia } from "elysia";
import { listFiles, listFolders, getStats, getFile, deleteFileRecord, deleteFolderAndFiles, getFilesByFolder, insertApiKey, listApiKeys, revokeApiKey } from "../db";
import { deleteFile } from "../s3";
import { config } from "../config";
import { html } from "../lib/http";
import { adminPage } from "../templates/admin-page";
import { loginPage } from "../templates/login-page";
import { generateId } from "../lib/id";
import { generateApiKey, hashApiKey } from "./api";

const encoder = new TextEncoder();

async function signToken(payload: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(config.admin.password),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sig = await crypto.subtle.sign("HMAC", key, encoder.encode(payload));
  return `${payload}.${btoa(String.fromCharCode(...new Uint8Array(sig)))}`;
}

const TOKEN_MAX_AGE = 24 * 60 * 60 * 1000; // 24 hours

async function verifyToken(token: string): Promise<boolean> {
  const dot = token.lastIndexOf(".");
  if (dot === -1) return false;
  const payload = token.slice(0, dot);
  const timestamp = Number(payload.split(":")[1]);
  if (!timestamp || Date.now() - timestamp > TOKEN_MAX_AGE) return false;
  const expected = await signToken(payload);
  return token === expected;
}

function getSessionCookie(headers: Headers): string | null {
  const cookies = headers.get("Cookie") ?? "";
  const match = cookies.match(/(?:^|;\s*)admin_session=([^\s;]+)/);
  return match ? match[1] : null;
}

export async function isAuthenticated(headers: Headers): Promise<boolean> {
  const token = getSessionCookie(headers);
  if (!token) return false;
  return verifyToken(decodeURIComponent(token));
}

export const adminRoutes = new Elysia()
  .get("/admin/login", ({ request }) => {
    const url = new URL(request.url);
    const redirect = url.searchParams.get("redirect") ?? "";
    return html(loginPage(undefined, redirect));
  })
  .post("/admin/login", async ({ request }) => {
    const form = await request.formData();
    const username = form.get("username")?.toString() ?? "";
    const password = form.get("password")?.toString() ?? "";
    const redirect = form.get("redirect")?.toString() ?? "";

    if (
      username !== config.admin.username ||
      password !== config.admin.password
    ) {
      return html(loginPage("Invalid username or password", redirect));
    }

    const destination =
      redirect.startsWith("/") && !redirect.startsWith("//")
        ? redirect
        : "/admin";
    const token = await signToken(`${username}:${Date.now()}`);
    return new Response(null, {
      status: 302,
      headers: {
        Location: destination,
        "Set-Cookie": `admin_session=${encodeURIComponent(token)}; Path=/; HttpOnly; SameSite=Strict; Max-Age=86400`,
      },
    });
  })
  .get("/admin", async ({ request }) => {
    if (!(await isAuthenticated(request.headers))) {
      return new Response(null, {
        status: 302,
        headers: { Location: "/admin/login" },
      });
    }
    return html(adminPage(listFiles(), listFolders(), getStats(), listApiKeys()));
  })
  .delete("/admin/files/:id", async ({ request, params }) => {
    if (!(await isAuthenticated(request.headers))) {
      return new Response("Unauthorized", { status: 401 });
    }
    const file = getFile(params.id);
    if (!file) return new Response("Not found", { status: 404 });
    await deleteFile(file.s3_key);
    deleteFileRecord(file.id);
    return new Response("OK");
  })
  .delete("/admin/folders/:id", async ({ request, params }) => {
    if (!(await isAuthenticated(request.headers))) {
      return new Response("Unauthorized", { status: 401 });
    }
    const s3Keys = deleteFolderAndFiles(params.id);
    for (const key of s3Keys) {
      try { await deleteFile(key); } catch { /* S3 cleanup best-effort */ }
    }
    return Response.json({ ok: true, deleted_files: s3Keys.length });
  })
  .post("/admin/api-keys", async ({ request }) => {
    if (!(await isAuthenticated(request.headers))) {
      return new Response("Unauthorized", { status: 401 });
    }
    const form = await request.formData();
    const name = form.get("name")?.toString()?.trim();
    if (!name) {
      return Response.json({ error: "Name is required" }, { status: 400 });
    }
    const id = generateId();
    const key = generateApiKey();
    const keyHash = await hashApiKey(key);
    insertApiKey({ id, name, key_hash: keyHash });
    return Response.json({ id, name, key });
  })
  .delete("/admin/api-keys/:id", async ({ request, params }) => {
    if (!(await isAuthenticated(request.headers))) {
      return new Response("Unauthorized", { status: 401 });
    }
    revokeApiKey(params.id);
    return new Response("OK");
  });
