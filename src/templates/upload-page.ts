import { layout } from "./layout";
import { dropZone, progressBar, expirySelect } from "./components";

export function uploadPage(): string {
  const body = `
    <div class="animate-fade-in">
      <h1 class="text-4xl font-semibold tracking-tight text-text-primary text-balance mb-2">Upload & share</h1>
      <p class="text-lg text-text-secondary text-pretty mb-8">Upload a file, get a short link. Simple as that.</p>
    </div>

    <div class="animate-fade-in-delay-1">
      ${dropZone()}

      <div class="mt-6 flex flex-wrap items-end gap-4">
        <div>
          <label class="block text-sm font-medium text-text-secondary mb-1.5">Expires in</label>
          ${expirySelect()}
        </div>
        <div>
          <label class="block text-sm font-medium text-text-secondary mb-1.5">Password (optional)</label>
          <input type="password" id="password-input" placeholder="Leave empty for no password"
            class="bg-surface border border-border rounded-xl px-3 py-2 text-sm text-text-primary focus:outline-none focus:ring-2 focus:ring-accent/30 focus:border-accent w-56">
        </div>
      </div>

      ${progressBar()}
    </div>

    <div id="result" class="reveal mt-8">
      <div class="card-elevated rounded-2xl p-6">
        <p class="text-sm text-text-secondary mb-3">Your file is ready:</p>
        <div class="flex items-center gap-3">
          <input type="text" id="result-link" readonly
            class="flex-1 bg-surface-2 border-0 rounded-xl px-3 py-2 text-text-primary font-mono text-sm focus:outline-none">
          <button id="copy-btn"
            class="inline-flex items-center gap-1.5 px-4 py-2 bg-accent hover:bg-accent-hover text-white text-sm font-medium rounded-xl transition-colors">
            Copy
          </button>
        </div>
      </div>
    </div>

    <div id="multi-choice" class="reveal mt-8">
      <div class="card-elevated rounded-2xl p-6">
        <p id="multi-summary" class="text-sm text-text-secondary mb-4"></p>
        <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <button id="btn-separate" class="card-elevated rounded-xl p-5 text-left hover:border-accent transition-colors cursor-pointer">
            <p class="font-medium text-text-primary mb-1">Separate links</p>
            <p class="text-sm text-text-secondary">Each file gets its own shareable link</p>
          </button>
          <button id="btn-folder" class="card-elevated rounded-xl p-5 text-left hover:border-accent transition-colors cursor-pointer">
            <p class="font-medium text-text-primary mb-1">As a folder</p>
            <p class="text-sm text-text-secondary">One link for all files</p>
            <p id="folder-pw-note" class="text-xs text-text-tertiary mt-1 hidden">Password not applied in folder mode</p>
          </button>
        </div>
        <div id="folder-details" class="hidden mt-4 space-y-3">
          <input type="text" id="folder-title" placeholder="Folder title (optional)"
            class="w-full bg-surface-3 ring-subtle rounded-xl px-4 py-2.5 text-text-primary text-sm focus:outline-none focus:ring-2 focus:ring-accent/30">
          <input type="text" id="folder-description" placeholder="Description (optional)"
            class="w-full bg-surface-3 ring-subtle rounded-xl px-4 py-2.5 text-text-primary text-sm focus:outline-none focus:ring-2 focus:ring-accent/30">
          <div class="flex gap-3">
            <button id="btn-folder-confirm"
              class="flex-1 px-5 py-2.5 bg-accent hover:bg-accent-hover text-white font-medium rounded-xl cursor-pointer">
              Upload as folder
            </button>
            <button id="btn-folder-back"
              class="px-4 py-2.5 bg-surface-2 hover:bg-surface-3 text-text-secondary text-sm font-medium rounded-xl cursor-pointer">
              Back
            </button>
          </div>
        </div>
        <button id="btn-cancel-multi" class="mt-4 text-sm text-text-tertiary hover:text-text-secondary transition-colors">Cancel</button>
      </div>
    </div>

    <div id="multi-progress" class="reveal mt-8">
      <div class="card-elevated rounded-2xl p-6">
        <div id="multi-progress-rows" class="space-y-3"></div>
      </div>
    </div>

    <div id="multi-result" class="reveal mt-8">
      <div id="multi-result-content"></div>
    </div>
  `;

  const script = `
  <script>
    var dropZone = document.getElementById('drop-zone');
    var fileInput = document.getElementById('file-input');
    var progressContainer = document.getElementById('progress-container');
    var progressBarEl = document.getElementById('progress-bar');
    var progressPercent = document.getElementById('progress-percent');
    var progressFilename = document.getElementById('progress-filename');
    var progressSpeed = document.getElementById('progress-speed');
    var result = document.getElementById('result');
    var resultLink = document.getElementById('result-link');
    var copyBtn = document.getElementById('copy-btn');
    var dropIcon = document.getElementById('drop-icon');
    var dropText = dropZone.querySelector('p');
    var dropTextOriginal = dropText.textContent;

    var multiChoice = document.getElementById('multi-choice');
    var multiSummary = document.getElementById('multi-summary');
    var multiProgress = document.getElementById('multi-progress');
    var multiProgressRows = document.getElementById('multi-progress-rows');
    var multiResult = document.getElementById('multi-result');
    var multiResultContent = document.getElementById('multi-result-content');
    var folderPwNote = document.getElementById('folder-pw-note');
    var folderDetails = document.getElementById('folder-details');
    var folderTitleInput = document.getElementById('folder-title');
    var folderDescInput = document.getElementById('folder-description');
    var multiChoiceGrid = multiChoice.querySelector('.grid');

    var pendingFiles = null;

    dropZone.addEventListener('click', function() { fileInput.click(); });
    dropZone.addEventListener('dragover', function(e) {
      e.preventDefault();
      dropZone.classList.add('dragging');
      dropIcon.classList.add('drop-zone-icon-pulse');
    });
    dropZone.addEventListener('dragleave', function() {
      dropZone.classList.remove('dragging');
      dropIcon.classList.remove('drop-zone-icon-pulse');
    });
    dropZone.addEventListener('drop', function(e) {
      e.preventDefault();
      dropZone.classList.remove('dragging');
      dropIcon.classList.remove('drop-zone-icon-pulse');
      var files = e.dataTransfer.files;
      if (files.length === 1) uploadFile(files[0]);
      else if (files.length > 1) showMultiChoice(files);
    });
    fileInput.addEventListener('change', function() {
      if (fileInput.files.length === 1) {
        uploadFile(fileInput.files[0]);
      } else if (fileInput.files.length > 1) {
        showMultiChoice(fileInput.files);
      }
      fileInput.value = '';
    });

    var uploading = false;

    function formatSpeed(bps) {
      if (bps > 1048576) return (bps / 1048576).toFixed(1) + ' MB/s';
      if (bps > 1024) return (bps / 1024).toFixed(0) + ' KB/s';
      return bps.toFixed(0) + ' B/s';
    }

    function formatBytesClient(bytes) {
      if (bytes >= 1073741824) return (bytes / 1073741824).toFixed(1) + ' GB';
      if (bytes >= 1048576) return (bytes / 1048576).toFixed(1) + ' MB';
      if (bytes >= 1024) return (bytes / 1024).toFixed(0) + ' KB';
      return bytes + ' B';
    }

    function escHtml(s) {
      var d = document.createElement('div');
      d.textContent = s;
      return d.innerHTML;
    }

    function uploadFile(file) {
      if (uploading) return;
      uploading = true;

      var formData = new FormData();
      formData.append('file', file);

      var expiry = document.getElementById('expiry-select').value;
      if (expiry) formData.append('expiry', expiry);

      var password = document.getElementById('password-input').value;
      if (password) formData.append('password', password);

      var xhr = new XMLHttpRequest();
      xhr.open('POST', '/upload');

      progressContainer.classList.add('visible');
      result.classList.remove('visible');
      progressFilename.textContent = file.name;
      progressBarEl.style.width = '0%';
      progressBarEl.classList.add('progress-shimmer');
      progressBarEl.classList.remove('bg-success', 'bg-accent');
      progressPercent.textContent = '0%';
      progressSpeed.textContent = '';
      dropIcon.style.opacity = '0.3';
      dropText.textContent = file.name;

      var lastLoaded = 0, lastTime = Date.now();

      xhr.upload.addEventListener('progress', function(e) {
        if (e.lengthComputable) {
          var pct = Math.round((e.loaded / e.total) * 100);
          progressBarEl.style.width = pct + '%';
          progressPercent.textContent = pct + '%';
          var now = Date.now();
          var elapsed = (now - lastTime) / 1000;
          if (elapsed >= 0.5) {
            var bytesPerSec = (e.loaded - lastLoaded) / elapsed;
            progressSpeed.textContent = formatSpeed(bytesPerSec);
            lastLoaded = e.loaded;
            lastTime = now;
          }
        }
      });

      xhr.addEventListener('load', function() {
        if (xhr.status === 200) {
          var data = JSON.parse(xhr.responseText);
          resultLink.value = data.url;
          progressBarEl.style.width = '100%';
          progressBarEl.classList.remove('progress-shimmer');
          progressBarEl.classList.add('bg-success');
          progressSpeed.textContent = '';
          setTimeout(function() {
            progressContainer.classList.remove('visible');
            progressBarEl.classList.remove('bg-success');
            progressBarEl.classList.add('bg-accent');
            result.classList.add('visible');
            var card = result.querySelector('.card-elevated');
            card.classList.remove('animate-scale-fade-in');
            void card.offsetWidth;
            card.classList.add('animate-scale-fade-in');
            dropIcon.style.opacity = '1';
            dropText.textContent = dropTextOriginal;
          }, 600);
          showToast('File uploaded!', 'success', 3000);
          uploading = false;
        } else {
          showToast('Upload failed: ' + xhr.responseText);
          progressContainer.classList.remove('visible');
          dropIcon.style.opacity = '1';
          dropText.textContent = dropTextOriginal;
          uploading = false;
        }
      });

      xhr.addEventListener('error', function() {
        showToast('Upload failed. Check your connection.');
        progressContainer.classList.remove('visible');
        dropIcon.style.opacity = '1';
        dropText.textContent = dropTextOriginal;
        uploading = false;
      });

      xhr.send(formData);
    }

    copyBtn.addEventListener('click', function() {
      navigator.clipboard.writeText(resultLink.value).then(function() {
        copyBtn.innerHTML = '<svg class="inline -mt-0.5" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" style="stroke-dasharray:21;stroke-dashoffset:21;animation:draw-check 0.3s ease-out forwards"><path d="M5 14L8.5 17.5L19 6.5"/></svg> Copied';
        setTimeout(function() { copyBtn.textContent = 'Copy'; }, 2000);
      });
    });

    // --- Multi-file flow ---

    function showMultiChoice(files) {
      if (uploading) return;
      pendingFiles = files;
      var totalSize = 0;
      for (var i = 0; i < files.length; i++) totalSize += files[i].size;
      multiSummary.textContent = files.length + ' files selected (' + formatBytesClient(totalSize) + ')';

      // Show password note on folder card if password is set
      var pw = document.getElementById('password-input').value;
      folderPwNote.classList.toggle('hidden', !pw);

      result.classList.remove('visible');
      multiResult.classList.remove('visible');
      multiProgress.classList.remove('visible');
      multiChoice.classList.add('visible');
      dropIcon.style.opacity = '0.3';
      dropText.textContent = files.length + ' files selected';
    }

    function cancelMultiChoice() {
      multiChoice.classList.remove('visible');
      folderDetails.classList.add('hidden');
      folderTitleInput.value = '';
      folderDescInput.value = '';
      multiChoiceGrid.classList.remove('hidden');
      pendingFiles = null;
      dropIcon.style.opacity = '1';
      dropText.textContent = dropTextOriginal;
    }

    document.getElementById('btn-cancel-multi').addEventListener('click', cancelMultiChoice);
    document.getElementById('btn-separate').addEventListener('click', function() {
      if (!pendingFiles) return;
      var files = pendingFiles;
      pendingFiles = null;
      multiChoice.classList.remove('visible');
      uploadSeparate(files);
    });
    document.getElementById('btn-folder').addEventListener('click', function() {
      if (!pendingFiles) return;
      multiChoiceGrid.classList.add('hidden');
      folderDetails.classList.remove('hidden');
      folderTitleInput.focus();
    });
    document.getElementById('btn-folder-back').addEventListener('click', function() {
      folderDetails.classList.add('hidden');
      folderTitleInput.value = '';
      folderDescInput.value = '';
      multiChoiceGrid.classList.remove('hidden');
    });
    document.getElementById('btn-folder-confirm').addEventListener('click', function() {
      if (!pendingFiles) return;
      var files = pendingFiles;
      pendingFiles = null;
      multiChoice.classList.remove('visible');
      folderDetails.classList.add('hidden');
      multiChoiceGrid.classList.remove('hidden');
      uploadAsFolder(files);
    });

    function uploadOneFile(file, folderId) {
      return new Promise(function(resolve, reject) {
        var formData = new FormData();
        formData.append('file', file);

        var expiry = document.getElementById('expiry-select').value;
        if (expiry) formData.append('expiry', expiry);

        if (!folderId) {
          var password = document.getElementById('password-input').value;
          if (password) formData.append('password', password);
        }

        if (folderId) formData.append('folder_id', folderId);

        var xhr = new XMLHttpRequest();
        xhr.open('POST', '/upload');

        xhr.upload.addEventListener('progress', function(e) {
          if (e.lengthComputable) {
            var pct = Math.round((e.loaded / e.total) * 100);
            file._progress = pct;
            if (file._onProgress) file._onProgress(pct);
          }
        });

        xhr.addEventListener('load', function() {
          if (xhr.status === 200) {
            resolve(JSON.parse(xhr.responseText));
          } else {
            reject(new Error(xhr.responseText || 'Upload failed'));
          }
        });

        xhr.addEventListener('error', function() {
          reject(new Error('Network error'));
        });

        xhr.send(formData);
      });
    }

    function createProgressRow(filename, index) {
      var row = document.createElement('div');
      row.id = 'mpr-' + index;
      row.innerHTML =
        '<div class="flex items-center gap-3">' +
          '<div id="mpr-status-' + index + '" class="shrink-0 w-5 h-5 flex items-center justify-center">' +
            '<div class="w-2 h-2 rounded-full bg-text-tertiary"></div>' +
          '</div>' +
          '<div class="min-w-0 flex-1">' +
            '<div class="flex justify-between text-sm mb-1">' +
              '<span class="truncate text-text-primary">' + escHtml(filename) + '</span>' +
              '<span id="mpr-pct-' + index + '" class="tabular-nums text-text-tertiary shrink-0 ml-2"></span>' +
            '</div>' +
            '<div class="w-full bg-surface-3 rounded-full h-1">' +
              '<div id="mpr-bar-' + index + '" class="bg-accent h-1 rounded-full transition-all duration-150" style="width:0%"></div>' +
            '</div>' +
          '</div>' +
        '</div>';
      return row;
    }

    function updateProgressRow(index, pct) {
      var bar = document.getElementById('mpr-bar-' + index);
      var pctEl = document.getElementById('mpr-pct-' + index);
      if (bar) bar.style.width = pct + '%';
      if (pctEl) pctEl.textContent = pct + '%';
    }

    function markRowDone(index, success) {
      var bar = document.getElementById('mpr-bar-' + index);
      var status = document.getElementById('mpr-status-' + index);
      var pctEl = document.getElementById('mpr-pct-' + index);
      if (bar) {
        bar.style.width = '100%';
        bar.classList.remove('bg-accent');
        bar.classList.add(success ? 'bg-success' : 'bg-danger');
      }
      if (pctEl) pctEl.textContent = success ? '100%' : 'Failed';
      if (status) {
        status.innerHTML = success
          ? '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--success)" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M5 14L8.5 17.5L19 6.5"/></svg>'
          : '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--danger)" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>';
      }
    }

    function markRowActive(index) {
      var bar = document.getElementById('mpr-bar-' + index);
      if (bar) bar.classList.add('progress-shimmer');
    }

    function copyResultLink(btn) {
      var link = btn.getAttribute('data-link');
      navigator.clipboard.writeText(link).then(function() {
        var orig = btn.textContent;
        btn.innerHTML = '<svg class="inline -mt-0.5" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" style="stroke-dasharray:21;stroke-dashoffset:21;animation:draw-check 0.3s ease-out forwards"><path d="M5 14L8.5 17.5L19 6.5"/></svg> Copied';
        setTimeout(function() { btn.textContent = orig; }, 2000);
      });
    }

    async function uploadSeparate(files) {
      uploading = true;
      multiProgressRows.innerHTML = '';
      for (var i = 0; i < files.length; i++) {
        multiProgressRows.appendChild(createProgressRow(files[i].name, i));
      }
      multiProgress.classList.add('visible');

      var results = [];
      var succeeded = 0;

      for (var i = 0; i < files.length; i++) {
        markRowActive(i);
        files[i]._onProgress = (function(idx) {
          return function(pct) { updateProgressRow(idx, pct); };
        })(i);

        try {
          var data = await uploadOneFile(files[i], null);
          markRowDone(i, true);
          results.push({ filename: files[i].name, url: data.url });
          succeeded++;
        } catch (err) {
          markRowDone(i, false);
          results.push(null);
        }
      }

      setTimeout(function() {
        multiProgress.classList.remove('visible');

        var html = '';
        for (var j = 0; j < results.length; j++) {
          if (!results[j]) continue;
          html +=
            '<div class="card-elevated rounded-2xl p-5 mb-3 animate-scale-fade-in">' +
              '<div class="flex items-center gap-3">' +
                '<div class="min-w-0 flex-1">' +
                  '<p class="text-sm text-text-primary font-medium truncate">' + escHtml(results[j].filename) + '</p>' +
                  '<p class="text-xs text-text-tertiary font-mono mt-0.5 truncate">' + escHtml(results[j].url) + '</p>' +
                '</div>' +
                '<button data-link="' + escHtml(results[j].url) + '" onclick="copyResultLink(this)" ' +
                  'class="inline-flex items-center gap-1.5 px-4 py-2 bg-accent hover:bg-accent-hover text-white text-sm font-medium rounded-xl transition-colors shrink-0">' +
                  'Copy' +
                '</button>' +
              '</div>' +
            '</div>';
        }
        multiResultContent.innerHTML = html;
        multiResult.classList.add('visible');

        dropIcon.style.opacity = '1';
        dropText.textContent = dropTextOriginal;

        if (succeeded === files.length) {
          showToast(succeeded + ' files uploaded!', 'success', 3000);
        } else if (succeeded > 0) {
          showToast(succeeded + ' of ' + files.length + ' files uploaded', 'success', 4000);
        } else {
          showToast('All uploads failed', 'error', 4000);
        }
        uploading = false;
      }, 600);
    }

    async function uploadAsFolder(files) {
      uploading = true;
      multiProgressRows.innerHTML = '';
      for (var i = 0; i < files.length; i++) {
        multiProgressRows.appendChild(createProgressRow(files[i].name, i));
      }
      multiProgress.classList.add('visible');

      // Create folder first
      var expiry = document.getElementById('expiry-select').value;
      var customTitle = folderTitleInput.value.trim();
      var customDesc = folderDescInput.value.trim();
      folderTitleInput.value = '';
      folderDescInput.value = '';
      var folderBody = { title: customTitle || (files.length + ' files') };
      if (customDesc) folderBody.description = customDesc;
      if (expiry) folderBody.expiry = expiry;

      var folderData;
      try {
        var resp = await fetch('/folder', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(folderBody)
        });
        if (!resp.ok) throw new Error('Failed to create folder');
        folderData = await resp.json();
      } catch (err) {
        showToast('Failed to create folder', 'error', 4000);
        multiProgress.classList.remove('visible');
        dropIcon.style.opacity = '1';
        dropText.textContent = dropTextOriginal;
        uploading = false;
        return;
      }

      var succeeded = 0;

      for (var i = 0; i < files.length; i++) {
        markRowActive(i);
        files[i]._onProgress = (function(idx) {
          return function(pct) { updateProgressRow(idx, pct); };
        })(i);

        try {
          await uploadOneFile(files[i], folderData.id);
          markRowDone(i, true);
          succeeded++;
        } catch (err) {
          markRowDone(i, false);
        }
      }

      setTimeout(function() {
        multiProgress.classList.remove('visible');

        var html =
          '<div class="card-elevated rounded-2xl p-6 animate-scale-fade-in">' +
            '<p class="text-sm text-text-secondary mb-3">Your folder is ready:</p>' +
            '<div class="flex items-center gap-3">' +
              '<input type="text" readonly value="' + escHtml(folderData.url) + '" ' +
                'class="flex-1 bg-surface-2 border-0 rounded-xl px-3 py-2 text-text-primary font-mono text-sm focus:outline-none">' +
              '<button data-link="' + escHtml(folderData.url) + '" onclick="copyResultLink(this)" ' +
                'class="inline-flex items-center gap-1.5 px-4 py-2 bg-accent hover:bg-accent-hover text-white text-sm font-medium rounded-xl transition-colors shrink-0">' +
                'Copy' +
              '</button>' +
              '<a href="' + escHtml(folderData.url) + '" ' +
                'class="btn px-4 py-2 bg-surface-2 hover:bg-surface-3 text-text-secondary text-sm font-medium rounded-xl shrink-0">' +
                'View folder' +
              '</a>' +
            '</div>' +
          '</div>';

        multiResultContent.innerHTML = html;
        multiResult.classList.add('visible');

        dropIcon.style.opacity = '1';
        dropText.textContent = dropTextOriginal;

        if (succeeded === files.length) {
          showToast('Folder created with ' + succeeded + ' files!', 'success', 3000);
        } else if (succeeded > 0) {
          showToast('Folder created, ' + succeeded + ' of ' + files.length + ' files uploaded', 'success', 4000);
        } else {
          showToast('All uploads failed', 'error', 4000);
        }
        uploading = false;
      }, 600);
    }
  </script>`;

  return layout("Upload", body, script);
}
