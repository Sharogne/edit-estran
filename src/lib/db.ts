import { PrismaClient } from "@prisma/client";

// Singleton: avoids exhausting SQLite connections on dev hot-reload.
// WAL journal mode is a persistent property of the .db file, enabled once by the seeds.
const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

export const prisma = globalForPrisma.prisma ?? new PrismaClient();

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}
