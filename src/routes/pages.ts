import { Elysia } from "elysia";
import { uploadPage } from "../templates/upload-page";
import { html } from "../lib/http";
import { config } from "../config";
import { isAuthenticated } from "./admin";

export const pageRoutes = new Elysia()
  .get("/", async ({ request }) => {
    const locked = !config.publicUploads && !(await isAuthenticated(request.headers));
    return html(uploadPage({ locked }));
  });
