import { BACK_COVER, COVER_FULL, COVER_THUMB, processImageBuffer } from "../../src/lib/images";
import type { StoredBook } from "../../src/lib/content-types";
import { backCoverArtwork, coverArtwork, type CoverPalette } from "./placeholder-images";

export type BookSeedDef = {
  slug: string;
  status: "draft" | "published";
  publishedAt: Date | null;
  sortOrder: number;
  palette: CoverPalette;
  hasBackCover: boolean;
  fr: { title: string; synopsis: string };
  en: { title: string; synopsis: string };
};

/**
 * Builds one complete stored book, images included.
 * The id is derived from the slug so a re-seed produces the same entry (and the
 * same /admin/livres/<id> URLs the e2e specs navigate to), and the artwork runs
 * through the very same encoder the back office uses for real uploads.
 */
export async function buildStoredBook(def: BookSeedDef): Promise<StoredBook> {
  const cover = coverArtwork(def.palette);
  const now = new Date().toISOString();

  return {
    id: `seed-${def.slug}`,
    slug: def.slug,
    status: def.status,
    coverThumb: await processImageBuffer(cover, COVER_THUMB),
    coverImage: await processImageBuffer(cover, COVER_FULL),
    backCoverImage: def.hasBackCover
      ? await processImageBuffer(backCoverArtwork(def.palette), BACK_COVER)
      : null,
    publishedAt: def.publishedAt ? def.publishedAt.toISOString() : null,
    sortOrder: def.sortOrder,
    createdAt: now,
    updatedAt: now,
    translations: { fr: def.fr, en: def.en },
  };
}

/** Shared demo catalogue — e2e uses the first three (deterministic), dev seeds all. */
export const demoBooks: BookSeedDef[] = [
  {
    slug: "les-jardins-suspendus",
    status: "published",
    publishedAt: new Date("2025-03-14"),
    sortOrder: 1,
    palette: { bg: "#1f3a2d", band: "#e9e2d0", accent: "#c47a4a" },
    hasBackCover: true,
    fr: {
      title: "Les Jardins suspendus",
      synopsis:
        "Dans une ville portuaire rongée par le sel, une botaniste découvre un jardin qui ne figure sur aucun plan. Premier roman d'une précision rare, Les Jardins suspendus explore ce que l'on cultive quand tout semble perdu — la mémoire, l'attente, et l'obstination des choses vivantes.",
    },
    en: {
      title: "The Hanging Gardens",
      synopsis:
        "In a port city eaten away by salt, a botanist discovers a garden that appears on no map. A debut novel of rare precision, The Hanging Gardens explores what we cultivate when all seems lost — memory, waiting, and the stubbornness of living things.",
    },
  },
  {
    slug: "cartographie-du-silence",
    status: "published",
    publishedAt: new Date("2025-10-03"),
    sortOrder: 2,
    palette: { bg: "#2c3e50", band: "#ecf0f1", accent: "#e2b04a" },
    hasBackCover: true,
    fr: {
      title: "Cartographie du silence",
      synopsis:
        "Récit d'une traversée à pied des Cévennes en hiver, Cartographie du silence est une méditation sur la disparition des sons — ceux des bêtes, des cloches, des langues. Un texte bref, taillé comme une pierre, qui fait entendre ce qui s'efface.",
    },
    en: {
      title: "A Cartography of Silence",
      synopsis:
        "An account of a winter crossing of the Cévennes on foot, A Cartography of Silence is a meditation on vanishing sounds — of animals, bells, languages. A brief text, cut like stone, that lets us hear what is fading away.",
    },
  },
  {
    slug: "manuscrit-inacheve",
    status: "draft",
    publishedAt: null,
    sortOrder: 3,
    palette: { bg: "#8a8276", band: "#f4f1ea", accent: "#42594e" },
    hasBackCover: false,
    fr: {
      title: "Manuscrit inachevé",
      synopsis:
        "Un éditeur reçoit par la poste les chapitres d'un roman dont l'auteur affirme qu'il n'existe pas. À paraître.",
    },
    en: {
      title: "Unfinished Manuscript",
      synopsis:
        "A publisher receives by mail the chapters of a novel whose author claims it does not exist. Forthcoming.",
    },
  },
  {
    slug: "l-heure-bleue",
    status: "published",
    publishedAt: new Date("2026-01-22"),
    sortOrder: 4,
    palette: { bg: "#3b3a5d", band: "#efe9e1", accent: "#b85c6e" },
    hasBackCover: true,
    fr: {
      title: "L'Heure bleue",
      synopsis:
        "Sept nouvelles qui se déroulent toutes à la même heure — celle où la nuit hésite encore. Des personnages au bord d'une décision, saisis dans cette lumière brève où tout peut basculer. L'Heure bleue confirme une voix singulière de la nouvelle contemporaine.",
    },
    en: {
      title: "The Blue Hour",
      synopsis:
        "Seven stories all set at the same hour — when night still hesitates. Characters on the edge of a decision, caught in that brief light where everything can tip over. The Blue Hour confirms a singular voice in the contemporary short story.",
    },
  },
];
