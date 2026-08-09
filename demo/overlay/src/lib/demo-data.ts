// STATIC DEMO ONLY — this file replaces nothing; it is the data source of the
// GitHub Pages build (no database, no server). See demo/README.md.
//
// The public pages read `seedBooks` at BUILD time (they are pre-rendered HTML).
// The mock back office reads/writes the same shape in localStorage at RUNTIME.

export type DemoTranslation = { locale: "fr" | "en"; title: string; synopsis: string };
export type DemoPreview = { id: string; imagePath: string; sortOrder: number };

export type DemoBook = {
  id: string;
  slug: string;
  status: "draft" | "published";
  publishedAt: string | null; // ISO date, "YYYY-MM-DD"
  sortOrder: number;
  coverImage: string | null; // path under /uploads/, or a data: URL for demo uploads
  updatedAt: string; // ISO date-time
  translations: DemoTranslation[];
  previewPages: DemoPreview[];
};

/**
 * Catalogue of the demo. Ids are slug-derived (not cuids) so the generated
 * artwork under public/uploads/books/<id>/ stays reproducible across builds.
 * Content mirrors scripts/lib/seed-books.ts — the real dev seed.
 */
export const seedBooks: DemoBook[] = [
  {
    id: "demo-les-jardins-suspendus",
    slug: "les-jardins-suspendus",
    status: "published",
    publishedAt: "2025-03-14",
    sortOrder: 1,
    coverImage: "books/demo-les-jardins-suspendus/cover.webp",
    updatedAt: "2025-03-14T10:00:00.000Z",
    translations: [
      {
        locale: "fr",
        title: "Les Jardins suspendus",
        synopsis:
          "Dans une ville portuaire rongée par le sel, une botaniste découvre un jardin qui ne figure sur aucun plan. Premier roman d'une précision rare, Les Jardins suspendus explore ce que l'on cultive quand tout semble perdu — la mémoire, l'attente, et l'obstination des choses vivantes.",
      },
      {
        locale: "en",
        title: "The Hanging Gardens",
        synopsis:
          "In a port city eaten away by salt, a botanist discovers a garden that appears on no map. A debut novel of rare precision, The Hanging Gardens explores what we cultivate when all seems lost — memory, waiting, and the stubbornness of living things.",
      },
    ],
    previewPages: [1, 2, 3].map((n) => ({
      id: `demo-jardins-preview-${n}`,
      imagePath: `books/demo-les-jardins-suspendus/preview-${n}.webp`,
      sortOrder: n - 1,
    })),
  },
  {
    id: "demo-cartographie-du-silence",
    slug: "cartographie-du-silence",
    status: "published",
    publishedAt: "2025-10-03",
    sortOrder: 2,
    coverImage: "books/demo-cartographie-du-silence/cover.webp",
    updatedAt: "2025-10-03T10:00:00.000Z",
    translations: [
      {
        locale: "fr",
        title: "Cartographie du silence",
        synopsis:
          "Récit d'une traversée à pied des Cévennes en hiver, Cartographie du silence est une méditation sur la disparition des sons — ceux des bêtes, des cloches, des langues. Un texte bref, taillé comme une pierre, qui fait entendre ce qui s'efface.",
      },
      {
        locale: "en",
        title: "A Cartography of Silence",
        synopsis:
          "An account of a winter crossing of the Cévennes on foot, A Cartography of Silence is a meditation on vanishing sounds — of animals, bells, languages. A brief text, cut like stone, that lets us hear what is fading away.",
      },
    ],
    previewPages: [1, 2, 3].map((n) => ({
      id: `demo-cartographie-preview-${n}`,
      imagePath: `books/demo-cartographie-du-silence/preview-${n}.webp`,
      sortOrder: n - 1,
    })),
  },
  {
    id: "demo-manuscrit-inacheve",
    slug: "manuscrit-inacheve",
    status: "draft",
    publishedAt: null,
    sortOrder: 3,
    coverImage: "books/demo-manuscrit-inacheve/cover.webp",
    updatedAt: "2026-02-01T10:00:00.000Z",
    translations: [
      {
        locale: "fr",
        title: "Manuscrit inachevé",
        synopsis:
          "Un éditeur reçoit par la poste les chapitres d'un roman dont l'auteur affirme qu'il n'existe pas. À paraître.",
      },
      {
        locale: "en",
        title: "Unfinished Manuscript",
        synopsis:
          "A publisher receives by mail the chapters of a novel whose author claims it does not exist. Forthcoming.",
      },
    ],
    previewPages: [
      {
        id: "demo-manuscrit-preview-1",
        imagePath: "books/demo-manuscrit-inacheve/preview-1.webp",
        sortOrder: 0,
      },
    ],
  },
  {
    id: "demo-l-heure-bleue",
    slug: "l-heure-bleue",
    status: "published",
    publishedAt: "2026-01-22",
    sortOrder: 4,
    coverImage: "books/demo-l-heure-bleue/cover.webp",
    updatedAt: "2026-01-22T10:00:00.000Z",
    translations: [
      {
        locale: "fr",
        title: "L'Heure bleue",
        synopsis:
          "Sept nouvelles qui se déroulent toutes à la même heure — celle où la nuit hésite encore. Des personnages au bord d'une décision, saisis dans cette lumière brève où tout peut basculer. L'Heure bleue confirme une voix singulière de la nouvelle contemporaine.",
      },
      {
        locale: "en",
        title: "The Blue Hour",
        synopsis:
          "Seven stories all set at the same hour — when night still hesitates. Characters on the edge of a decision, caught in that brief light where everything can tip over. The Blue Hour confirms a singular voice in the contemporary short story.",
      },
    ],
    previewPages: [1, 2].map((n) => ({
      id: `demo-heure-bleue-preview-${n}`,
      imagePath: `books/demo-l-heure-bleue/preview-${n}.webp`,
      sortOrder: n - 1,
    })),
  },
];

