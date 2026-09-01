/**
 * Adressage des images du site.
 *
 * Les couvertures vivent dans `content.json`, encodées en data URI — c'est le
 * principe de cette variante : une seule chose à sauvegarder. Mais les SERVIR
 * inline dans le HTML coûtait cher : chaque image y apparaissait deux fois
 * (balise `<img>` et charge utile RSC), sans cache navigateur ni chargement
 * différé, ce qui plafonnait la résolution des vignettes bien en dessous de ce
 * qu'un écran moderne demande.
 *
 * Elles passent donc par une route, `/media`, qui les décode à la volée depuis
 * le contenu déjà en mémoire. Rien n'est écrit sur le disque : le stockage n'a
 * pas changé, seule la livraison.
 *
 * L'URL porte une VERSION dérivée de `updatedAt` : elle change dès que le livre
 * est modifié, ce qui permet de servir la réponse en cache immuable sans jamais
 * montrer une couverture périmée.
 */

export const MEDIA_VARIANTS = ["card", "cover", "back"] as const;
export type MediaVariant = (typeof MEDIA_VARIANTS)[number];

/** Jeton de version d'une image, dérivé de la date de dernière modification. */
export function mediaVersion(updatedAt: string): string {
  const instant = Date.parse(updatedAt);
  return Number.isNaN(instant) ? "0" : instant.toString(36);
}

export function mediaUrl(id: string, variant: MediaVariant, version: string): string {
  return `/media/${id}/${variant}-${version}.webp`;
}

// L'extension finale n'est pas décorative : le matcher de src/proxy.ts écarte
// déjà tout chemin contenant un point, et les clients qui devinent un type
// depuis l'URL (certains crawlers, certains proxys) tombent juste.
const NOM_FICHIER = /^(card|cover|back)-([0-9a-z]+)\.webp$/;

/** Lit `card-m1x2y3.webp`. Retourne null sur tout ce qui n'a pas cette forme. */
export function parseMediaFilename(
  fichier: string
): { variant: MediaVariant; version: string } | null {
  const trouve = NOM_FICHIER.exec(fichier);
  return trouve ? { variant: trouve[1] as MediaVariant, version: trouve[2] } : null;
}
