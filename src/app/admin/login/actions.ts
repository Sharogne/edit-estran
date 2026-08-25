"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import bcrypt from "bcryptjs";
import { getSession } from "@/lib/session";

export type LoginState = { error?: string };

const loginSchema = z.object({
  email: z.string().trim().toLowerCase().min(1),
  password: z.string().min(1),
});

const INVALID_CREDENTIALS = "Identifiants invalides.";

// A bcrypt hash of a random string nobody holds. Comparing against it when the
// email is unknown keeps the response time identical either way — bcrypt is the
// expensive part, so returning early would leak which address is the admin one.
// Not a secret: its only job is to burn the same CPU.
const DUMMY_HASH = "$2b$12$sbKLN28B92K1HzpDvOjE8erhSweHFJ0v5lH1fQF6mPFjkaOrXpHNO";

/**
 * The single admin account, read from the environment (no database, no user table).
 *
 * The hash is stored base64-encoded: a bcrypt hash is full of "$", and the env
 * loaders expand "$name" — @next/env re-expands even the values dotenv-cli has
 * already resolved, which silently truncates the hash. Base64 has no "$".
 */
function adminCredentials(): { email: string; passwordHash: string } {
  const email = process.env.ADMIN_EMAIL?.trim().toLowerCase();
  const encoded = process.env.ADMIN_PASSWORD_HASH_B64;
  if (!email || !encoded) {
    throw new Error(
      "ADMIN_EMAIL and ADMIN_PASSWORD_HASH_B64 must be set (see .env.example). " +
        'Generate the value with: node scripts/hash-password.mjs "<password>"'
    );
  }

  const passwordHash = Buffer.from(encoded, "base64").toString("utf8");
  if (!passwordHash.startsWith("$2")) {
    throw new Error(
      "ADMIN_PASSWORD_HASH_B64 does not decode to a bcrypt hash. It must be the " +
        'base64 output of: node scripts/hash-password.mjs "<password>"'
    );
  }
  return { email, passwordHash };
}

export async function login(_prevState: LoginState, formData: FormData): Promise<LoginState> {
  const parsed = loginSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
  });
  if (!parsed.success) {
    return { error: INVALID_CREDENTIALS };
  }

  const admin = adminCredentials();
  const emailMatches = parsed.data.email === admin.email;
  const passwordMatches = await bcrypt.compare(
    parsed.data.password,
    emailMatches ? admin.passwordHash : DUMMY_HASH
  );
  // Same error whether the address is wrong or the password is (no enumeration).
  if (!emailMatches || !passwordMatches) {
    return { error: INVALID_CREDENTIALS };
  }

  const session = await getSession();
  session.adminId = admin.email;
  await session.save();
  redirect("/admin");
}

export async function logout(): Promise<void> {
  const session = await getSession();
  session.destroy();
  redirect("/admin/login");
}
