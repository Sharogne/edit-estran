// STATIC DEMO BUILD — replaces the Prisma-backed src/lib/books.ts.
// Same public API and types, but reads the fixed catalogue from demo-data.ts so
// the public pages can be pre-rendered without a database. See demo/README.md.

import type { Locale } from "@/i18n/routing";
import { seedBooks, pickTranslation, type DemoBook } from "@/lib/demo-data";

export type PublicBook = {
  id: string;
  slug: string;
  coverImage: string | null;
  publishedAt: Date | null;
  title: string;
  synopsis: string;
};

export type PublicBookDetail = PublicBook & {
  previewPages: { id: string; imagePath: string; sortOrder: number }[];
};

function toPublic(book: DemoBook, locale: Locale): PublicBook {
  const t = pickTranslation(book, locale);
  return {
    id: book.id,
    slug: book.slug,
    coverImage: book.coverImage,
    publishedAt: book.publishedAt ? new Date(book.publishedAt) : null,
    title: t?.title ?? book.slug,
    synopsis: t?.synopsis ?? "",
  };
}

function published(): DemoBook[] {
  return seedBooks
    .filter((book) => book.status === "published")
    .sort(
      (a, b) =>
        a.sortOrder - b.sortOrder ||
        (b.publishedAt ?? "").localeCompare(a.publishedAt ?? "")
    );
}

export async function getPublishedBooks(locale: Locale): Promise<PublicBook[]> {
  return published().map((book) => toPublic(book, locale));
}

export async function getLatestPublishedBooks(locale: Locale, count: number) {
  const books = await getPublishedBooks(locale);
  return [...books]
    .sort((a, b) => (b.publishedAt?.getTime() ?? 0) - (a.publishedAt?.getTime() ?? 0))
    .slice(0, count);
}

export async function getPublishedBookBySlug(
  slug: string,
  locale: Locale
): Promise<PublicBookDetail | null> {
  const book = published().find((b) => b.slug === slug);
  if (!book) return null;
  return {
    ...toPublic(book, locale),
    previewPages: [...book.previewPages].sort((a, b) => a.sortOrder - b.sortOrder),
  };
}

export async function getPublishedSlugs(): Promise<string[]> {
  return published().map((book) => book.slug);
}
