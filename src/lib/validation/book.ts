import { z } from "zod";

// Single source of truth for book form constraints (used by all server actions).

export const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

const localeContentSchema = z.object({
  title: z.string().trim().min(1, "Le titre est requis").max(200, "Titre trop long"),
  synopsis: z
    .string()
    .trim()
    .min(1, "Le synopsis est requis")
    .max(5000, "Synopsis trop long (5000 caractères max)"),
});

export const bookFormSchema = z.object({
  slug: z
    .string()
    .trim()
    .toLowerCase()
    .min(1, "Le slug est requis")
    .max(120, "Slug trop long")
    .regex(SLUG_PATTERN, "Slug invalide : minuscules, chiffres et tirets uniquement"),
  status: z.enum(["draft", "published"]),
  // <input type="date"> sends "" or "YYYY-MM-DD"
  publishedAt: z
    .string()
    .trim()
    .transform((value) => (value === "" ? null : new Date(`${value}T00:00:00.000Z`)))
    .pipe(z.date().nullable()),
  sortOrder: z.coerce.number().int().min(0).max(9999).default(0),
  fr: localeContentSchema,
  en: localeContentSchema,
});

export type BookFormValues = z.infer<typeof bookFormSchema>;

// --- Image uploads ---

export const MAX_IMAGE_BYTES = 10 * 1024 * 1024; // 10 MB
export const ALLOWED_IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp", "image/avif"];

export const imageFileSchema = z
  .custom<File>((value) => value instanceof File, "Fichier invalide")
  .refine((file) => file.size > 0, "Fichier vide")
  .refine((file) => file.size <= MAX_IMAGE_BYTES, "Image trop lourde (10 Mo max)")
  .refine(
    (file) => ALLOWED_IMAGE_TYPES.includes(file.type),
    "Format non supporté (JPEG, PNG, WebP ou AVIF)"
  );

/** Reads the book form fields out of a FormData (names match BookForm inputs). */
export function bookFormDataToObject(formData: FormData) {
  return {
    slug: String(formData.get("slug") ?? ""),
    status: String(formData.get("status") ?? "draft"),
    publishedAt: String(formData.get("publishedAt") ?? ""),
    sortOrder: String(formData.get("sortOrder") ?? "0"),
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
