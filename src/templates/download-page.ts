import { layout } from "./layout";
import {
  formatBytes,
  fileTypeLabel,
  timeAgo,
  timeUntilExpiry,
  esc,
} from "../lib/format";
import type { FileRow } from "../db";

function fileIcon(variant?: "unlocked"): string {
  const extra = variant === "unlocked" ? " animate-unlock" : "";
  return `
    <div class="w-16 h-16 rounded-2xl bg-surface-3 ring-subtle flex items-center justify-center mx-auto mb-5${extra}">
      <svg class="text-text-primary" width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
        <path d="M8 7L16 7"/>
        <path d="M8 11L12 11"/>
        <path d="M13 21.5V21C13 18.1716 13 16.7574 13.8787 15.8787C14.7574 15 16.1716 15 19 15H19.5M20 13.3431V10C20 6.22876 20 4.34315 18.8284 3.17157C17.6569 2 15.7712 2 12 2C8.22877 2 6.34315 2 5.17157 3.17157C4 4.34314 4 6.22876 4 10L4 14.5442C4 17.7892 4 19.4117 4.88607 20.5107C5.06508 20.7327 5.26731 20.9349 5.48933 21.1139C6.58831 22 8.21082 22 11.4558 22C12.1614 22 12.5141 22 12.8372 21.886C12.9044 21.8623 12.9702 21.835 13.0345 21.8043C13.3436 21.6564 13.593 21.407 14.0919 20.9081L18.8284 16.1716C19.4065 15.5935 19.6955 15.3045 19.8478 14.9369C20 14.5694 20 14.1606 20 13.3431Z"/>
      </svg>
    </div>`;
}

function fileMeta(file: FileRow): string {
  const typeLabel = fileTypeLabel(file.type, file.filename);
  const uploaded = timeAgo(file.uploaded_at);
  const expiry = file.expires_at ? timeUntilExpiry(file.expires_at) : null;

  return `
    <p class="text-sm text-text-tertiary tabular-nums mt-2">
      ${esc(typeLabel)} &middot; ${formatBytes(file.size)}
    </p>
    <p class="text-xs text-text-tertiary/80 tabular-nums mt-1">
      Shared ${esc(uploaded)}${expiry ? ` &middot; Expires in ${esc(expiry)}` : ""}
    </p>`;
}

export function downloadPage(
  file: FileRow,
  baseUrl: string,
  error?: string,
  token?: string | null,
): string {
  const isProtected = !!file.password_hash;

  const body = `
    <div class="flex items-center justify-center min-h-[60vh]">
      <div class="card-elevated rounded-2xl p-8 max-w-lg w-full text-center ${error ? "animate-fade-in-shake" : "animate-fade-in"}">
        ${fileIcon()}
        <h1 class="text-xl font-semibold text-text-primary mb-1 break-all text-balance">${esc(file.filename)}</h1>
        ${fileMeta(file)}
        <div class="mt-6">
          ${error ? `<p class="text-danger text-sm mb-4">${esc(error)}</p>` : ""}
          ${isProtected ? passwordForm(file.id) : downloadButton(file.id, token ?? undefined)}
        </div>
      </div>
    </div>
  `;

  return layout(esc(file.filename), body);
}

function downloadButton(id: string, token?: string): string {
  if (!token) return "";
  return `
    <form method="POST" action="/d/${id}/download">
      <input type="hidden" name="token" value="${esc(token)}">
      <button type="submit"
        class="w-full px-6 py-3 bg-accent hover:bg-accent-hover text-white font-medium rounded-xl cursor-pointer">
        Download
      </button>
    </form>`;
}

function passwordForm(id: string): string {
  return `
    <form method="POST" action="/d/${id}" class="space-y-4 text-left">
      <div>
        <label class="flex items-center gap-1.5 text-sm font-medium text-text-secondary mb-1.5">
          <svg class="text-text-tertiary" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round">
            <path d="M12 16.5V14.5"/>
            <path d="M4.2678 18.8447C4.49268 20.515 5.87612 21.8235 7.55965 21.9009C8.97627 21.966 10.4153 22 12 22C13.5847 22 15.0237 21.966 16.4403 21.9009C18.1239 21.8235 19.5073 20.515 19.7322 18.8447C19.8789 17.7547 20 16.6376 20 15.5C20 14.3624 19.8789 13.2453 19.7322 12.1553C19.5073 10.485 18.1239 9.17649 16.4403 9.09909C15.0237 9.03397 13.5847 9 12 9C10.4153 9 8.97627 9.03397 7.55965 9.09909C5.87612 9.17649 4.49268 10.485 4.2678 12.1553C4.12104 13.2453 3.99999 14.3624 3.99999 15.5C3.99999 16.6376 4.12104 17.7547 4.2678 18.8447Z"/>
            <path d="M7.5 9V6.5C7.5 4.01472 9.51472 2 12 2C14.4853 2 16.5 4.01472 16.5 6.5V9" stroke-linejoin="round"/>
          </svg>
          This file is password protected
        </label>
        <input type="password" name="password" required placeholder="Enter password"
          class="w-full bg-surface-3 ring-subtle rounded-xl px-4 py-2.5 text-text-primary focus:outline-none focus:ring-2 focus:ring-accent/30">
      </div>
      <button type="submit"
        class="w-full px-6 py-3 bg-accent hover:bg-accent-hover text-white font-medium rounded-xl">
        Unlock & Download
      </button>
    </form>`;
}

export function downloadUnlockedPage(
  file: FileRow,
  baseUrl: string,
  token: string,
): string {
  const body = `
    <div class="flex items-center justify-center min-h-[60vh]">
      <div class="card-elevated rounded-2xl p-8 max-w-lg w-full text-center animate-fade-in">
        ${fileIcon("unlocked")}
        <h1 class="text-xl font-semibold text-text-primary mb-1 break-all text-balance">${esc(file.filename)}</h1>
        ${fileMeta(file)}
        <p class="text-sm text-success font-medium inline-flex items-center gap-1 mt-3 mb-6 animate-verified-in">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M5 14L8.5 17.5L19 6.5"/></svg>
          Password verified
        </p>
        ${downloadButton(file.id, token)}
      </div>
    </div>
  `;

  return layout(esc(file.filename), body);
}

export function expiredPage(): string {
  const body = `
    <div class="flex items-center justify-center min-h-[60vh]">
      <div class="text-center animate-fade-in">
        <div class="mx-auto mb-6 text-text-tertiary/30">
          <svg class="mx-auto" width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
            <circle cx="12" cy="12" r="10"/>
            <path d="M12 8V12L14 14" stroke-linecap="round" stroke-linejoin="round"/>
          </svg>
        </div>
        <h1 class="text-5xl font-semibold text-text-primary mb-6 text-balance">Gone</h1>
        <p class="text-lg text-text-secondary text-pretty mb-8">This file has expired or doesn't exist.</p>
        <a href="/" class="btn inline-block px-6 py-2.5 bg-accent hover:bg-accent-hover text-white font-medium rounded-xl">Upload a new file</a>
      </div>
    </div>
  `;

  return layout("Expired", body);
}
