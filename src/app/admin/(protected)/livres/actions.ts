"use server";

import crypto from "node:crypto";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import type { z } from "zod";
import { mutateContent, readContent } from "@/lib/store";
import type { StoredBook } from "@/lib/content-types";
import { requireAdmin } from "@/lib/session";
import { slugify, uniqueSlug } from "@/lib/slugify";
import { routing } from "@/i18n/routing";
import {
  bookFormDataToObject,
  bookFormSchema,
  imageFileSchema,
  reorderSchema,
} from "@/lib/validation/book";
import type { ImageVariant } from "@/lib/images";
import { BACK_COVER, COVER_CARD, COVER_FULL, processImage } from "@/lib/images";

export type BookActionState = { error?: string; success?: boolean };

// --- helpers ---

function revalidatePublic(...slugs: (string | undefined)[]) {
  for (const locale of routing.locales) {
    revalidatePath(`/${locale}`);
    revalidatePath(`/${locale}/projets`);
    for (const slug of slugs) {
      if (slug) revalidatePath(`/${locale}/projets/${slug}`);
    }
  }
  revalidatePath("/sitemap.xml");
}

/** Libellés tels qu'ils apparaissent dans le formulaire, pour des erreurs lisibles. */
const CHAMPS: Record<string, string> = {
  status: "Statut",
  publishedAt: "Date de parution",
  purchaseUrl: "Lien d'achat",
  "fr.title": "Titre (FR)",
  "fr.synopsis": "Synopsis (FR)",
  "en.title": "Titre (EN)",
  "en.synopsis": "Synopsis (EN)",
};

function formatZodError(error: z.ZodError): string {
  const issue = error.issues[0];
  const chemin = issue.path.join(".");
  // Une contrainte inter-langues n'a pas de chemin : son message est complet.
  if (!chemin) return issue.message;
  return `${CHAMPS[chemin] ?? chemin} : ${issue.message}`;
}

class ImageValidationError extends Error {}
class BookGoneError extends Error {}

const BOOK_GONE = "Livre introuvable.";

/**
 * Dérive l'adresse publique du titre français, à défaut de l'anglais.
 * L'éditeur ne saisit plus de slug : une URL est une conséquence du titre, pas
 * un paramètre de plus à remplir.
 */
function slugDepuisTitre(
  data: { fr: { title: string }; en: { title: string } },
  dejaPris: (candidat: string) => boolean
): string {
  return uniqueSlug(slugify(data.fr.title || data.en.title), dejaPris);
}

/**
 * Un slug ne suit le titre que TANT QUE le livre n'est pas publié.
 * Une fois l'adresse publique diffusée (partage, favori, indexation), la
 * régénérer casserait ces liens en silence — et l'éditeur n'a plus de champ où
 * s'en apercevoir.
 *
 * C'est `status` qui fait foi, et non `publishedAt` : la date de parution est un
 * champ éditorial librement saisi, et s'en servir figeait le titre d'un
 * brouillon qui n'a jamais été en ligne. La publication étant à sens unique
 * (cf. statutApresEdition), « publié » vaut bien « a été rendu public ».
 */
function slugFige(livre: { status: string }): boolean {
  return livre.status === "published";
}

/**
 * La publication est à SENS UNIQUE : un livre en ligne ne redevient pas un
 * brouillon, on le retire en le supprimant. Le formulaire ne propose plus la
 * marche arrière, mais c'est ICI que la règle tient — comme pour le slug figé,
 * le formulaire n'est qu'une aide à la saisie.
 */
function statutApresEdition(
  livre: { status: string },
  demande: "draft" | "published"
): "draft" | "published" {
  return livre.status === "published" ? "published" : demande;
}

/** Reads one optional image out of a FormData field. Throws a user-readable message. */
function imageFile(formData: FormData, field: string): File | undefined {
  const entry = formData.get(field);
  if (!(entry instanceof File) || entry.size === 0) return undefined;
  const check = imageFileSchema.safeParse(entry);
  if (!check.success) {
    throw new ImageValidationError(`${entry.name || field} — ${check.error.issues[0].message}`);
  }
  return entry;
}

/**
 * `processImage`, mais une image que sharp refuse devient un message.
 *
 * Le formulaire décode déjà le fichier avant l'envoi, mais ce contrôle vit dans
 * le navigateur : il ne couvre ni un client qui poste directement, ni les cas
 * que le navigateur décode et pas sharp. Or une exception qui s'échappe d'une
 * server action ne produit pas d'erreur de formulaire — elle produit la page
 * d'erreur générique de Next (« A server error occurred »), écran noir sans
 * explication ET saisie perdue. Le dernier filet est donc ici.
 */
async function encoder(file: File, variant: ImageVariant): Promise<string> {
  try {
    return await processImage(file, variant);
  } catch (cause) {
    console.error(
      `[admin] encodage impossible : ${file.name} (${file.type}, ${file.size} o)`,
      cause
    );
    throw new ImageValidationError(
      `${file.name || "Image"} — fichier illisible : il est abîmé, ou son contenu ne ` +
        "correspond pas à son extension. Ouvrez-le puis ré-enregistrez-le en JPEG ou PNG."
    );
  }
}

type BookImages = Pick<StoredBook, "coverCard" | "coverImage" | "backCoverImage">;

const NO_IMAGES: BookImages = { coverCard: null, coverImage: null, backCoverImage: null };

/**
 * Encodes whichever images were uploaded; fields left empty keep their current
 * value. Deliberately called OUTSIDE mutateContent: sharp is slow and the write
 * queue is global, so encoding must not hold it.
 */
