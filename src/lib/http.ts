export function html(body: string, status = 200) {
  return new Response(body, { status, headers: { "Content-Type": "text/html" } });
}

export function isExpired(expiresAt: string | null): boolean {
  if (!expiresAt) return false;
  return new Date(expiresAt + "Z").getTime() < Date.now();
}
