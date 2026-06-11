import path from "node:path";
import fs from "node:fs/promises";

// The ONLY module allowed to touch the uploads filesystem (see AGENTS.md).
// Files live OUTSIDE the build directory so deploys never destroy them:
//   dev:  ./data/uploads        prod: /srv/edit/shared/uploads (env UPLOADS_DIR)

export function uploadsRoot(): string {
  return path.resolve(process.cwd(), process.env.UPLOADS_DIR ?? "./data/uploads");
}

/**
 * Resolves a relative upload path (as stored in DB, e.g. "books/<id>/cover.webp")
 * to an absolute path, guaranteed to stay inside UPLOADS_DIR (path-traversal safe).
 * Returns null when the path escapes the uploads root.
 */
export function resolveUploadPath(relativePath: string): string | null {
  const root = uploadsRoot();
  const absolute = path.resolve(root, relativePath);
  if (absolute !== root && !absolute.startsWith(root + path.sep)) {
    return null;
  }
  return absolute;
}

export async function ensureUploadDir(relativeDir: string): Promise<string> {
  const absolute = resolveUploadPath(relativeDir);
  if (!absolute) {
    throw new Error(`Upload path escapes UPLOADS_DIR: ${relativeDir}`);
  }
  await fs.mkdir(absolute, { recursive: true });
  return absolute;
}

/** Deletes a single uploaded file; silently ignores files already gone. */
export async function deleteUpload(relativePath: string): Promise<void> {
  const absolute = resolveUploadPath(relativePath);
  if (!absolute) return;
  await fs.rm(absolute, { force: true });
}

/** Deletes a whole book's upload directory (cover + previews). */
export async function deleteBookUploads(bookId: string): Promise<void> {
  const absolute = resolveUploadPath(path.join("books", bookId));
  if (!absolute) return;
  await fs.rm(absolute, { recursive: true, force: true });
}