async function applyImages(
  current: BookImages,
  cover: File | undefined,
  backCover: File | undefined
): Promise<BookImages> {
  const next: BookImages = {
    coverCard: current.coverCard,
    coverImage: current.coverImage,
    backCoverImage: current.backCoverImage,
  };
  if (cover) {
    // Deux variantes du même envoi : la carte pour les listes, la grande pour la
    // fiche du livre. Les deux sont recadrées au format 2:3 par l'encodeur.
    next.coverCard = await encoder(cover, COVER_CARD);
    next.coverImage = await encoder(cover, COVER_FULL);
  }
  if (backCover) {
    next.backCoverImage = await encoder(backCover, BACK_COVER);
  }
  return next;
}

/** publishedAt defaults to today when publishing without an explicit date. */
function effectivePublishedAt(status: string, publishedAt: Date | null): string | null {
  const date = status === "published" && !publishedAt ? new Date() : publishedAt;
  return date ? date.toISOString() : null;
}

// --- actions ---

export async function createBook(
  _prevState: BookActionState,
  formData: FormData
): Promise<BookActionState> {
  await requireAdmin();

  const parsed = bookFormSchema.safeParse(bookFormDataToObject(formData));
  if (!parsed.success) return { error: formatZodError(parsed.error) };
  const data = parsed.data;

  let images: BookImages;
  try {
    images = await applyImages(
      NO_IMAGES,
      imageFile(formData, "cover"),
      imageFile(formData, "backCover")
    );
  } catch (error) {
    if (error instanceof ImageValidationError) return { error: error.message };
    throw error;
  }

  const bookId = crypto.randomUUID();
  const now = new Date().toISOString();

  const slug = await mutateContent((draft) => {
    const nouveauSlug = slugDepuisTitre(data, (candidat) =>
      draft.books.some((book) => book.slug === candidat)
    );
    const dernierRang = draft.books.reduce((max, livre) => Math.max(max, livre.sortOrder), -1);
    draft.books.push({
      ...images,
      id: bookId,
      slug: nouveauSlug,
      status: data.status,
      publishedAt: effectivePublishedAt(data.status, data.publishedAt),
      // Rang posé en fin : l'ordre se règle ensuite au glisser-déposer.
      sortOrder: dernierRang + 1,
      purchaseUrl: data.purchaseUrl,
      createdAt: now,
      updatedAt: now,
      translations: { fr: data.fr, en: data.en },
    });
    return nouveauSlug;
  });

  revalidatePublic(slug);
  revalidatePath("/admin");
  redirect(`/admin/livres/${bookId}`);
}

export async function updateBook(
  _prevState: BookActionState,
  formData: FormData
): Promise<BookActionState> {
  await requireAdmin();

  const bookId = String(formData.get("bookId") ?? "");
  const { books } = await readContent();
  const existing = books.find((book) => book.id === bookId);
  if (!existing) return { error: BOOK_GONE };

  const parsed = bookFormSchema.safeParse(bookFormDataToObject(formData));
  if (!parsed.success) return { error: formatZodError(parsed.error) };
  const data = parsed.data;

  let images: BookImages;
  try {
    images = await applyImages(
      existing,
      imageFile(formData, "cover"),
      imageFile(formData, "backCover")
    );
  } catch (error) {
    if (error instanceof ImageValidationError) return { error: error.message };
    throw error;
  }

  let nouveauSlug = existing.slug;
  try {
    await mutateContent((draft) => {
      const book = draft.books.find((candidate) => candidate.id === bookId);
      if (!book) throw new BookGoneError();
      nouveauSlug = slugFige(book)
        ? book.slug
        : slugDepuisTitre(data, (candidat) =>
            draft.books.some((autre) => autre.id !== bookId && autre.slug === candidat)
          );
      const statut = statutApresEdition(book, data.status);
      Object.assign(book, {
        ...images,
        slug: nouveauSlug,
        status: statut,
        publishedAt: effectivePublishedAt(statut, data.publishedAt),
        purchaseUrl: data.purchaseUrl,
        updatedAt: new Date().toISOString(),
        translations: { fr: data.fr, en: data.en },
      } satisfies Partial<StoredBook>);
    });
  } catch (error) {
    if (error instanceof BookGoneError) return { error: BOOK_GONE };
    throw error;
  }

  // Old slug too: its public page must drop out if the slug changed.
  revalidatePublic(existing.slug, nouveauSlug);
  revalidatePath(`/admin/livres/${bookId}`);
  revalidatePath("/admin");
  return { success: true };
}

export async function deleteBook(formData: FormData): Promise<void> {
  await requireAdmin();

  const bookId = String(formData.get("bookId") ?? "");
  const removedSlug = await mutateContent((draft) => {
    const index = draft.books.findIndex((book) => book.id === bookId);
    if (index === -1) return undefined;
    // The images live inside the entry, so they go with it — nothing is left behind.
    return draft.books.splice(index, 1)[0].slug;
  });

  if (removedSlug) revalidatePublic(removedSlug);
  revalidatePath("/admin");
  redirect("/admin");
}

export async function reorderBooks(orderedIds: string[]): Promise<BookActionState> {
  await requireAdmin();

  const parsed = reorderSchema.safeParse(orderedIds);
  if (!parsed.success) return { error: "Ordre invalide." };

  await mutateContent((draft) => {
    const rang = new Map(parsed.data.map((id, index) => [id, index]));
    // Un livre absent de la liste reçue (créé depuis l'affichage de la page)
    // n'est pas perdu : il se range derrière ceux qui viennent d'être ordonnés.
    let suivant = rang.size;
    for (const livre of draft.books) {
      livre.sortOrder = rang.get(livre.id) ?? suivant++;
    }
  });

  // L'ordre ne change que les pages de liste, pas les fiches.
  revalidatePublic();
  revalidatePath("/admin");
  return { success: true };
}
