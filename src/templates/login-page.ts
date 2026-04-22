import { layout } from "./layout";
import { esc } from "../lib/format";

export function loginPage(error?: string, redirect?: string): string {
  const body = `
    <div class="flex items-center justify-center min-h-[60vh]">
      <div class="card-elevated rounded-2xl p-8 max-w-sm w-full ${error ? "animate-fade-in-shake" : "animate-fade-in"}">
        <div class="text-center mb-8">
          <div class="mx-auto mb-4 text-text-tertiary/30">
            <svg class="mx-auto" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round">
              <path d="M12 16.5V14.5"/>
              <path d="M4.2678 18.8447C4.49268 20.515 5.87612 21.8235 7.55965 21.9009C8.97627 21.966 10.4153 22 12 22C13.5847 22 15.0237 21.966 16.4403 21.9009C18.1239 21.8235 19.5073 20.515 19.7322 18.8447C19.8789 17.7547 20 16.6376 20 15.5C20 14.3624 19.8789 13.2453 19.7322 12.1553C19.5073 10.485 18.1239 9.17649 16.4403 9.09909C15.0237 9.03397 13.5847 9 12 9C10.4153 9 8.97627 9.03397 7.55965 9.09909C5.87612 9.17649 4.49268 10.485 4.2678 12.1553C4.12104 13.2453 3.99999 14.3624 3.99999 15.5C3.99999 16.6376 4.12104 17.7547 4.2678 18.8447Z"/>
              <path d="M7.5 9V6.5C7.5 4.01472 9.51472 2 12 2C14.4853 2 16.5 4.01472 16.5 6.5V9" stroke-linejoin="round"/>
            </svg>
          </div>
          <h1 class="text-xl font-semibold text-text-primary">Admin</h1>
          <p class="text-sm text-text-tertiary mt-1">Sign in to manage files</p>
        </div>
        ${error ? `<p class="text-danger text-sm text-center mb-4">${esc(error)}</p>` : ""}
        <form method="POST" action="/admin/login" class="space-y-4">
          ${redirect ? `<input type="hidden" name="redirect" value="${esc(redirect)}">` : ""}
          <div>
            <label class="block text-sm font-medium text-text-secondary mb-1.5">Username</label>
            <input type="text" name="username" required autocomplete="username" autofocus
              class="w-full bg-surface border border-border rounded-xl px-4 py-2.5 text-text-primary focus:outline-none focus:ring-2 focus:ring-accent/30 focus:border-accent">
          </div>
          <div>
            <label class="block text-sm font-medium text-text-secondary mb-1.5">Password</label>
            <input type="password" name="password" required autocomplete="current-password"
              class="w-full bg-surface border border-border rounded-xl px-4 py-2.5 text-text-primary focus:outline-none focus:ring-2 focus:ring-accent/30 focus:border-accent">
          </div>
          <button type="submit"
            class="w-full px-6 py-3 bg-accent hover:bg-accent-hover text-white font-medium rounded-xl mt-2">
            Sign In
          </button>
        </form>
      </div>
    </div>
  `;

  return layout("Login", body);
}
