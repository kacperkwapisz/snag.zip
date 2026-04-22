export function esc(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export function sanitizeFilename(name: string): string {
  return name
    .replace(/\.\.\//g, "")
    .replace(/^\/+/, "")
    .replace(/\0/g, "")
    .replace(/\\/g, "")
    .replace(/[\x01-\x1f]/g, "");
}

export function safeContentDisposition(filename: string): string {
  const ascii = filename.replace(/[^\x20-\x7E]/g, "_");
  const encoded = encodeURIComponent(filename);
  return `attachment; filename="${ascii}"; filename*=UTF-8''${encoded}`;
}

export function formatBytes(bytes: number): string {
  if (bytes === 0) return "0 B";
  const units = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  return `${(bytes / Math.pow(1024, i)).toFixed(i > 0 ? 1 : 0)} ${units[i]}`;
}

export function formatDate(isoString: string): string {
  const d = new Date(isoString + "Z");
  return d.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function fileExtension(filename: string): string {
  const dot = filename.lastIndexOf(".");
  if (dot === -1 || dot === filename.length - 1) return "FILE";
  return filename.slice(dot + 1).toUpperCase().slice(0, 4);
}

const mimeLabels: Record<string, string> = {
  "application/pdf": "PDF Document",
  "application/zip": "ZIP Archive",
  "application/x-zip-compressed": "ZIP Archive",
  "application/gzip": "GZIP Archive",
  "application/x-tar": "TAR Archive",
  "application/x-7z-compressed": "7-Zip Archive",
  "application/x-rar-compressed": "RAR Archive",
  "application/json": "JSON File",
  "application/xml": "XML File",
  "application/javascript": "JavaScript File",
  "text/plain": "Text File",
  "text/html": "HTML Document",
  "text/css": "CSS File",
  "text/csv": "CSV File",
  "text/markdown": "Markdown File",
  "image/png": "PNG Image",
  "image/jpeg": "JPEG Image",
  "image/gif": "GIF Image",
  "image/svg+xml": "SVG Image",
  "image/webp": "WebP Image",
  "image/heic": "HEIC Image",
  "font/ttf": "TrueType Font",
  "font/otf": "OpenType Font",
  "font/woff": "WOFF Font",
  "font/woff2": "WOFF2 Font",
  "application/font-sfnt": "TrueType Font",
};

export function fileTypeLabel(mimeType: string, filename: string): string {
  if (mimeLabels[mimeType]) return mimeLabels[mimeType];
  if (mimeType.startsWith("video/")) return "Video";
  if (mimeType.startsWith("audio/")) return "Audio";
  if (mimeType.startsWith("image/")) return "Image";
  const ext = fileExtension(filename);
  return ext !== "FILE" ? `${ext} File` : "File";
}

export function timeAgo(isoString: string): string {
  const now = Date.now();
  const then = new Date(isoString + "Z").getTime();
  const diff = now - then;

  if (diff < 60 * 1000) return "just now";
  const minutes = Math.floor(diff / (60 * 1000));
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d ago`;
  const months = Math.floor(days / 30);
  if (months < 12) return `${months}mo ago`;
  const years = Math.floor(days / 365);
  return `${years}y ago`;
}

export function timeUntilExpiry(expiresAt: string): string {
  const now = Date.now();
  const expiry = new Date(expiresAt + "Z").getTime();
  const diff = expiry - now;

  if (diff <= 0) return "Expired";

  const hours = Math.floor(diff / (1000 * 60 * 60));
  const days = Math.floor(hours / 24);

  if (days > 0) return `${days}d ${hours % 24}h`;
  if (hours > 0) return `${hours}h`;
  const minutes = Math.floor(diff / (1000 * 60));
  return `${minutes}m`;
}
