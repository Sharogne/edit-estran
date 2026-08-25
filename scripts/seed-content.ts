import "dotenv/config";
import fs from "node:fs/promises";
import path from "node:path";
import { buildStoredBook, demoBooks, perfBooks } from "./lib/seed-books";
import { emptyContent, type ContentFile } from "../src/lib/content-types";

// There is no database, so seeding is just "write content.json".
// CONTENT_FILE picks the target (.env for dev, .env.test for Cypress).
//
//   npm run seed        dev: refresh the demo catalogue, leave other books alone
//   npm run e2e:seed    e2e: full wipe, deterministic — 2 published + 1 draft
//   npm run perf:seed   e2e file + 50 books with photograph-weight images
//
// The admin account is NOT seeded: it lives in ADMIN_EMAIL / ADMIN_PASSWORD_HASH_B64.

async function readExisting(target: string): Promise<ContentFile> {
  try {
    return JSON.parse(await fs.readFile(target, "utf8")) as ContentFile;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return emptyContent();
    throw error;
  }
}

async function main() {
  const e2e = process.argv.includes("--e2e");
  const target = path.resolve(process.cwd(), process.env.CONTENT_FILE ?? "./data/content.json");

  if (e2e && !target.includes("test")) {
    throw new Error(
      `Refusing to run the e2e seed against a non-test content file (${target}). ` +
        "Run through: npm run e2e:seed"
    );
  }

  const bulkArg = process.argv.find((arg) => arg.startsWith("--bulk="));
  const bulk = bulkArg ? Number.parseInt(bulkArg.slice("--bulk=".length), 10) : 0;
  if (bulkArg && (!Number.isInteger(bulk) || bulk < 1 || bulk > 500)) {
    throw new Error(`--bulk expects an integer between 1 and 500 (got "${bulkArg}")`);
  }

  const defs = [...(e2e ? demoBooks.slice(0, 3) : demoBooks), ...(bulk ? perfBooks(bulk) : [])];

  // Sequential on purpose: each book runs several sharp pipelines over a
  // ~1.5 MB raster, and 50 of them in parallel would spike memory for no gain.
  const seeded = [];
  for (const [index, def] of defs.entries()) {
    seeded.push(await buildStoredBook(def));
    if (bulk && (index + 1) % 10 === 0) {
      console.log(`  … ${index + 1}/${defs.length} livres encodés`);
    }
  }

  const content = e2e ? emptyContent() : await readExisting(target);
  const seededSlugs = new Set(seeded.map((book) => book.slug));
  content.books = [...content.books.filter((book) => !seededSlugs.has(book.slug)), ...seeded];

  await fs.mkdir(path.dirname(target), { recursive: true });
  await fs.writeFile(target, JSON.stringify(content, null, 2), "utf8");

  const bytes = (await fs.stat(target)).size;
  const published = content.books.filter((book) => book.status === "published").length;
  console.log(
    `Seeded ${seeded.length} book(s) into ${target} ` +
      `(${content.books.length} total, ${published} published, ${(bytes / 1024).toFixed(0)} KB)`
  );
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
