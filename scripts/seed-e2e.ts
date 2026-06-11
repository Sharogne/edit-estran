import "dotenv/config";
import fs from "node:fs/promises";
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";
import { demoBooks, seedBook } from "./lib/seed-books";
import { uploadsRoot } from "../src/lib/uploads";

// e2e seed — runs under .env.test (dedicated test.db + test-uploads dir).
// FULL wipe then deterministic data: the Cypress specs rely on exactly this state:
//   published: les-jardins-suspendus, cartographie-du-silence — draft: manuscrit-inacheve
const prisma = new PrismaClient();

async function main() {
  const dbUrl = process.env.DATABASE_URL ?? "";
  if (!dbUrl.includes("test")) {
    throw new Error(
      `Refusing to run the e2e seed against a non-test database (DATABASE_URL=${dbUrl}). ` +
        "Run through: npm run e2e:seed"
    );
  }

  await prisma.$queryRawUnsafe("PRAGMA journal_mode=WAL;");

  // Clean slate: data AND uploaded files.
  await prisma.book.deleteMany({});
  await prisma.adminUser.deleteMany({});
  await fs.rm(uploadsRoot(), { recursive: true, force: true });

  const email = process.env.ADMIN_EMAIL;
  const password = process.env.ADMIN_PASSWORD;
  if (!email || !password) {
    throw new Error("ADMIN_EMAIL and ADMIN_PASSWORD must be set (see .env.test)");
  }
  await prisma.adminUser.create({
    data: { email, passwordHash: await bcrypt.hash(password, 10) },
  });

  // First three books only: 2 published + 1 draft, deterministic slugs.
  for (const def of demoBooks.slice(0, 3)) {
    await seedBook(prisma, def);
  }

  console.log("e2e seed done: 2 published + 1 draft + test admin");
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
