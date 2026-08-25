/** Turns a title into a URL slug ("L'Heure bleue" -> "l-heure-bleue"). Client-safe. */
export function slugify(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "") // strip diacritics
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 120);
}

/** Longueur max d'un slug, alignée sur ce que slugify produit. */
const SLUG_MAX = 120;

/**
 * Rend un slug unique en suffixant -2, -3… Le premier arrivé garde le slug nu :
 * deux livres au même titre donnent donc "les-jardins" puis "les-jardins-2".
 *
 * `base` peut être vide (titre sans aucun caractère latin) : on retombe alors
 * sur "livre", qui sera suffixé comme les autres.
 */
export function uniqueSlug(base: string, estPris: (candidat: string) => boolean): string {
  const racine = base || "livre";
  if (!estPris(racine)) return racine;

  for (let n = 2; n < 1000; n++) {
    const suffixe = `-${n}`;
    const candidat = racine.slice(0, SLUG_MAX - suffixe.length) + suffixe;
    if (!estPris(candidat)) return candidat;
  }
  // 999 livres au même titre : plus vraisemblablement un bug qu'un catalogue.
  throw new Error(`Impossible de dériver un slug unique depuis "${base}"`);
}
