#!/usr/bin/env node
import bcrypt from "bcryptjs";

// There is no database and no seed to create the admin account: the credentials
// live in the environment. This prints the line to paste into .env.
//
//   node scripts/hash-password.mjs "my-strong-password"
//
// The hash is base64-encoded on purpose. A bcrypt hash is full of "$", and the
// env loaders in this stack expand "$name" — @next/env even re-expands values
// that dotenv-cli already resolved, which silently eats half the hash. Base64
// has no "$", so it survives every layer identically (dev, e2e, prod).

const password = process.argv[2];
if (!password) {
  console.error('Usage: node scripts/hash-password.mjs "<password>"');
  process.exit(1);
}
if (password.length < 12) {
  console.error("Refusing to hash a password shorter than 12 characters.");
  process.exit(1);
}

const hash = await bcrypt.hash(password, 12);
console.log(`ADMIN_PASSWORD_HASH_B64="${Buffer.from(hash, "utf8").toString("base64")}"`);
