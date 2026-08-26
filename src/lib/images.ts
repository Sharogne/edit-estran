import sharp from "sharp";
import { COVER_RATIO } from "@/config/uploads";

// Every stored image is normalised to WebP and inlined as a data URI, so the
// whole site fits in one JSON file: no uploads directory, no orphan files, no
// second thing to back up. They are SERVED through the /media route rather than
// inline in the HTML — see src/lib/media.ts for why.

export type ImageVariant = { width: number; height: number; quality: number };

// Le cadrage se décide ICI, plus dans le CSS : `object-cover` sur un conteneur
// `aspect-2/3` rognait en silence toute image d'un autre format, sans que
// l'éditeur voie jamais ce qui allait être coupé ni puisse s'y opposer. Ce qui
// est stocké est désormais exactement ce qui est affiché.

function variante(width: number, quality: number): ImageVariant {
  return { width, height: Math.round(width / COVER_RATIO), quality };
}

/** Cartes des listes publiques et vignettes du back office. */
export const COVER_CARD: ImageVariant = variante(600, 68);
/** Front cover on the book page. */
export const COVER_FULL: ImageVariant = variante(900, 72);
/** Back cover ("4e de couverture"), revealed by flipping the card. */
export const BACK_COVER: ImageVariant = variante(900, 72);

/** Hard ceiling per stored variant — keeps content.json (and the HTML) sane. */
const MAX_STORED_BYTES = 250 * 1024;
/** Quality steps retried, in order, when the first encode overshoots. */
const FALLBACK_QUALITIES = [55, 45, 35];

type Taille = { width: number; height: number };

/**
 * Dimensions de la source APRÈS `.rotate()`.
 *
 * `metadata()` décrit les octets tels quels ; une orientation EXIF de 5 à 8
 * (photo prise en tenant l'appareil de côté) fait pivoter l'image d'un quart de
 * tour, et c'est l'image pivotée que l'on redimensionne.
 */
async function dimensionsSource(source: Buffer): Promise<Taille> {
  const { width = 0, height = 0, orientation } = await sharp(source).metadata();
  const pivote = typeof orientation === "number" && orientation >= 5 && orientation <= 8;
  return pivote ? { width: height, height: width } : { width, height };
}

/**
 * La variante demandée, réduite juste ce qu'il faut pour ne jamais agrandir la
 * source — sans jamais lâcher le format 2:3.
 *
 * On ne peut pas se contenter de `withoutEnlargement`, qui abandonne le format
 * dès que la source est plus petite que la cible : une photo 400 × 300 en
 * ressortait telle quelle, et le rognage arbitraire revenait dans le CSS. On
 * calcule donc la plus grande boîte 2:3 qui tient dans la source.
 */
function cible(variant: ImageVariant, source: Taille): Taille {
  if (!source.width || !source.height) return { width: variant.width, height: variant.height };
  const echelle = Math.min(1, source.width / variant.width, source.height / variant.height);
  const width = Math.max(1, Math.round(variant.width * echelle));
  return { width, height: Math.max(1, Math.round(width / COVER_RATIO)) };
}

function encode(source: Buffer, taille: Taille, quality: number): Promise<Buffer> {
  return sharp(source)
    .rotate() // honour EXIF orientation from phone photos
    .resize(taille.width, taille.height, {
      fit: "cover",
      // Ancrage en haut plutôt que la détection de zone d'intérêt de sharp : sur
      // une couverture, titre et auteur sont en haut, et un cadrage PRÉVISIBLE
      // vaut mieux qu'un cadrage malin que l'éditeur ne peut pas anticiper — le
      // formulaire l'avertit de ce qui sera rogné, encore faut-il pouvoir le
      // prédire.
      position: "top",
    })
    .webp({ quality })
    .toBuffer();
}

/** Encodes raw image bytes into a WebP data URI, backing off on quality if too heavy. */
export async function processImageBuffer(source: Buffer, variant: ImageVariant): Promise<string> {
  const taille = cible(variant, await dimensionsSource(source));
  let webp = await encode(source, taille, variant.quality);
  for (const quality of FALLBACK_QUALITIES) {
    if (webp.byteLength <= MAX_STORED_BYTES) break;
    webp = await encode(source, taille, quality);
  }
  return `data:image/webp;base64,${webp.toString("base64")}`;
}

/** Same, for a file coming out of a FormData (already validated by Zod). */
export async function processImage(file: File, variant: ImageVariant): Promise<string> {
  return processImageBuffer(Buffer.from(await file.arrayBuffer()), variant);
}

const DATA_URI_PATTERN = /^data:(image\/[a-z+]+);base64,(.+)$/;

/** Decodes a stored data URI back to bytes — used by the /media and /og routes. */
export function decodeDataUri(
  uri: string
): { contentType: string; body: Uint8Array<ArrayBuffer> } | null {
  const match = DATA_URI_PATTERN.exec(uri);
  if (!match) return null;
  // Copied out of the Buffer pool so the view owns a plain ArrayBuffer, which is
  // what a Response body accepts.
  return { contentType: match[1], body: new Uint8Array(Buffer.from(match[2], "base64")) };
}
