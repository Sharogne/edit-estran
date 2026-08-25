import fs from "node:fs";
import path from "node:path";
import { defineConfig } from "cypress";
import dotenv from "dotenv";

// The suite always runs against the test environment (npm run e2e / e2e:open):
// dedicated content file (data/test-content.json), deterministic seed
// (scripts/seed-content.ts --e2e).
const testEnv = dotenv.config({ path: ".env.test" }).parsed ?? {};

function contentFile(): string {
  return path.resolve(testEnv.CONTENT_FILE ?? "./data/test-content.json");
}

type StoredBookShape = {
  id: string;
  slug: string;
  status: string;
  sortOrder: number;
  publishedAt: string | null;
  coverThumb: string | null;
  coverImage: string | null;
  backCoverImage: string | null;
  translations: Record<string, { title: string; synopsis: string }>;
};

/** Decoded size of a base64 data URI, i.e. what MAX_STORED_BYTES caps. */
function decodedBytes(dataUri: string): number {
  const payload = dataUri.slice(dataUri.indexOf(",") + 1);
  const padding = payload.endsWith("==") ? 2 : payload.endsWith("=") ? 1 : 0;
  return Math.floor((payload.length * 3) / 4) - padding;
}

/** Light-weight probe of a stored image: the data URI itself is far too big to log. */
function imageProbe(value: string | null) {
  if (!value) return null;
  return { prefix: value.slice(0, 23), bytes: decodedBytes(value) };
}

/** Flattens a messages file to dotted keys, for the FR/EN parity check. */
function flattenKeys(value: unknown, prefix = ""): string[] {
  if (typeof value !== "object" || value === null) return [prefix];
  return Object.entries(value).flatMap(([key, child]) =>
    flattenKeys(child, prefix ? `${prefix}.${key}` : key)
  );
}

function readJson<T>(file: string): T {
  return JSON.parse(fs.readFileSync(file, "utf8")) as T;
}

export default defineConfig({
  e2e: {
    baseUrl: "http://localhost:3000",
    specPattern: "cypress/e2e/**/*.cy.ts",
    supportFile: "cypress/support/e2e.ts",
    video: false,
    env: {
      ADMIN_EMAIL: testEnv.ADMIN_EMAIL ?? "admin@e2e.local",
      ADMIN_PASSWORD: testEnv.ADMIN_PASSWORD ?? "e2e-Password-123",
    },
    setupNodeEvents(on) {
      on("task", {
        /**
         * Reads one book straight out of content.json. Without a database there
         * is no other way to assert on what is actually PERSISTED (images
         * included) rather than on what a page happens to render.
         * Re-read on every call so `.should()` retries see fresh writes.
         */
        storedBook(slug: string) {
          const content = readJson<{ books: StoredBookShape[] }>(contentFile());
          const book = content.books.find((candidate) => candidate.slug === slug);
          if (!book) return null;
          return {
            id: book.id,
            slug: book.slug,
            status: book.status,
            sortOrder: book.sortOrder,
            publishedAt: book.publishedAt,
            fields: Object.keys(book).sort(),
            coverThumb: imageProbe(book.coverThumb),
            coverImage: imageProbe(book.coverImage),
            backCoverImage: imageProbe(book.backCoverImage),
            titles: {
              fr: book.translations?.fr?.title ?? null,
              en: book.translations?.en?.title ?? null,
            },
          };
        },

        /** Every slug in the store, to assert that nothing was created on error paths. */
        storedSlugs() {
          return readJson<{ books: StoredBookShape[] }>(contentFile())
            .books.map((book) => book.slug)
            .sort();
        },

        /** Dotted key lists of both message files — the FR/EN parity rule. */
        messageKeys() {
          return {
            fr: flattenKeys(readJson<unknown>("messages/fr.json")).sort(),
            en: flattenKeys(readJson<unknown>("messages/en.json")).sort(),
          };
        },
      });
    },
  },
  retries: { runMode: 1, openMode: 0 },
});
