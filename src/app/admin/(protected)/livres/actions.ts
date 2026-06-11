"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { Prisma } from "@prisma/client";
import type { z } from "zod";
import { prisma } from "@/lib/db";
import { requireAdmin } from "@/lib/session";
import { routing } from "@/i18n/routing";
import {
  bookFormDataToObject,
  bookFormSchema,
  imageFileSchema,
} from "@/lib/validation/book";
import {
  deleteBookUploads,
  deleteUpload,
  saveCoverImage,
  savePreviewImage,
} from "@/lib/uploads";

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

function isUniqueViolation(error: unknown): boolean {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002";
}

/** Extracts and validates image files from a FormData field. Throws a user-readable string. */
function imageFiles(formData: FormData, field: string): File[] {
  const files = formData
    .getAll(field)
    .filter((entry): entry is File => entry instanceof File && entry.size > 0);
  for (const file of files) {
    const check = imageFileSchema.safeParse(file);
    if (!check.success) {
      throw new ImageValidationError(`${file.name || field} — ${check.error.issues[0].message}`);
    }
  }
  return files;
}

class ImageValidationError extends Error {}

/** publishedAt defaults to today when publishing without an explicit date. */
function effectivePublishedAt(status: string, publishedAt: Date | null): Date | null {
  return status === "published" && !publishedAt ? new Date() : publishedAt;
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
  let previews: File[];
  try {
    [cover] = imageFiles(formData, "cover");
    previews = imageFiles(formData, "previews");
  } catch (error) {
    if (error instanceof ImageValidationError) return { error: error.message };
    throw error;
  }

  let bookId: string;
  try {
    const book = await prisma.book.create({
      data: {
        slug: data.slug,
        status: data.status,
        publishedAt: effectivePublishedAt(data.status, data.publishedAt),
        sortOrder: data.sortOrder,
        translations: {
          create: [
            { locale: "fr", ...data.fr },
            { locale: "en", ...data.en },
          ],
        },
      },
    });
    bookId = book.id;
  } catch (error) {
    if (isUniqueViolation(error)) return { error: "Ce slug est déjà utilisé par un autre livre." };
    throw error;
  }

  if (cover) {
    const coverPath = await saveCoverImage(bookId, cover);
    await prisma.book.update({ where: { id: bookId }, data: { coverImage: coverPath } });
  }
  for (const [index, file] of previews.entries()) {
    const imagePath = await savePreviewImage(bookId, file);
    await prisma.bookPreviewPage.create({ data: { bookId, imagePath, sortOrder: index } });
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
  const existing = await prisma.book.findUnique({ where: { id: bookId } });
  if (!existing) return { error: "Livre introuvable." };

  const parsed = bookFormSchema.safeParse(bookFormDataToObject(formData));
  if (!parsed.success) return { error: formatZodError(parsed.error) };
  const data = parsed.data;

  let cover: File | undefined;
  try {
    [cover] = imageFiles(formData, "cover");
  } catch (error) {
    if (error instanceof ImageValidationError) return { error: error.message };
    throw error;
  }

  try {
    await prisma.book.update({
      where: { id: bookId },
      data: {
        slug: data.slug,
        status: data.status,
        publishedAt: effectivePublishedAt(data.status, data.publishedAt),
        sortOrder: data.sortOrder,
        translations: {
          upsert: [
            {
              where: { bookId_locale: { bookId, locale: "fr" } },
              update: data.fr,
              create: { locale: "fr", ...data.fr },
            },
            {
              where: { bookId_locale: { bookId, locale: "en" } },
              update: data.en,
              create: { locale: "en", ...data.en },
            },
          ],
        },
      },
    });
  } catch (error) {
    if (isUniqueViolation(error)) return { error: "Ce slug est déjà utilisé par un autre livre." };
    throw error;
  }

  if (cover) {
    const coverPath = await saveCoverImage(bookId, cover);
    await prisma.book.update({ where: { id: bookId }, data: { coverImage: coverPath } });
    if (existing.coverImage) await deleteUpload(existing.coverImage);
  }

  // Old slug too: its public page must drop out if the slug changed.
  revalidatePublic(existing.slug, data.slug);
  revalidatePath(`/admin/livres/${bookId}`);
  return { success: true };
}

export async function deleteBook(formData: FormData): Promise<void> {
  await requireAdmin();

  const bookId = String(formData.get("bookId") ?? "");
  const existing = await prisma.book.findUnique({ where: { id: bookId } });
  if (!existing) redirect("/admin");

  await prisma.book.delete({ where: { id: bookId } }); // cascades translations + previews
  await deleteBookUploads(bookId);

  revalidatePublic(existing.slug);
  redirect("/admin");
}

export async function addPreviewPages(
  _prevState: BookActionState,
  formData: FormData
): Promise<BookActionState> {
  await requireAdmin();

  const bookId = String(formData.get("bookId") ?? "");
  const book = await prisma.book.findUnique({ where: { id: bookId } });
  if (!book) return { error: "Livre introuvable." };

  let files: File[];
  try {
    files = imageFiles(formData, "previews");
  } catch (error) {
    if (error instanceof ImageValidationError) return { error: error.message };
    throw error;
  }
  if (files.length === 0) return { error: "Sélectionnez au moins une image." };

  const last = await prisma.bookPreviewPage.aggregate({
    where: { bookId },
    _max: { sortOrder: true },
  });
  let nextOrder = (last._max.sortOrder ?? -1) + 1;

  for (const file of files) {
    const imagePath = await savePreviewImage(bookId, file);
    await prisma.bookPreviewPage.create({ data: { bookId, imagePath, sortOrder: nextOrder++ } });
  }

  revalidatePublic(book.slug);
  revalidatePath(`/admin/livres/${bookId}`);
  return { success: true };
}

export async function deletePreviewPage(formData: FormData): Promise<void> {
  await requireAdmin();

  const previewId = String(formData.get("previewId") ?? "");
  const preview = await prisma.bookPreviewPage.findUnique({
    where: { id: previewId },
    include: { book: { select: { id: true, slug: true } } },
  });
  if (!preview) return;

  await prisma.bookPreviewPage.delete({ where: { id: previewId } });
  await deleteUpload(preview.imagePath);

  // Keep sortOrder dense (0..n-1) so up/down moves stay simple.
  const remaining = await prisma.bookPreviewPage.findMany({
    where: { bookId: preview.book.id },
    orderBy: { sortOrder: "asc" },
  });
  await prisma.$transaction(
    remaining.map((page, index) =>
      prisma.bookPreviewPage.update({ where: { id: page.id }, data: { sortOrder: index } })
    )
  );

  revalidatePublic(preview.book.slug);
  revalidatePath(`/admin/livres/${preview.book.id}`);
}

export async function movePreviewPage(formData: FormData): Promise<void> {
  await requireAdmin();

  const previewId = String(formData.get("previewId") ?? "");
  const direction = formData.get("direction") === "up" ? -1 : 1;

  const preview = await prisma.bookPreviewPage.findUnique({
    where: { id: previewId },
    include: { book: { select: { id: true, slug: true } } },
  });
  if (!preview) return;

  const neighbor = await prisma.bookPreviewPage.findFirst({
    where: {
      bookId: preview.book.id,
      sortOrder: direction === -1 ? { lt: preview.sortOrder } : { gt: preview.sortOrder },
    },
    orderBy: { sortOrder: direction === -1 ? "desc" : "asc" },
  });
  if (!neighbor) return;

  await prisma.$transaction([
    prisma.bookPreviewPage.update({
      where: { id: preview.id },
      data: { sortOrder: neighbor.sortOrder },
    }),
    prisma.bookPreviewPage.update({
      where: { id: neighbor.id },
      data: { sortOrder: preview.sortOrder },
    }),
  ]);

  revalidatePublic(preview.book.slug);
  revalidatePath(`/admin/livres/${preview.book.id}`);
}
