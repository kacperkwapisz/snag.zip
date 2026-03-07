import { layout } from "./layout";
import { formatBytes, formatDate, timeUntilExpiry, esc } from "../lib/format";
import type { FileRow, Stats } from "../db";

export function adminPage(files: FileRow[], stats: Stats): string {
  const rows = files
    .map(
      (f) => `
    <tr class="border-t border-border/50 hover:bg-surface-2 transition-colors">
      <td class="py-3.5 px-5">
        <a href="/d/${f.id}" class="text-text-primary font-medium hover:text-accent transition-colors">${esc(f.filename)}</a>
      </td>
      <td class="py-3.5 px-5 text-text-secondary tabular-nums">${formatBytes(f.size)}</td>
      <td class="py-3.5 px-5 text-text-secondary tabular-nums">${f.downloads}</td>
      <td class="py-3.5 px-5 text-text-secondary tabular-nums">${f.expires_at ? timeUntilExpiry(f.expires_at) : "Never"}</td>
      <td class="py-3.5 px-5 text-text-secondary tabular-nums">${formatDate(f.uploaded_at)}</td>
      <td class="py-3.5 px-5">
        <button data-id="${esc(f.id)}" onclick="deleteFile(this.dataset.id, this)"
          class="text-danger hover:opacity-70 text-sm font-medium transition-opacity">Delete</button>
      </td>
    </tr>`,
    )
    .join("");

  const emptyRow = `<tr><td colspan="6" class="py-16 text-center">
    <div class="text-text-tertiary/30 mb-3">
      <svg class="mx-auto" width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
        <path d="M8 7L16 7"/>
        <path d="M8 11L12 11"/>
        <path d="M13 21.5V21C13 18.1716 13 16.7574 13.8787 15.8787C14.7574 15 16.1716 15 19 15H19.5M20 13.3431V10C20 6.22876 20 4.34315 18.8284 3.17157C17.6569 2 15.7712 2 12 2C8.22877 2 6.34315 2 5.17157 3.17157C4 4.34314 4 6.22876 4 10L4 14.5442C4 17.7892 4 19.4117 4.88607 20.5107C5.06508 20.7327 5.26731 20.9349 5.48933 21.1139C6.58831 22 8.21082 22 11.4558 22C12.1614 22 12.5141 22 12.8372 21.886C12.9044 21.8623 12.9702 21.835 13.0345 21.8043C13.3436 21.6564 13.593 21.407 14.0919 20.9081L18.8284 16.1716C19.4065 15.5935 19.6955 15.3045 19.8478 14.9369C20 14.5694 20 14.1606 20 13.3431Z"/>
      </svg>
    </div>
    <p class="text-sm text-text-tertiary">No files uploaded yet</p>
  </td></tr>`;

  const body = `
    <h1 class="text-4xl font-semibold tracking-tight text-text-primary mb-10 animate-fade-in text-balance">Admin</h1>

    <div class="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-10 animate-fade-in-delay-1">
      <div class="card-elevated card-hoverable rounded-2xl p-6">
        <p class="text-sm font-medium text-text-tertiary mb-1">Files</p>
        <p class="text-3xl font-semibold text-text-primary tabular-nums">${stats.total_files}</p>
      </div>
      <div class="card-elevated card-hoverable rounded-2xl p-6">
        <p class="text-sm font-medium text-text-tertiary mb-1">Total Size</p>
        <p class="text-3xl font-semibold text-text-primary tabular-nums">${formatBytes(stats.total_size)}</p>
      </div>
      <div class="card-elevated card-hoverable rounded-2xl p-6">
        <p class="text-sm font-medium text-text-tertiary mb-1">Downloads</p>
        <p class="text-3xl font-semibold text-text-primary tabular-nums">${stats.total_downloads}</p>
      </div>
    </div>

    <div class="card-elevated rounded-2xl overflow-hidden animate-fade-in-delay-2">
      <table class="w-full text-sm">
        <thead>
          <tr class="text-left text-xs font-medium text-text-tertiary uppercase tracking-wider">
            <th class="py-3 px-5">File</th>
            <th class="py-3 px-5">Size</th>
            <th class="py-3 px-5">Downloads</th>
            <th class="py-3 px-5">Expires</th>
            <th class="py-3 px-5">Uploaded</th>
            <th class="py-3 px-5"></th>
          </tr>
        </thead>
        <tbody>
          ${rows || emptyRow}
        </tbody>
      </table>
    </div>
  `;

  const script = `
  <div id="delete-dialog" class="dialog-backdrop" style="display:none">
    <div class="dialog-panel text-center">
      <div class="mx-auto mb-3 text-danger">
        <svg class="mx-auto" width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
          <path d="M19.5 5.5L18.8803 15.5251C18.7219 18.0864 18.6428 19.3671 18.0008 20.2879C17.6833 20.7431 17.2747 21.1273 16.8007 21.416C15.8421 22 14.559 22 11.9927 22C9.42312 22 8.1383 22 7.17905 21.4149C6.7048 21.1257 6.296 20.7408 5.97868 20.2848C5.33688 19.3626 5.25945 18.0801 5.10461 15.5152L4.5 5.5"/>
          <path d="M3 5.5H21M16.0557 5.5L15.3731 4.09173C14.9196 3.15626 14.6928 2.68852 14.3017 2.39681C14.215 2.3321 14.1231 2.27454 14.027 2.2247C13.5939 2 13.0741 2 12.0345 2C10.9688 2 10.436 2 9.99568 2.23412C9.8981 2.28601 9.80498 2.3459 9.71729 2.41317C9.32164 2.7167 9.10063 3.20155 8.65861 4.17126L8.05292 5.5"/>
          <path d="M9.5 16.5V10.5"/>
          <path d="M14.5 16.5V10.5"/>
        </svg>
      </div>
      <h3 class="text-base font-semibold text-text-primary mb-1">Delete file?</h3>
      <p id="delete-dialog-name" class="text-sm text-text-secondary mb-5 break-all"></p>
      <div class="flex gap-3">
        <button id="delete-dialog-cancel"
          class="flex-1 px-4 py-2.5 bg-surface-2 hover:bg-surface-3 text-text-primary text-sm font-medium rounded-xl">
          Cancel
        </button>
        <button id="delete-dialog-confirm"
          class="flex-1 px-4 py-2.5 bg-danger hover:opacity-80 text-white text-sm font-medium rounded-xl">
          Delete
        </button>
      </div>
    </div>
  </div>
  <script>
    var deleteDialog = document.getElementById('delete-dialog');
    var deleteDialogName = document.getElementById('delete-dialog-name');
    var pendingDeleteId = null;
    var pendingDeleteBtn = null;

    function openDeleteDialog(id, btn) {
      pendingDeleteId = id;
      pendingDeleteBtn = btn;
      var filename = btn.closest('tr').querySelector('a').textContent;
      deleteDialogName.textContent = filename;
      deleteDialog.style.display = '';
      requestAnimationFrame(function() {
        deleteDialog.classList.add('visible');
      });
    }

    function closeDeleteDialog(cb) {
      deleteDialog.classList.remove('visible');
      deleteDialog.classList.add('closing');
      deleteDialog.addEventListener('transitionend', function handler() {
        deleteDialog.removeEventListener('transitionend', handler);
        deleteDialog.classList.remove('closing');
        deleteDialog.style.display = 'none';
        pendingDeleteId = null;
        pendingDeleteBtn = null;
        if (cb) cb();
      });
    }

    document.getElementById('delete-dialog-cancel').addEventListener('click', function() {
      closeDeleteDialog();
    });

    deleteDialog.addEventListener('click', function(e) {
      if (e.target === deleteDialog) closeDeleteDialog();
    });

    document.getElementById('delete-dialog-confirm').addEventListener('click', function() {
      var id = pendingDeleteId;
      var btn = pendingDeleteBtn;
      if (!id) return;
      var tr = btn.closest('tr');
      closeDeleteDialog(function() {
        fetch('/admin/files/' + id, { method: 'DELETE' }).then(function(res) {
          if (res.ok) {
            tr.classList.add('animate-fade-out');
            tr.addEventListener('animationend', function() { tr.remove(); });
          } else {
            showToast('Failed to delete file');
          }
        });
      });
    });

    function deleteFile(id, btn) {
      openDeleteDialog(id, btn);
    }
  </script>`;

  return layout("Admin", body, script, { wide: true });
}
