"use client";

// STATIC DEMO BUILD — no server session to read, so the "already logged in"
// redirect happens client-side after mount.

import { useEffect } from "react";
import { isLoggedIn } from "@/lib/demo-data";
import { siteConfig } from "@/config/site";
import { LoginForm } from "@/components/admin/LoginForm";

export default function LoginPage() {
  useEffect(() => {
    if (isLoggedIn()) {
      window.location.replace(`${process.env.NEXT_PUBLIC_BASE_PATH ?? ""}/admin/`);
    }
  }, []);

  return (
    <main className="flex flex-1 items-center justify-center py-16">
      <div className="w-full max-w-sm px-5">
        <h1 className="font-display text-2xl" data-cy="login-title">
          Administration
        </h1>
        <p className="mt-2 text-sm text-ink-muted">{siteConfig.name} — accès réservé.</p>
        <LoginForm />
      </div>
    </main>
  );
}
