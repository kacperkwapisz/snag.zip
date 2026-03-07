export function layout(
  title: string,
  body: string,
  scripts = "",
  options?: { wide?: boolean },
): string {
  const maxW = options?.wide ? "max-w-5xl" : "max-w-3xl";

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${title} - snag.zip</title>
  <link rel="stylesheet" href="/public/styles.css">
  <link rel="icon" href="/public/favicon.ico">
</head>
<body class="bg-surface-2 text-text-primary font-sans antialiased min-h-screen flex flex-col">
  <nav class="nav-blur sticky top-0 z-50 border-b border-border/50">
    <div class="max-w-5xl mx-auto px-6 h-12 flex items-center">
      <a href="/" class="text-base font-semibold text-text-primary tracking-tight transition-opacity hover:opacity-60">
        snag.zip
      </a>
    </div>
  </nav>
  <main class="${maxW} mx-auto px-6 pt-12 pb-16 flex-1 w-full">
    ${body}
  </main>
  <footer class="border-t border-border/50">
    <div class="max-w-5xl mx-auto px-6 py-8 flex items-center justify-center gap-1.5 text-sm text-text-tertiary">
      snag.zip &middot; self-hosted file sharing &middot;
      <a href="https://github.com/kacperkwapisz/snag.zip" target="_blank" rel="noopener noreferrer" class="opacity-60 hover:opacity-100 transition-opacity" aria-label="GitHub">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0 0 24 12c0-6.63-5.37-12-12-12z"/></svg>
      </a>
    </div>
  </footer>
  <div id="toast-container" class="toast-container" aria-live="polite"></div>
  <script>
    function showToast(message, type, duration) {
      type = type || 'error';
      duration = duration || 4000;
      var container = document.getElementById('toast-container');
      var toast = document.createElement('div');
      toast.className = 'toast toast-' + type + ' animate-slide-down';
      toast.textContent = message;
      container.appendChild(toast);
      setTimeout(function() {
        toast.classList.remove('animate-slide-down');
        toast.classList.add('animate-slide-up-out');
        toast.addEventListener('animationend', function() { toast.remove(); });
      }, duration);
    }
    function copyToClipboard(btn, label) {
      var text = btn.dataset.copy || btn.closest('[data-copy]').dataset.copy;
      navigator.clipboard.writeText(text).then(function() {
        var span = btn.querySelector('.copy-label');
        if (span) {
          span.innerHTML = '<svg class="inline -mt-0.5" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" style="stroke-dasharray:21;stroke-dashoffset:21;animation:draw-check 0.3s ease-out forwards"><path d="M5 14L8.5 17.5L19 6.5"/></svg> Copied';
          setTimeout(function() { span.textContent = label; }, 2000);
        } else {
          btn.innerHTML = '<svg class="inline -mt-0.5" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" style="stroke-dasharray:21;stroke-dashoffset:21;animation:draw-check 0.3s ease-out forwards"><path d="M5 14L8.5 17.5L19 6.5"/></svg> Copied';
          setTimeout(function() { btn.textContent = label; }, 2000);
        }
      });
    }
  </script>
  ${scripts}
</body>
</html>`;
}
