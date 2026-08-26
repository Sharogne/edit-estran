/**
 * Limites d'import des images — la SEULE source de vérité.
 *
 * Ce module est volontairement une feuille (aucun import) : il est chargé aussi
 * bien par `next.config.ts` que par un composant client, et il ne doit rien
 * embarquer d'autre. C'est ce qui permet de dériver la limite de transport des
 * server actions des limites annoncées à l'éditeur, au lieu de les recopier.
 */

/**
 * Format de toutes les couvertures : 2:3, celui d'un livre broché.
 *
 * Vit ici plutôt que dans src/lib/images.ts parce que le formulaire s'en sert
 * pour annoncer le rognage AVANT l'envoi, et qu'un composant client ne peut pas
 * importer le module d'encodage — il embarque sharp.
 */
export const COVER_RATIO = 2 / 3;

/** Poids maximal d'UN fichier déposé. */
export const MAX_IMAGE_BYTES = 10 * 1024 * 1024; // 10 Mo

/** Types acceptés. Contrôlés côté navigateur (`accept` + refus) ET côté serveur (Zod). */
export const ALLOWED_IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp", "image/avif"];

/**
 * Nombre de fichiers qu'un envoi du formulaire livre peut porter :
 * couverture + 4e de couverture.
 */
export const MAX_IMAGES_PER_SUBMIT = 2;

/**
 * `limitInputPixels` par défaut de sharp (16383 × 16383). Au-delà, sharp lève
 * — pas un message d'erreur, une exception. Un PNG uni de 20000×20000 pèse
 * moins de 1 Mo : il passe tous les contrôles de POIDS et fait quand même
 * tomber l'encodage. Le nombre de pixels est donc un contrôle à part entière.
 */
export const MAX_IMAGE_PIXELS = 16383 * 16383;

/**
 * Plafond de corps de requête des server actions (`next.config.ts`).
 *
 * Il DOIT rester au-dessus de ce que le formulaire peut légitimement envoyer :
 * au-delà, Next rejette la requête au transport, la server action n'est jamais
 * appelée et l'éditeur reçoit la page d'erreur générique de Next
 * (« A server error occurred ») au lieu d'un message. Deux images au maximum
 * autorisé + une marge pour les champs texte et l'enrobage multipart.
 */
const MARGE_MO = 2;
export const SERVER_ACTION_BODY_LIMIT_MB =
  (MAX_IMAGE_BYTES * MAX_IMAGES_PER_SUBMIT) / (1024 * 1024) + MARGE_MO;
