import {
  formatBytes,
  timeUntilExpiry,
  fileTypeLabel,
  esc,
} from "../lib/format";
import type { FileRow } from "../db";

export function dropZone(): string {
  return `
  <div id="drop-zone"
    class="drop-zone bg-surface rounded-2xl p-16 text-center cursor-pointer">
    <div class="mb-4 text-text-tertiary" id="drop-icon">
      <svg class="mx-auto" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
        <path d="M4 12L4 14.5442C4 17.7892 4 19.4117 4.88607 20.5107C5.06508 20.7327 5.26731 20.9349 5.48933 21.1139C6.58831 22 8.21082 22 11.4558 22C12.1614 22 12.5141 22 12.8372 21.886C12.9044 21.8623 12.9702 21.835 13.0345 21.8043C13.3436 21.6564 13.593 21.407 14.0919 20.9081L18.8284 16.1716C19.4065 15.5935 19.6955 15.3045 19.8478 14.9369C20 14.5694 20 14.1606 20 13.3431V10C20 6.22876 20 4.34315 18.8284 3.17157C17.6569 2 15.7712 2 12 2M13 21.5V21C13 18.1716 13 16.7574 13.8787 15.8787C14.7574 15 16.1716 15 19 15H19.5"/>
        <path d="M10 5C9.41016 4.39316 7.84027 2 7 2C6.15973 2 4.58984 4.39316 4 5M7 3L7 10"/>
      </svg>
    </div>
    <p class="text-text-secondary font-medium mb-1">Drop files here or click to browse</p>
    <p class="text-sm text-text-tertiary">Max 100MB per file</p>
    <input type="file" id="file-input" class="hidden" multiple>
  </div>`;
}

export function progressBar(): string {
  return `
  <div id="progress-container" class="reveal mt-6">
    <div>
      <div class="flex justify-between text-sm text-text-secondary mb-2">
        <span id="progress-filename" class="truncate"></span>
        <span class="tabular-nums">
          <span id="progress-speed" class="text-text-tertiary mr-2"></span>
          <span id="progress-percent">0%</span>
        </span>
      </div>
      <div class="w-full bg-surface-3 rounded-full h-1.5">
        <div id="progress-bar" class="bg-accent h-1.5 rounded-full transition-all duration-150" style="width: 0%"></div>
      </div>
    </div>
  </div>`;
}

export function copyButton(text: string, label = "Copy link"): string {
  return `
  <button data-copy="${esc(text)}" onclick="copyToClipboard(this, '${esc(label)}')"
    class="inline-flex items-center gap-1.5 px-4 py-2 bg-accent hover:bg-accent-hover text-white text-sm font-medium rounded-xl transition-colors">
    <span class="copy-label">${esc(label)}</span>
  </button>`;
}

export function expirySelect(allowNever = true): string {
  return `
  <select name="expiry" id="expiry-select"
    class="bg-surface border border-border rounded-xl pl-3 pr-8 py-2 text-sm text-text-primary focus:outline-none focus:ring-2 focus:ring-accent/30 focus:border-accent">
    <option value="1">1 hour</option>
    <option value="24">24 hours</option>
    <option value="168" selected>7 days</option>
    <option value="720">30 days</option>
    ${allowNever ? '<option value="">Never</option>' : ""}
  </select>`;
}

export function fileCard(file: FileRow, baseUrl: string): string {
  const link = `${baseUrl}/d/${file.id}`;
  const expiry = file.expires_at ? timeUntilExpiry(file.expires_at) : "Never";
  const locked = file.password_hash
    ? `<span class="text-amber-600 text-xs ml-2">locked</span>`
    : "";

  return `
  <div class="card-elevated card-hoverable rounded-2xl p-5 flex items-center justify-between gap-4">
    <div class="min-w-0 flex-1">
      <p class="text-text-primary font-medium truncate">${esc(file.filename)}${locked}</p>
      <p class="text-sm text-text-tertiary tabular-nums">${formatBytes(file.size)} &middot; expires ${expiry} &middot; ${file.downloads} downloads</p>
    </div>
    <div class="flex gap-2 shrink-0">
      ${copyButton(link)}
      <a href="${link}" class="btn px-4 py-2 bg-surface-2 hover:bg-surface-3 text-text-secondary text-sm font-medium rounded-xl">
        View
      </a>
    </div>
  </div>`;
}

