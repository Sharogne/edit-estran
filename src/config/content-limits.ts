/**
 * Longueurs maximales des champs texte d'un livre — la SEULE source de vérité.
 *
 * Même parti pris que `src/config/uploads.ts` : un module feuille (aucun import),
 * consommé à la fois par les schémas Zod (`src/lib/validation/book.ts`) et par le
 * formulaire du back office, qui en dérive son `maxLength` et son compteur. Un
 * plafond recopié à deux endroits finit par diverger, et c'est l'éditeur qui
 * l'apprend — en se faisant refuser une saisie que le champ avait acceptée.
 */

/** Titre d'un livre, par langue. */
export const MAX_TITLE_CHARS = 200;

/**
 * Synopsis, par langue. ~250 mots : une 4e de couverture complète, qui tient
 * dans la colonne de texte de la fiche sans écraser la couverture à côté.
 */
export const MAX_SYNOPSIS_CHARS = 1500;

/** Lien marchand facultatif. */
export const MAX_PURCHASE_URL_CHARS = 500;

/**
 * À partir d'où le compteur du formulaire prévient. Assez tôt pour qu'on puisse
 * resserrer un paragraphe, assez tard pour ne pas parasiter une saisie normale.
 */
export const SEUIL_ALERTE = 0.9;
