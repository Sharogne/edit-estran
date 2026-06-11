/**
 * Removes the DISPOSABLE e2e test database files (data/test.db*) so each e2e
 * run starts clean: `prisma migrate deploy` then rebuilds the schema exactly
 * like production would (prod-parity), and scripts/seed-e2e.ts reseeds.
 * Scoped hard to the dedicated test files — never touches app.db.
 */
const fs = require("node:fs");
const path = require("node:path");

const dataDir = path.join(__dirname, "..", "data");
fs.mkdirSync(dataDir, { recursive: true });

for (const name of ["test.db", "test.db-journal", "test.db-wal", "test.db-shm"]) {
  fs.rmSync(path.join(dataDir, name), { force: true });
}
console.log("[reset-test-db] data/test.db* removed (fresh e2e state)");
