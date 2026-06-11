import fs from "node:fs/promises";
import path from "node:path";
import { resolveUploadPath } from "@/lib/uploads";

// Serves files from UPLOADS_DIR (dev and prod fallback — in prod, Nginx serves
// /uploads/ directly from disk and requests never reach this handler).
// Filenames are content-unique (cuid), hence the immutable cache policy.

const CONTENT_TYPES: Record<string, string> = {
  ".webp": "image/webp",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
  ".avif": "image/avif",
  ".gif": "image/gif",
};

export async function GET(_request: Request, ctx: RouteContext<"/uploads/[...path]">) {
  const { path: segments } = await ctx.params;
  const relativePath = segments.join("/");

  const absolute = resolveUploadPath(relativePath);
  if (!absolute) {
    return new Response("Not found", { status: 404 });
  }

  const contentType = CONTENT_TYPES[path.extname(absolute).toLowerCase()];
  if (!contentType) {
    return new Response("Unsupported media type", { status: 415 });
  }

  try {
    const file = await fs.readFile(absolute);
    return new Response(new Uint8Array(file), {
      headers: {
        "Content-Type": contentType,
        "Cache-Control": "public, max-age=31536000, immutable",
      },
    });
  } catch {
    return new Response("Not found", { status: 404 });
  }
}
