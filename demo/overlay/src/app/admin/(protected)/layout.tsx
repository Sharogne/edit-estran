"use client";

// STATIC DEMO BUILD — replaces the requireAdmin() server guard by a client-side
// check. This is a mock: it keeps the demo coherent, it protects nothing.

import { useEffect, useState } from "react";
import Link from "next/link";
import { isLoggedIn } from "@/lib/demo-data";
import { logout } from "@/app/admin/login/actions";
import { siteConfig } from "@/config/site";
import { Container } from "@/components/ui/Container";

export default function ProtectedAdminLayout({ children }: { children: React.ReactNode }) {
  const [allowed, setAllowed] = useState<boolean | null>(null);

  useEffect(() => {
    if (isLoggedIn()) {
      setAllowed(true);
    } else {
      window.location.replace(`${process.env.NEXT_PUBLIC_BASE_PATH ?? ""}/admin/login/`);
    }
  }, []);

  // Pre-rendered HTML and the redirect frame both render nothing.
  if (!allowed) return null;

  return (
    <>
      <p
        className="bg-ink px-4 py-2 text-center text-xs text-paper"
        data-cy="admin-demo-banner"
      >
        Démonstration — les données sont fictives et vivent dans votre navigateur. Rien n&apos;est
        envoyé à un serveur.
      </p>
      <header className="border-b border-line bg-surface">
        <Container className="flex items-center justify-between py-4">
          <div className="flex items-center gap-6">
            <Link href="/admin" data-cy="admin-home" className="font-display text-lg">
              {siteConfig.name} <span className="text-ink-muted">— Administration</span>
            </Link>
            <Link
              href="/fr"
              className="text-sm text-ink-muted underline decoration-line underline-offset-4 hover:text-ink"
              data-cy="admin-view-site"
            >
              Voir le site
            </Link>
          </div>
          <form action={logout}>
            <button
              type="submit"
              data-cy="admin-logout"
              className="text-sm text-ink-muted transition-colors hover:text-ink"
            >
              Se déconnecter
            </button>
          </form>
        </Container>
      </header>
      <div className="flex-1">{children}</div>
    </>
  );
}
