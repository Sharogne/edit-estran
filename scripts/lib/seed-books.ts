import { BACK_COVER, COVER_FULL, COVER_THUMB, processImageBuffer } from "../../src/lib/images";
import type { StoredBook } from "../../src/lib/content-types";
import {
  backCoverArtwork,
  coverArtwork,
  palettes,
  photoArtwork,
  type CoverPalette,
} from "./placeholder-images";

export type BookSeedDef = {
  slug: string;
  status: "draft" | "published";
  publishedAt: Date | null;
  sortOrder: number;
  palette: CoverPalette;
  hasBackCover: boolean;
  /** Lien marchand facultatif — absent sur la plupart des livres. */
  purchaseUrl?: string;
  /**
   * When set, the artwork is photo-like instead of flat SVG (performance seed).
   * Flat geometry compresses ~15x better than a photograph, so a perf run on it
   * would flatter the numbers and hide the very regression the test looks for.
   */
  photoSeed?: number;
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
  const photo = def.photoSeed !== undefined;
  const cover = photo ? await photoArtwork(def.photoSeed!, "front") : coverArtwork(def.palette);
  const back = !def.hasBackCover
    ? null
    : photo
      ? await photoArtwork(def.photoSeed!, "back")
      : backCoverArtwork(def.palette);
  const now = new Date().toISOString();

  return {
    id: `seed-${def.slug}`,
    slug: def.slug,
    status: def.status,
    coverThumb: await processImageBuffer(cover, COVER_THUMB),
    coverImage: await processImageBuffer(cover, COVER_FULL),
    backCoverImage: back ? await processImageBuffer(back, BACK_COVER) : null,
    publishedAt: def.publishedAt ? def.publishedAt.toISOString() : null,
    sortOrder: def.sortOrder,
    purchaseUrl: def.purchaseUrl ?? null,
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
    purchaseUrl: "https://exemple-librairie.test/les-jardins-suspendus",
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

/**
 * A catalogue of `count` published books with photograph-weight images, used
 * only by the performance seed (`npm run seed -- --bulk=N`). Slugs are
 * zero-padded so the order stays stable, and sit after the demo books.
 */
export function perfBooks(count: number): BookSeedDef[] {
  const paletteList = Object.values(palettes);
  return Array.from({ length: count }, (_, index) => {
    const n = String(index + 1).padStart(3, "0");
    return {
      slug: `perf-livre-${n}`,
      status: "published" as const,
      publishedAt: new Date(Date.UTC(2020 + (index % 6), index % 12, (index % 27) + 1)),
      sortOrder: 100 + index,
      palette: paletteList[index % paletteList.length],
      hasBackCover: true,
      photoSeed: index + 1,
      fr: {
        title: `Livre de charge ${n}`,
        synopsis:
          "Ouvrage généré pour mesurer la tenue du catalogue à grande échelle. Le texte " +
          "reprend une longueur réaliste de quatrième de couverture, afin que le poids du " +
          "HTML mesuré ne soit pas seulement celui des images mais aussi celui des contenus " +
          `rédactionnels qui l'accompagnent sur la page de liste comme sur la fiche. (${n})`,
      },
      en: {
        title: `Load Test Book ${n}`,
        synopsis:
          "A generated title used to measure how the catalogue holds up at scale. The text " +
          "keeps a realistic blurb length so the measured HTML weight reflects prose as well " +
          `as imagery, on the list page and on the book page alike. (${n})`,
      },
    };
  });
}