export function folderFileCard(file: FileRow): string {
  const typeLabel = fileTypeLabel(file.type, file.filename);

  return `
  <div class="group">
    <div class="h-48 bg-surface-3 rounded-xl flex flex-col items-center justify-center gap-3">
      <svg class="text-text-secondary" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
        <path d="M8 7L16 7"/>
        <path d="M8 11L12 11"/>
        <path d="M13 21.5V21C13 18.1716 13 16.7574 13.8787 15.8787C14.7574 15 16.1716 15 19 15H19.5M20 13.3431V10C20 6.22876 20 4.34315 18.8284 3.17157C17.6569 2 15.7712 2 12 2C8.22877 2 6.34315 2 5.17157 3.17157C4 4.34314 4 6.22876 4 10L4 14.5442C4 17.7892 4 19.4117 4.88607 20.5107C5.06508 20.7327 5.26731 20.9349 5.48933 21.1139C6.58831 22 8.21082 22 11.4558 22C12.1614 22 12.5141 22 12.8372 21.886C12.9044 21.8623 12.9702 21.835 13.0345 21.8043C13.3436 21.6564 13.593 21.407 14.0919 20.9081L18.8284 16.1716C19.4065 15.5935 19.6955 15.3045 19.8478 14.9369C20 14.5694 20 14.1606 20 13.3431Z"/>
      </svg>
      <span class="block text-center font-medium text-[10px] text-text-tertiary select-none">${esc(typeLabel)}</span>
    </div>
    <div class="px-1 pt-3 flex items-center justify-between gap-3">
      <div class="min-w-0 flex-1">
        <p class="text-sm font-medium text-text-primary truncate">${esc(file.filename)}</p>
        <p class="text-xs text-text-tertiary tabular-nums mt-0.5">${formatBytes(file.size)}</p>
      </div>
      <a href="/d/${file.id}" class="download-circle shrink-0" aria-label="Download ${esc(file.filename)}">
        <svg width="28" height="28" viewBox="0 0 23 21" fill="currentColor" fill-rule="nonzero">
          <path d="M11.7089844,19.921875 C10.3352865,19.921875 9.04622396,19.6630859 7.84179688,19.1455078 C6.63736979,18.6279297 5.57942708,17.9117839 4.66796875,16.9970703 C3.75651042,16.0823568 3.04199219,15.0244141 2.52441406,13.8232422 C2.00683594,12.6220703 1.74804688,11.3346354 1.74804688,9.9609375 C1.74804688,8.58723958 2.00683594,7.29817708 2.52441406,6.09375 C3.04199219,4.88932292 3.75651042,3.83138021 4.66796875,2.91992188 C5.57942708,2.00846354 6.63736979,1.29394531 7.84179688,0.776367188 C9.04622396,0.258789062 10.3352865,0 11.7089844,0 C13.0826823,0 14.3717448,0.258789062 15.5761719,0.776367188 C16.780599,1.29394531 17.8385417,2.00846354 18.75,2.91992188 C19.6614583,3.83138021 20.3759766,4.88932292 20.8935547,6.09375 C21.4111328,7.29817708 21.6699219,8.58723958 21.6699219,9.9609375 C21.6699219,11.3346354 21.4111328,12.6220703 20.8935547,13.8232422 C20.3759766,15.0244141 19.6614583,16.0823568 18.75,16.9970703 C17.8385417,17.9117839 16.780599,18.6279297 15.5761719,19.1455078 C14.3717448,19.6630859 13.0826823,19.921875 11.7089844,19.921875 Z M11.71875,15.0390625 C11.8229167,15.0390625 11.9205729,15.0195312 12.0117188,14.9804688 C12.1028646,14.9414062 12.2005208,14.8730469 12.3046875,14.7753906 L15.625,11.5722656 C15.703125,11.4941406 15.7617188,11.4127604 15.8007812,11.328125 C15.8398438,11.2434896 15.859375,11.1458333 15.859375,11.0351562 C15.859375,10.8333333 15.789388,10.6656901 15.6494141,10.5322266 C15.5094401,10.398763 15.3352865,10.3320312 15.1269531,10.3320312 C14.8990885,10.3320312 14.7167969,10.4134115 14.5800781,10.5761719 L13.046875,12.1972656 L12.4707031,12.8222656 L12.5292969,11.3085938 L12.5292969,5.6640625 C12.5292969,5.44921875 12.4495443,5.26529948 12.2900391,5.11230469 C12.1305339,4.9593099 11.9401042,4.8828125 11.71875,4.8828125 C11.5039062,4.8828125 11.3167318,4.9593099 11.1572266,5.11230469 C10.9977214,5.26529948 10.9179688,5.44921875 10.9179688,5.6640625 L10.9179688,11.3085938 L10.9765625,12.8222656 L10.390625,12.1972656 L8.85742188,10.5761719 C8.72721354,10.4134115 8.54166667,10.3320312 8.30078125,10.3320312 C8.09244792,10.3320312 7.91992188,10.398763 7.78320312,10.5322266 C7.64648438,10.6656901 7.578125,10.8333333 7.578125,11.0351562 C7.578125,11.1458333 7.59928385,11.2434896 7.64160156,11.328125 C7.68391927,11.4127604 7.74414062,11.4941406 7.82226562,11.5722656 L11.1328125,14.7753906 C11.2369792,14.8730469 11.3346354,14.9414062 11.4257812,14.9804688 C11.5169271,15.0195312 11.6145833,15.0390625 11.71875,15.0390625 Z"/>
        </svg>
      </a>
    </div>
  </div>`;
}
