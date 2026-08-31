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
  /**
   * Posé à la première publication, jamais retiré. C'est LUI qui fige
   * l'adresse publique, pas `publishedAt` : un retour en brouillon avec la date
   * vidée remettait ce dernier à null et rendait le titre — donc le slug —
   * modifiable, cassant en silence une URL déjà diffusée.
   *
   * Optionnel : les content.json antérieurs ne le portent pas. Ne jamais le
   * lire directement, passer par aDejaEtePublie().
   */
  dejaPublie?: boolean;
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

/**
 * Ce livre a-t-il déjà été rendu public au moins une fois ? Son adresse est
 * alors définitivement figée.
 *
 * Le repli couvre les content.json écrits avant l'ajout du drapeau : une date
 * de parution y signait un livre déjà publié. Il reste correct pour eux et
 * devient inutile dès la première réécriture du fichier.
 */
export function aDejaEtePublie(livre: Pick<StoredBook, "dejaPublie" | "publishedAt">): boolean {
  return livre.dejaPublie ?? livre.publishedAt !== null;
}
