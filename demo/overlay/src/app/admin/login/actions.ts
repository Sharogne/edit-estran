"use client";

// STATIC DEMO BUILD — replaces the iron-session + bcrypt server actions.
// The credentials are public on purpose (see the hint on the login form):
// there is no database and no private data behind them.

import { DEMO_LOGIN, DEMO_PASSWORD, setLoggedIn } from "@/lib/demo-data";

export type LoginState = { error?: string };

const INVALID_CREDENTIALS = "Identifiants invalides.";

function basePath(): string {
  return process.env.NEXT_PUBLIC_BASE_PATH ?? "";
}

export async function login(_prevState: LoginState, formData: FormData): Promise<LoginState> {
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const password = String(formData.get("password") ?? "");

  if (email !== DEMO_LOGIN || password !== DEMO_PASSWORD) {
    return { error: INVALID_CREDENTIALS };
  }

  setLoggedIn(true);
  window.location.assign(`${basePath()}/admin/`);
  return {};
}

export async function logout(): Promise<void> {
  setLoggedIn(false);
  window.location.assign(`${basePath()}/admin/login/`);
}
