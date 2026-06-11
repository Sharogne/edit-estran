"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/db";
import { getSession } from "@/lib/session";

export type LoginState = { error?: string };

const loginSchema = z.object({
  email: z.string().trim().toLowerCase().min(1),
  password: z.string().min(1),
});

const INVALID_CREDENTIALS = "Identifiants invalides.";

export async function login(_prevState: LoginState, formData: FormData): Promise<LoginState> {
  const parsed = loginSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
  });
  if (!parsed.success) {
    return { error: INVALID_CREDENTIALS };
  }

  const admin = await prisma.adminUser.findUnique({ where: { email: parsed.data.email } });
  // Same error whether the account exists or not (no account enumeration).
  if (!admin || !(await bcrypt.compare(parsed.data.password, admin.passwordHash))) {
    return { error: INVALID_CREDENTIALS };
  }

  const session = await getSession();
  session.adminId = admin.id;
  await session.save();
  redirect("/admin");
}

export async function logout(): Promise<void> {
  const session = await getSession();
  session.destroy();
  redirect("/admin/login");
}
