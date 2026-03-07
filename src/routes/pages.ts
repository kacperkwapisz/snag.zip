import { Elysia } from "elysia";
import { uploadPage } from "../templates/upload-page";
import { html } from "../lib/http";

export const pageRoutes = new Elysia()
  .get("/", () => html(uploadPage()));
