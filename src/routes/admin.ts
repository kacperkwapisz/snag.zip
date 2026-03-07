import { Elysia } from "elysia";
import { listFiles, getStats, getFile, deleteFileRecord } from "../db";
import { deleteFile } from "../s3";
import { config } from "../config";
import { html } from "../lib/http";
import { adminPage } from "../templates/admin-page";
import { loginPage } from "../templates/login-page";

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

async function verifyToken(token: string): Promise<boolean> {
  const dot = token.lastIndexOf(".");
  if (dot === -1) return false;
  const payload = token.slice(0, dot);
  const expected = await signToken(payload);
  return token === expected;
}

function getSessionCookie(headers: Headers): string | null {
  const cookies = headers.get("Cookie") ?? "";
  const match = cookies.match(/(?:^|;\s*)admin_session=([^\s;]+)/);
  return match ? match[1] : null;
}

async function isAuthenticated(headers: Headers): Promise<boolean> {
  const token = getSessionCookie(headers);
  if (!token) return false;
  return verifyToken(decodeURIComponent(token));
}

export const adminRoutes = new Elysia()
  .get("/admin/login", ({ request }) => {
    return html(loginPage());
  })
  .post("/admin/login", async ({ request }) => {
    const form = await request.formData();
    const username = form.get("username")?.toString() ?? "";
    const password = form.get("password")?.toString() ?? "";

    if (
      username !== config.admin.username ||
      password !== config.admin.password
    ) {
      return html(loginPage("Invalid username or password"));
    }

    const token = await signToken(`${username}:${Date.now()}`);
    return new Response(null, {
      status: 302,
      headers: {
        Location: "/admin",
        "Set-Cookie": `admin_session=${encodeURIComponent(token)}; Path=/admin; HttpOnly; SameSite=Strict; Max-Age=86400`,
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
    return html(adminPage(listFiles(), getStats()));
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
  });
