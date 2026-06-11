import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";
import { demoBooks, seedBook } from "../scripts/lib/seed-books";

// Dev seed: admin account (credentials from .env) + demo catalogue.
// Idempotent: re-running refreshes the demo books, leaves other books untouched.
const prisma = new PrismaClient();

async function main() {
  // WAL is a persistent property of the db file — enabling it here covers the app too.
  await prisma.$queryRawUnsafe("PRAGMA journal_mode=WAL;");

  const email = process.env.ADMIN_EMAIL;
  const password = process.env.ADMIN_PASSWORD;
  if (!email || !password) {
    throw new Error("ADMIN_EMAIL and ADMIN_PASSWORD must be set in .env (see .env.example)");
  }

  const passwordHash = await bcrypt.hash(password, 12);
  await prisma.adminUser.upsert({
    where: { email },
    update: { passwordHash },
    create: { email, passwordHash },
  });
  console.log(`Admin user ready: ${email}`);

  for (const def of demoBooks) {
    await seedBook(prisma, def);
    console.log(`Seeded book: ${def.slug} (${def.status})`);
  }
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
