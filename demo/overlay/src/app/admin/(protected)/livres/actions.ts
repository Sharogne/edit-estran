"use client";

// STATIC DEMO BUILD — client-side stand-in for the real server actions.
// Same exported names and signatures, so src/components/admin/* is reused
// untouched: React 19 accepts a plain client function in <form action={...}>
// and useActionState. Data lives in localStorage; nothing leaves the browser.

import type { z } from "zod";
import {
  bookFormDataToObject,
  bookFormSchema,
  imageFileSchema,
} from "@/lib/validation/book";
import {
  demoId,
  loadBooks,
  saveBooks,
  type DemoBook,
  type DemoPreview,
} from "@/lib/demo-data";

export type BookActionState = { error?: string; success?: boolean };

const CHANGE_EVENT = "estran-demo-change";

/** Pages re-read the store on this event (replaces revalidatePath). */
function notifyChange(): void {
  window.dispatchEvent(new Event(CHANGE_EVENT));
}

export function onDemoChange(handler: () => void): () => void {
  window.addEventListener(CHANGE_EVENT, handler);
  return () => window.removeEventListener(CHANGE_EVENT, handler);
}

function basePath(): string {
  return process.env.NEXT_PUBLIC_BASE_PATH ?? "";
}

function go(path: string): void {
  window.location.assign(`${basePath()}${path}`);
}

function formatZodError(error: z.ZodError): string {
  const issue = error.issues[0];
  const field = issue.path.join(".");
  return field ? `${field} : ${issue.message}` : issue.message;
}

function effectivePublishedAt(status: string, publishedAt: Date | null): string | null {
  const date = status === "published" && !publishedAt ? new Date() : publishedAt;
  return date ? date.toISOString().slice(0, 10) : null;
}

/**
 * Downscales an image to a data: URL. The real app writes WebP variants to disk
 * with sharp; here the browser is the only storage, and localStorage caps out
 * around 5 MB — so we shrink hard before persisting.
 */
async function fileToDataUrl(file: File, maxWidth: number): Promise<string> {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, maxWidth / bitmap.width);
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  const context = canvas.getContext("2d");
  if (!context) throw new Error("Canvas indisponible");
  context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();
  return canvas.toDataURL("image/webp", 0.72);
}

class ImageValidationError extends Error {}

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

function slugTaken(books: DemoBook[], slug: string, exceptId?: string): boolean {
  return books.some((book) => book.slug === slug && book.id !== exceptId);
}

// --- actions ----------------------------------------------------------------

export async function createBook(
  _prevState: BookActionState,
  formData: FormData
): Promise<BookActionState> {
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

  const books = loadBooks();
  if (slugTaken(books, data.slug)) {
    return { error: "Ce slug est déjà utilisé par un autre livre." };
  }

  const id = demoId("book");
  const book: DemoBook = {
    id,
    slug: data.slug,
    status: data.status,
    publishedAt: effectivePublishedAt(data.status, data.publishedAt),
    sortOrder: data.sortOrder,
    coverImage: cover ? await fileToDataUrl(cover, 480) : null,
    updatedAt: new Date().toISOString(),
    translations: [
      { locale: "fr", ...data.fr },
      { locale: "en", ...data.en },
    ],
    previewPages: await Promise.all(
      previews.map(async (file, index): Promise<DemoPreview> => ({
        id: demoId("preview"),
        imagePath: await fileToDataUrl(file, 480),
        sortOrder: index,
      }))
    ),
  };

  saveBooks([...books, book]);
  go(`/admin/livres/editer/?id=${encodeURIComponent(id)}`);
  return {};
}

export async function updateBook(
  _prevState: BookActionState,
  formData: FormData
): Promise<BookActionState> {
  const bookId = String(formData.get("bookId") ?? "");
  const books = loadBooks();
  const existing = books.find((book) => book.id === bookId);
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

  if (slugTaken(books, data.slug, bookId)) {
    return { error: "Ce slug est déjà utilisé par un autre livre." };
  }

  existing.slug = data.slug;
  existing.status = data.status;
  existing.publishedAt = effectivePublishedAt(data.status, data.publishedAt);
  existing.sortOrder = data.sortOrder;
  existing.translations = [
    { locale: "fr", ...data.fr },
    { locale: "en", ...data.en },
  ];
  existing.updatedAt = new Date().toISOString();
  if (cover) existing.coverImage = await fileToDataUrl(cover, 480);

  saveBooks(books);
  notifyChange();
  return { success: true };
}

export async function deleteBook(formData: FormData): Promise<void> {
  const bookId = String(formData.get("bookId") ?? "");
  saveBooks(loadBooks().filter((book) => book.id !== bookId));
  go("/admin/");
}

export async function addPreviewPages(
  _prevState: BookActionState,
  formData: FormData
): Promise<BookActionState> {
  const bookId = String(formData.get("bookId") ?? "");
  const books = loadBooks();
  const book = books.find((entry) => entry.id === bookId);
  if (!book) return { error: "Livre introuvable." };

  let files: File[];
  try {
    files = imageFiles(formData, "previews");
  } catch (error) {
    if (error instanceof ImageValidationError) return { error: error.message };
    throw error;
  }
  if (files.length === 0) return { error: "Sélectionnez au moins une image." };

  let nextOrder = book.previewPages.reduce((max, page) => Math.max(max, page.sortOrder), -1) + 1;
  for (const file of files) {
    book.previewPages.push({
      id: demoId("preview"),
      imagePath: await fileToDataUrl(file, 480),
      sortOrder: nextOrder++,
    });
  }
  book.updatedAt = new Date().toISOString();

  saveBooks(books);
  notifyChange();
  return { success: true };
}

export async function deletePreviewPage(formData: FormData): Promise<void> {
  const previewId = String(formData.get("previewId") ?? "");
  const books = loadBooks();
  const book = books.find((entry) => entry.previewPages.some((p) => p.id === previewId));
  if (!book) return;

  book.previewPages = book.previewPages
    .filter((page) => page.id !== previewId)
    .sort((a, b) => a.sortOrder - b.sortOrder)
    .map((page, index) => ({ ...page, sortOrder: index })); // keep 0..n-1 dense

  saveBooks(books);
  notifyChange();
}

export async function movePreviewPage(formData: FormData): Promise<void> {
  const previewId = String(formData.get("previewId") ?? "");
  const direction = formData.get("direction") === "up" ? -1 : 1;

  const books = loadBooks();
  const book = books.find((entry) => entry.previewPages.some((p) => p.id === previewId));
  if (!book) return;

  const pages = [...book.previewPages].sort((a, b) => a.sortOrder - b.sortOrder);
  const index = pages.findIndex((page) => page.id === previewId);
  const target = index + direction;
  if (target < 0 || target >= pages.length) return;

  [pages[index], pages[target]] = [pages[target], pages[index]];
  book.previewPages = pages.map((page, position) => ({ ...page, sortOrder: position }));

  saveBooks(books);
  notifyChange();
}
