import sharp from "sharp";

// Every stored image is normalised to WebP and inlined as a data URI, so the
// whole site fits in one JSON file: no uploads directory, no orphan files, no
// second thing to back up. Sizes are deliberately modest — these are covers
// displayed on a page, not print masters.

export type ImageVariant = { width: number; quality: number };

/** List pages + back office. Several per page, so this one stays small. */
export const COVER_THUMB: ImageVariant = { width: 320, quality: 65 };
/** Front cover on the book page. */
export const COVER_FULL: ImageVariant = { width: 900, quality: 72 };
/** Back cover ("4e de couverture"), revealed by flipping the card. */
export const BACK_COVER: ImageVariant = { width: 900, quality: 72 };

/** Hard ceiling per stored variant — keeps content.json (and the HTML) sane. */
const MAX_STORED_BYTES = 250 * 1024;
/** Quality steps retried, in order, when the first encode overshoots. */
const FALLBACK_QUALITIES = [55, 45, 35];

function encode(source: Buffer, width: number, quality: number): Promise<Buffer> {
  return sharp(source)
    .rotate() // honour EXIF orientation from phone photos
    .resize(width, undefined, { withoutEnlargement: true })
    .webp({ quality })
    .toBuffer();
}

/** Encodes raw image bytes into a WebP data URI, backing off on quality if too heavy. */
export async function processImageBuffer(source: Buffer, variant: ImageVariant): Promise<string> {
  let webp = await encode(source, variant.width, variant.quality);
  for (const quality of FALLBACK_QUALITIES) {
    if (webp.byteLength <= MAX_STORED_BYTES) break;
    webp = await encode(source, variant.width, quality);
  }
  return `data:image/webp;base64,${webp.toString("base64")}`;
}

/** Same, for a file coming out of a FormData (already validated by Zod). */
export async function processImage(file: File, variant: ImageVariant): Promise<string> {
  return processImageBuffer(Buffer.from(await file.arrayBuffer()), variant);
}

const DATA_URI_PATTERN = /^data:(image\/[a-z+]+);base64,(.+)$/;

/** Decodes a stored data URI back to bytes — used by the /og image route. */
export function decodeDataUri(
  uri: string
): { contentType: string; body: Uint8Array<ArrayBuffer> } | null {
  const match = DATA_URI_PATTERN.exec(uri);
  if (!match) return null;
  // Copied out of the Buffer pool so the view owns a plain ArrayBuffer, which is
  // what a Response body accepts.
  return { contentType: match[1], body: new Uint8Array(Buffer.from(match[2], "base64")) };
}