// --- Runtime store (browser only) -------------------------------------------

const STORAGE_KEY = "estran-demo-books-v1";
const SESSION_KEY = "estran-demo-session-v1";

/** Demo credentials — deliberately public: they guard nothing but fake data. */
export const DEMO_LOGIN = "admin";
export const DEMO_PASSWORD = "admin";

function isBrowser(): boolean {
  return typeof window !== "undefined";
}

export function loadBooks(): DemoBook[] {
  if (!isBrowser()) return seedBooks;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return structuredClone(seedBooks);
    const parsed = JSON.parse(raw) as DemoBook[];
    return Array.isArray(parsed) ? parsed : structuredClone(seedBooks);
  } catch {
    // Corrupted or quota-blocked storage: fall back to the pristine catalogue.
    return structuredClone(seedBooks);
  }
}

export function saveBooks(books: DemoBook[]): void {
  if (!isBrowser()) return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(books));
  } catch {
    // Quota exceeded (large data: URLs) — the demo keeps working in memory
    // for the current page, changes are simply not persisted.
  }
}

export function resetBooks(): void {
  if (!isBrowser()) return;
  window.localStorage.removeItem(STORAGE_KEY);
}

export function isLoggedIn(): boolean {
  return isBrowser() && window.localStorage.getItem(SESSION_KEY) === "1";
}

export function setLoggedIn(value: boolean): void {
  if (!isBrowser()) return;
  if (value) window.localStorage.setItem(SESSION_KEY, "1");
  else window.localStorage.removeItem(SESSION_KEY);
}

export function pickTranslation(book: DemoBook, locale: string): DemoTranslation | undefined {
  return (
    book.translations.find((t) => t.locale === locale) ??
    book.translations.find((t) => t.locale === "fr") ??
    book.translations[0]
  );
}

/** Cheap unique id — cuid is a server dependency we don't want in the browser. */
export function demoId(prefix: string): string {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}
