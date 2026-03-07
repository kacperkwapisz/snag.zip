import { layout } from "./layout";
import { formatBytes, timeUntilExpiry, esc } from "../lib/format";
import { folderFileCard } from "./components";
import type { FileRow, FolderRow } from "../db";

export function folderPage(folder: FolderRow, files: FileRow[], baseUrl: string): string {
  const expiry = folder.expires_at ? timeUntilExpiry(folder.expires_at) : "Never";
  const totalSize = files.reduce((sum, f) => sum + f.size, 0);

  const grid = files.length
    ? `<div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5 mt-8">
        ${files
          .map((f, i) => {
            const delay = Math.min(i * 0.05, 0.4);
            return `<div class="animate-fade-in" style="animation-delay:${delay}s">${folderFileCard(f)}</div>`;
          })
          .join("")}
      </div>`
    : `<div class="text-center py-16 animate-fade-in-delay-1">
        <div class="mx-auto mb-4 text-text-tertiary/30">
          <svg class="mx-auto" width="48" height="48" viewBox="0 0 24 24" fill="none">
            <path d="M8 7H16.75C18.8567 7 19.91 7 20.6667 7.50559C20.9943 7.72447 21.2755 8.00572 21.4944 8.33329C22 9.08996 22 10.1433 22 12.25V13.75C22 16.7875 22 18.3063 21.1213 19.3971C20.233 20.5 18.7066 20.5 16.75 20.5H13.25C9.22876 20.5 7.21814 20.5 5.96085 19.3891C5.62005 19.0853 5.33517 18.7266 5.11834 18.3296C4.42738 17.0638 4.72752 15.5767 5.3278 12.6025C5.69379 10.7892 5.87678 9.88254 6.44692 9.26462C6.58637 9.11381 6.74171 8.97831 6.9103 8.86043C7.58166 8.39052 8.49631 8.30498 10.056 8.2262" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
            <path d="M8 7L7.31735 5.63471C6.84018 4.68014 6.6016 4.20286 6.1806 3.8964C6.08579 3.82677 5.98564 3.76474 5.88109 3.71064C5.41654 3.47145 4.87837 3.47145 3.80203 3.47145C2.94692 3.47145 2.51936 3.47145 2.2019 3.63833C2.1028 3.69002 2.01 3.75168 1.92464 3.8221C1.65073 4.04837 1.49776 4.38663 1.19182 5.06314L1 5.48836" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
          </svg>
        </div>
        <p class="text-text-secondary mb-4">No files in this folder yet.</p>
        <a href="/" class="text-accent hover:text-accent-hover font-medium transition-colors">Upload a file</a>
      </div>`;

  const body = `
    <div class="animate-fade-in">
      <div class="flex flex-wrap items-start justify-between gap-4 mb-2">
        <div>
          <h1 class="text-4xl font-semibold tracking-tight text-text-primary text-balance">${esc(folder.title ?? folder.slug)}</h1>
          ${folder.description ? `<p class="text-lg text-text-secondary text-pretty mt-2">${esc(folder.description)}</p>` : ""}
          <p class="text-sm text-text-tertiary mt-3 tabular-nums">${files.length} files &middot; ${formatBytes(totalSize)} &middot; expires ${expiry}</p>
        </div>
        ${
          files.length > 0
            ? `<a href="/f/${folder.slug}/zip"
                class="btn px-5 py-2.5 bg-accent hover:bg-accent-hover text-white font-medium rounded-xl shrink-0">
                Download All
              </a>`
            : ""
        }
      </div>
    </div>

    ${grid}
  `;

  return layout(esc(folder.title ?? folder.slug), body, "", { wide: true });
}
