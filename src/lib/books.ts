import { prisma } from "@/lib/db";
import type { Locale } from "@/i18n/routing";

// All book reads go through this module (never call prisma from pages/components).

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

type BookWithTranslations = {
  translations: { locale: string; title: string; synopsis: string }[];
};

/** Picks the requested locale's translation, falling back to French. */
function pickTranslation(book: BookWithTranslations, locale: Locale) {
  return (
    book.translations.find((t) => t.locale === locale) ??
    book.translations.find((t) => t.locale === "fr") ??
    book.translations[0]
  );
}

const publishedWhere = { status: "published" } as const;

export async function getPublishedBooks(locale: Locale): Promise<PublicBook[]> {
  const books = await prisma.book.findMany({
    where: publishedWhere,
    orderBy: [{ sortOrder: "asc" }, { publishedAt: "desc" }],
    include: { translations: true },
  });
  return books.map((book) => {
    const t = pickTranslation(book, locale);
    return {
      id: book.id,
      slug: book.slug,
      coverImage: book.coverImage,
      publishedAt: book.publishedAt,
      title: t?.title ?? book.slug,
      synopsis: t?.synopsis ?? "",
    };
  });
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
  const book = await prisma.book.findFirst({
    where: { slug, ...publishedWhere },
    include: {
      translations: true,
      previewPages: { orderBy: { sortOrder: "asc" } },
    },
  });
  if (!book) return null;
  const t = pickTranslation(book, locale);
  return {
    id: book.id,
    slug: book.slug,
    coverImage: book.coverImage,
    publishedAt: book.publishedAt,
    title: t?.title ?? book.slug,
    synopsis: t?.synopsis ?? "",
    previewPages: book.previewPages,
  };
}

/** Slugs of all published books (sitemap + static params). */
export async function getPublishedSlugs(): Promise<string[]> {
  const books = await prisma.book.findMany({
    where: publishedWhere,
    select: { slug: true },
  });
  return books.map((b) => b.slug);
}
