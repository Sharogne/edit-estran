import type { Locale } from "@/i18n/routing";

// Shape of content.json — the single source of truth for the whole site.
// There is no database: texts AND images live in this one file, which makes a
// backup a plain file copy and a deploy a plain restart.
//
// Dates are ISO strings here (JSON has no Date type). books.ts converts them at
// the boundary so pages and components keep receiving real Date objects.

export type StoredTranslation = {
  title: string;
  synopsis: string;
};

export type StoredBook = {
  id: string;
  slug: string;
  status: "draft" | "published";
  /** 320px WebP data URI — list pages and back office (many per page, kept tiny). */
  coverThumb: string | null;
  /** 900px WebP data URI — front cover on the book page. */
  coverImage: string | null;
  /** 900px WebP data URI — back cover ("4e de couverture"), shown by flipping the card. */
  backCoverImage: string | null;
  /** Lien marchand externe. null tant que l'éditeur n'en a pas renseigné. */
  purchaseUrl: string | null;
  publishedAt: string | null;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
  translations: Record<Locale, StoredTranslation>;
};

export type ContentFile = {
  version: 1;
  books: StoredBook[];
};

export const CONTENT_VERSION = 1;

export function emptyContent(): ContentFile {
  return { version: CONTENT_VERSION, books: [] };
}
