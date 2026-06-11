import { requireAdmin } from "@/lib/session";
import { siteConfig } from "@/config/site";
import { Container } from "@/components/ui/Container";
import { logout } from "@/app/admin/login/actions";
import Link from "next/link";

export default async function ProtectedAdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  await requireAdmin();

  return (
    <>
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
