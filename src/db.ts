import { Database } from "bun:sqlite";
import { config } from "./config";

const db = new Database(config.databasePath, { create: true, strict: true });

db.run("PRAGMA journal_mode = WAL");
db.run("PRAGMA foreign_keys = ON");

db.run(`
  CREATE TABLE IF NOT EXISTS folders (
    id TEXT PRIMARY KEY,
    slug TEXT UNIQUE NOT NULL,
    title TEXT,
    description TEXT,
    created_at TEXT DEFAULT (datetime('now')),
    expires_at TEXT
  )
`);

db.run(`
  CREATE TABLE IF NOT EXISTS files (
    id TEXT PRIMARY KEY,
    filename TEXT NOT NULL,
    size INTEGER NOT NULL,
    type TEXT NOT NULL,
    s3_key TEXT NOT NULL,
    folder_id TEXT,
    uploaded_at TEXT DEFAULT (datetime('now')),
    expires_at TEXT,
    password_hash TEXT,
    downloads INTEGER DEFAULT 0,
    FOREIGN KEY (folder_id) REFERENCES folders(id)
  )
`);

// --- File queries ---

const insertFileStmt = db.prepare(`
  INSERT INTO files (id, filename, size, type, s3_key, folder_id, expires_at, password_hash)
  VALUES ($id, $filename, $size, $type, $s3_key, $folder_id, $expires_at, $password_hash)
`);

const getFileStmt = db.prepare(`SELECT * FROM files WHERE id = ?`);
const incrementDownloadsStmt = db.prepare(`UPDATE files SET downloads = downloads + 1 WHERE id = ?`);
const deleteFileStmt = db.prepare(`DELETE FROM files WHERE id = ?`);
const listFilesStmt = db.prepare(`SELECT * FROM files ORDER BY uploaded_at DESC`);
const getFilesByFolderStmt = db.prepare(`SELECT * FROM files WHERE folder_id = ? ORDER BY uploaded_at ASC`);
const getExpiredFilesStmt = db.prepare(`SELECT * FROM files WHERE expires_at IS NOT NULL AND expires_at < datetime('now')`);

export type FileRow = {
  id: string;
  filename: string;
  size: number;
  type: string;
  s3_key: string;
  folder_id: string | null;
  uploaded_at: string;
  expires_at: string | null;
  password_hash: string | null;
  downloads: number;
};

export function insertFile(file: {
  id: string;
  filename: string;
  size: number;
  type: string;
  s3_key: string;
  folder_id?: string | null;
  expires_at?: string | null;
  password_hash?: string | null;
}) {
  insertFileStmt.run({
    id: file.id,
    filename: file.filename,
    size: file.size,
    type: file.type,
    s3_key: file.s3_key,
    folder_id: file.folder_id ?? null,
    expires_at: file.expires_at ?? null,
    password_hash: file.password_hash ?? null,
  });
}

export function getFile(id: string): FileRow | null {
  return getFileStmt.get(id) as FileRow | null;
}

export function incrementDownloads(id: string) {
  incrementDownloadsStmt.run(id);
}

export function deleteFileRecord(id: string) {
  deleteFileStmt.run(id);
}

export function listFiles(): FileRow[] {
  return listFilesStmt.all() as FileRow[];
}

export function getFilesByFolder(folderId: string): FileRow[] {
  return getFilesByFolderStmt.all(folderId) as FileRow[];
}

export function getExpiredFiles(): FileRow[] {
  return getExpiredFilesStmt.all() as FileRow[];
}

// --- Folder queries ---

const insertFolderStmt = db.prepare(`
  INSERT INTO folders (id, slug, title, description, expires_at)
  VALUES ($id, $slug, $title, $description, $expires_at)
`);

