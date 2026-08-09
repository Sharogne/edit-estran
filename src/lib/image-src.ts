// Single place that turns a stored image path into a usable <img> src.
//
// next/image does not prepend basePath when images are unoptimized, so the
// prefix is applied here. NEXT_PUBLIC_BASE_PATH is empty in the app (dev, e2e,
// VPS) and only set by the static GitHub Pages demo — production output is
// therefore unchanged: "/uploads/<path>".

const basePath = process.env.NEXT_PUBLIC_BASE_PATH ?? "";

export function uploadSrc(path: string): string {
  // The static demo stores browser-uploaded images as data: URLs.
  if (path.startsWith("data:")) return path;
  return `${basePath}/uploads/${path}`;
}
