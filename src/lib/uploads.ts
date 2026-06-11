import path from "node:path";
import fs from "node:fs/promises";
import crypto from "node:crypto";
import sharp from "sharp";

// The ONLY module allowed to touch the uploads filesystem (see AGENTS.md).
// Files live OUTSIDE the build directory so deploys never destroy them:
//   dev:  ./data/uploads        prod: /srv/edit/shared/uploads (env UPLOADS_DIR)

export function uploadsRoot(): string {
  // turbopackIgnore: runtime-only path, must not be traced into the build output
  return path.resolve(/*turbopackIgnore: true*/ process.cwd(), process.env.UPLOADS_DIR ?? "./data/uploads");
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

// --- Image processing (sharp) ---
// Every stored image is normalised to WebP with a unique filename, which makes
// the immutable cache policy of the /uploads route safe (no stale overwrite).

const COVER_MAX_WIDTH = 1600;
const PREVIEW_MAX_WIDTH = 1600;

async function saveProcessedImage(
  bookId: string,
  prefix: "cover" | "preview",
  file: File,
  maxWidth: number
): Promise<string> {
  const buffer = Buffer.from(await file.arrayBuffer());
  const fileName = `${prefix}-${crypto.randomUUID()}.webp`;
  const absoluteDir = await ensureUploadDir(path.join("books", bookId));
  await sharp(buffer)
    .rotate() // honour EXIF orientation from phone photos
    .resize(maxWidth, undefined, { withoutEnlargement: true })
    .webp({ quality: 85 })
    .toFile(path.join(absoluteDir, fileName));
  return path.posix.join("books", bookId, fileName);
}

/** Processes + stores a cover image, returns its DB-relative path. */
export function saveCoverImage(bookId: string, file: File): Promise<string> {
  return saveProcessedImage(bookId, "cover", file, COVER_MAX_WIDTH);
}

/** Processes + stores one preview page image, returns its DB-relative path. */
export function savePreviewImage(bookId: string, file: File): Promise<string> {
  return saveProcessedImage(bookId, "preview", file, PREVIEW_MAX_WIDTH);
}