const getFolderBySlugStmt = db.prepare(`SELECT * FROM folders WHERE slug = ?`);
const getFolderStmt = db.prepare(`SELECT * FROM folders WHERE id = ?`);
const deleteFolderStmt = db.prepare(`DELETE FROM folders WHERE id = ?`);
const getExpiredFoldersStmt = db.prepare(`SELECT * FROM folders WHERE expires_at IS NOT NULL AND expires_at < datetime('now')`);

export type FolderRow = {
  id: string;
  slug: string;
  title: string | null;
  description: string | null;
  created_at: string;
  expires_at: string | null;
};

export function insertFolder(folder: {
  id: string;
  slug: string;
  title?: string | null;
  description?: string | null;
  expires_at?: string | null;
}) {
  insertFolderStmt.run({
    id: folder.id,
    slug: folder.slug,
    title: folder.title ?? null,
    description: folder.description ?? null,
    expires_at: folder.expires_at ?? null,
  });
}

export function getFolderBySlug(slug: string): FolderRow | null {
  return getFolderBySlugStmt.get(slug) as FolderRow | null;
}

export function getFolder(id: string): FolderRow | null {
  return getFolderStmt.get(id) as FolderRow | null;
}

export function deleteFolderRecord(id: string) {
  deleteFolderStmt.run(id);
}

export function getExpiredFolders(): FolderRow[] {
  return getExpiredFoldersStmt.all() as FolderRow[];
}

// --- API Key queries ---

db.run(`
  CREATE TABLE IF NOT EXISTS api_keys (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    key_hash TEXT NOT NULL,
    created_at TEXT DEFAULT (datetime('now')),
    last_used_at TEXT,
    is_active INTEGER DEFAULT 1
  )
`);

db.run(`CREATE INDEX IF NOT EXISTS idx_api_keys_hash ON api_keys(key_hash)`);

const insertApiKeyStmt = db.prepare(`
  INSERT INTO api_keys (id, name, key_hash)
  VALUES ($id, $name, $key_hash)
`);

const getApiKeyByHashStmt = db.prepare(`SELECT * FROM api_keys WHERE key_hash = ? AND is_active = 1`);
const listApiKeysStmt = db.prepare(`SELECT id, name, created_at, last_used_at, is_active FROM api_keys ORDER BY created_at DESC`);
const revokeApiKeyStmt = db.prepare(`UPDATE api_keys SET is_active = 0 WHERE id = ?`);
const deleteApiKeyStmt = db.prepare(`DELETE FROM api_keys WHERE id = ?`);
const updateApiKeyLastUsedStmt = db.prepare(`UPDATE api_keys SET last_used_at = datetime('now') WHERE id = ?`);

export type ApiKeyRow = {
  id: string;
  name: string;
  key_hash: string;
  created_at: string;
  last_used_at: string | null;
  is_active: number;
};

export function insertApiKey(apiKey: { id: string; name: string; key_hash: string }) {
  insertApiKeyStmt.run({ id: apiKey.id, name: apiKey.name, key_hash: apiKey.key_hash });
}

export function getApiKeyByHash(keyHash: string): ApiKeyRow | null {
  return getApiKeyByHashStmt.get(keyHash) as ApiKeyRow | null;
}

export function listApiKeys(): Omit<ApiKeyRow, "key_hash">[] {
  return listApiKeysStmt.all() as Omit<ApiKeyRow, "key_hash">[];
}

export function revokeApiKey(id: string) {
  revokeApiKeyStmt.run(id);
}

export function deleteApiKey(id: string) {
  deleteApiKeyStmt.run(id);
}

export function updateApiKeyLastUsed(id: string) {
  updateApiKeyLastUsedStmt.run(id);
}

// --- Stats ---

const statsStmt = db.prepare(`
  SELECT
    COUNT(*) as total_files,
    COALESCE(SUM(size), 0) as total_size,
    COALESCE(SUM(downloads), 0) as total_downloads
  FROM files
`);

export type Stats = {
  total_files: number;
  total_size: number;
  total_downloads: number;
};

export function getStats(): Stats {
  return statsStmt.get() as Stats;
}
