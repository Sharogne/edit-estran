import { readContent } from "@/lib/store";
import { aDejaEtePublie, type StoredBook, type StoredTranslation } from "@/lib/content-types";
import { routing, type Locale } from "@/i18n/routing";

// All book reads go through this module (never touch the store from pages/components).
// The store keeps dates as ISO strings; they are turned back into Date objects here
// so callers keep working with real dates.

export type PublicBook = {
  id: string;
  slug: string;
  /** Small variant — these types are only ever rendered in list layouts. */
  coverThumb: string | null;
  publishedAt: Date | null;
  title: string;
  synopsis: string;
};

export type PublicBookDetail = PublicBook & {
  coverImage: string | null;
  backCoverImage: string | null;
  purchaseUrl: string | null;
};

export type AdminBook = {
  id: string;
  slug: string;
  status: "draft" | "published";
  publishedAt: Date | null;
  /** Adresse publique définitivement figée (le livre a déjà été public). */
  urlFigee: boolean;
  sortOrder: number;
  coverThumb: string | null;
  backCoverImage: string | null;
  purchaseUrl: string | null;
  translations: Record<Locale, StoredTranslation>;
};

/**
 * Resolves one translated field, falling back across locales.
 *
 * A locale can legitimately be left empty in the back office: the editor may
 * publish a book before its translation exists. The fallback is per FIELD, not
 * per locale, so a translated title with an untranslated synopsis works too.
 * Nothing is duplicated at write time — the store keeps what was actually
 * typed, and filling the translation later just starts showing it.
 */
function resolveField(
  book: StoredBook,
  locale: Locale,
  field: keyof StoredTranslation
): string | undefined {
  const ordre: Locale[] = [
    locale,
    routing.defaultLocale,
    ...routing.locales.filter((autre) => autre !== locale && autre !== routing.defaultLocale),
  ];
  for (const candidat of ordre) {
    const valeur = book.translations[candidat]?.[field]?.trim();
    if (valeur) return valeur;
  }
  return undefined;
}

function toDate(iso: string | null): Date | null {
  return iso ? new Date(iso) : null;
}

function time(iso: string | null): number {
  return iso ? new Date(iso).getTime() : 0;
}

/** Catalogue order: explicit sortOrder first, most recent publication as tie-break. */
function byCatalogueOrder(a: StoredBook, b: StoredBook): number {
  return a.sortOrder - b.sortOrder || time(b.publishedAt) - time(a.publishedAt);
}

function isPublished(book: StoredBook): boolean {
  return book.status === "published";
}

function toPublicBook(book: StoredBook, locale: Locale): PublicBook {
  return {
    id: book.id,
    slug: book.slug,
    coverThumb: book.coverThumb,
    publishedAt: toDate(book.publishedAt),
    title: resolveField(book, locale, "title") ?? book.slug,
    synopsis: resolveField(book, locale, "synopsis") ?? "",
  };
}

export async function getPublishedBooks(locale: Locale): Promise<PublicBook[]> {
  const { books } = await readContent();
  return books
    .filter(isPublished)
    .sort(byCatalogueOrder)
    .map((book) => toPublicBook(book, locale));
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
  const { books } = await readContent();
  const book = books.find((candidate) => candidate.slug === slug && isPublished(candidate));
  if (!book) return null;
  return {
    ...toPublicBook(book, locale),
    coverImage: book.coverImage,
    backCoverImage: book.backCoverImage,
    purchaseUrl: book.purchaseUrl ?? null,
  };
}

/** Slugs of all published books (sitemap + static params). */
export async function getPublishedSlugs(): Promise<string[]> {
  const { books } = await readContent();
  return books.filter(isPublished).map((book) => book.slug);
}

// --- Admin queries (back office only — callers must have passed requireAdmin) ---

export async function getAllBooksForAdmin() {
  const { books } = await readContent();
  return [...books]
    .sort((a, b) => a.sortOrder - b.sortOrder || time(b.updatedAt) - time(a.updatedAt))
    .map((book) => ({
      id: book.id,
      slug: book.slug,
      status: book.status,
      publishedAt: toDate(book.publishedAt),
      updatedAt: new Date(book.updatedAt),
      coverThumb: book.coverThumb,
      title: resolveField(book, routing.defaultLocale, "title") ?? book.slug,
    }));
}

export async function getBookForAdmin(id: string): Promise<AdminBook | null> {
  const { books } = await readContent();
  const book = books.find((candidate) => candidate.id === id);
  if (!book) return null;
  return {
    id: book.id,
    slug: book.slug,
    status: book.status,
    publishedAt: toDate(book.publishedAt),
    // Normalisé ici, une fois : les pages n'ont pas à connaître le repli.
    urlFigee: aDejaEtePublie(book),
    sortOrder: book.sortOrder,
    coverThumb: book.coverThumb,
    backCoverImage: book.backCoverImage,
    purchaseUrl: book.purchaseUrl ?? null,
    translations: book.translations,
  };
}
