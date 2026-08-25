"use server";

import crypto from "node:crypto";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import type { z } from "zod";
import { mutateContent, readContent } from "@/lib/store";
import type { StoredBook } from "@/lib/content-types";
import { requireAdmin } from "@/lib/session";
import { routing } from "@/i18n/routing";
import { bookFormDataToObject, bookFormSchema, imageFileSchema } from "@/lib/validation/book";
import { BACK_COVER, COVER_FULL, COVER_THUMB, processImage } from "@/lib/images";

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

function formatZodError(error: z.ZodError): string {
  const issue = error.issues[0];
  const field = issue.path.join(".");
  return field ? `${field} : ${issue.message}` : issue.message;
}

class ImageValidationError extends Error {}
class SlugTakenError extends Error {}
class BookGoneError extends Error {}

const SLUG_TAKEN = "Ce slug est déjà utilisé par un autre livre.";
const BOOK_GONE = "Livre introuvable.";

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

type BookImages = Pick<StoredBook, "coverThumb" | "coverImage" | "backCoverImage">;

const NO_IMAGES: BookImages = { coverThumb: null, coverImage: null, backCoverImage: null };

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
    coverThumb: current.coverThumb,
    coverImage: current.coverImage,
    backCoverImage: current.backCoverImage,
  };
  if (cover) {
    // Two variants from the same upload: the thumb keeps list pages light, the
    // full one is what the book page displays.
    next.coverThumb = await processImage(cover, COVER_THUMB);
    next.coverImage = await processImage(cover, COVER_FULL);
  }
  if (backCover) {
    next.backCoverImage = await processImage(backCover, BACK_COVER);
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

  let cover: File | undefined;
  let backCover: File | undefined;
  try {
    cover = imageFile(formData, "cover");
    backCover = imageFile(formData, "backCover");
  } catch (error) {
    if (error instanceof ImageValidationError) return { error: error.message };
    throw error;
  }

  const images = await applyImages(NO_IMAGES, cover, backCover);
  const bookId = crypto.randomUUID();
  const now = new Date().toISOString();

  try {
    await mutateContent((draft) => {
      // Uniqueness is ours to enforce now that there is no unique index.
      if (draft.books.some((book) => book.slug === data.slug)) throw new SlugTakenError();
      draft.books.push({
        ...images,
        id: bookId,
        slug: data.slug,
        status: data.status,
        publishedAt: effectivePublishedAt(data.status, data.publishedAt),
        sortOrder: data.sortOrder,
        createdAt: now,
        updatedAt: now,
        translations: { fr: data.fr, en: data.en },
      });
    });
  } catch (error) {
    if (error instanceof SlugTakenError) return { error: SLUG_TAKEN };
    throw error;
  }

  revalidatePublic(data.slug);
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

  let cover: File | undefined;
  let backCover: File | undefined;
  try {
    cover = imageFile(formData, "cover");
    backCover = imageFile(formData, "backCover");
  } catch (error) {
    if (error instanceof ImageValidationError) return { error: error.message };
    throw error;
  }

  const images = await applyImages(existing, cover, backCover);

  try {
    await mutateContent((draft) => {
      const book = draft.books.find((candidate) => candidate.id === bookId);
      if (!book) throw new BookGoneError();
      if (draft.books.some((other) => other.id !== bookId && other.slug === data.slug)) {
        throw new SlugTakenError();
      }
      Object.assign(book, {
        ...images,
        slug: data.slug,
        status: data.status,
        publishedAt: effectivePublishedAt(data.status, data.publishedAt),
        sortOrder: data.sortOrder,
        updatedAt: new Date().toISOString(),
        translations: { fr: data.fr, en: data.en },
      } satisfies Partial<StoredBook>);
    });
  } catch (error) {
    if (error instanceof SlugTakenError) return { error: SLUG_TAKEN };
    if (error instanceof BookGoneError) return { error: BOOK_GONE };
    throw error;
  }

  // Old slug too: its public page must drop out if the slug changed.
  revalidatePublic(existing.slug, data.slug);
  revalidatePath(`/admin/livres/${bookId}`);
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
  redirect("/admin");
}
