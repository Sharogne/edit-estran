import { z } from "zod";
import { ALLOWED_IMAGE_TYPES, MAX_IMAGE_BYTES } from "@/config/uploads";
import {
  MAX_PURCHASE_URL_CHARS,
  MAX_SYNOPSIS_CHARS,
  MAX_TITLE_CHARS,
} from "@/config/content-limits";

// Single source of truth for book form constraints (used by all server actions).

// Une locale peut être laissée vide : le rendu reprend alors l'autre langue
// (voir resolveField dans src/lib/books.ts). L'exigence porte donc sur
// l'ENSEMBLE des locales, pas sur chacune — d'où le superRefine plus bas.
const localeContentSchema = z.object({
  title: z
    .string()
    .trim()
    .max(MAX_TITLE_CHARS, `Titre trop long (${MAX_TITLE_CHARS} caractères max)`),
  synopsis: z
    .string()
    .trim()
    .max(MAX_SYNOPSIS_CHARS, `Synopsis trop long (${MAX_SYNOPSIS_CHARS} caractères max)`),
});

const bookFormBaseSchema = z.object({
  status: z.enum(["draft", "published"]),
  // <input type="date"> sends "" or "YYYY-MM-DD"
  publishedAt: z
    .string()
    .trim()
    .transform((value) => (value === "" ? null : new Date(`${value}T00:00:00.000Z`)))
    .pipe(z.date().nullable()),
  // Lien marchand facultatif. Restreint à http/https : ce lien devient un href,
  // et accepter javascript: ou data: ouvrirait une injection depuis le back office.
  purchaseUrl: z
    .string()
    .trim()
    .max(MAX_PURCHASE_URL_CHARS, `Lien trop long (${MAX_PURCHASE_URL_CHARS} caractères max)`)
    .refine((valeur) => {
      if (valeur === "") return true;
      try {
        return ["http:", "https:"].includes(new URL(valeur).protocol);
      } catch {
        return false;
      }
    }, "Lien invalide : une adresse commençant par http:// ou https://")
    .transform((valeur) => (valeur === "" ? null : valeur)),
  fr: localeContentSchema,
  en: localeContentSchema,
});

export const bookFormSchema = bookFormBaseSchema.superRefine((valeurs, ctx) => {
  // Au moins une langue doit porter chaque champ, sinon le livre n'a de titre
  // ou de synopsis dans aucune langue et la fiche publique serait vide.
  if (!valeurs.fr.title && !valeurs.en.title) {
    ctx.addIssue({
      code: "custom",
      path: [],
      message: "Le titre est requis dans au moins une langue",
    });
  }
  if (!valeurs.fr.synopsis && !valeurs.en.synopsis) {
    ctx.addIssue({
      code: "custom",
      path: [],
      message: "Le synopsis est requis dans au moins une langue",
    });
  }
});

export type BookFormValues = z.infer<typeof bookFormSchema>;

// --- Image uploads ---

// Les limites elles-mêmes vivent dans src/config/uploads.ts : elles sont
// partagées avec le formulaire (contrôle avant envoi) et avec next.config.ts
// (plafond de transport). Ici on ne fait que les exprimer en schéma.

export const imageFileSchema = z
  .custom<File>((value) => value instanceof File, "Fichier invalide")
  .refine((file) => file.size > 0, "Fichier vide")
  .refine(
    (file) => file.size <= MAX_IMAGE_BYTES,
    `Image trop lourde (${MAX_IMAGE_BYTES / (1024 * 1024)} Mo max)`
  )
  .refine(
    (file) => ALLOWED_IMAGE_TYPES.includes(file.type),
    "Format non supporté (JPEG, PNG, WebP ou AVIF)"
  );

/** Reads the book form fields out of a FormData (names match BookForm inputs). */
export function bookFormDataToObject(formData: FormData) {
  return {
    status: String(formData.get("status") ?? "draft"),
    publishedAt: String(formData.get("publishedAt") ?? ""),
    purchaseUrl: String(formData.get("purchaseUrl") ?? ""),
    fr: {
      title: String(formData.get("title_fr") ?? ""),
      synopsis: String(formData.get("synopsis_fr") ?? ""),
    },
    en: {
      title: String(formData.get("title_en") ?? ""),
      synopsis: String(formData.get("synopsis_en") ?? ""),
    },
  };
}

/**
 * Ordre du catalogue, envoyé par le glisser-déposer du tableau de bord.
 * Le rang d'un livre n'est plus saisi à la main : il découle de sa position.
 */
export const reorderSchema = z.array(z.string().min(1)).min(1).max(1000);
