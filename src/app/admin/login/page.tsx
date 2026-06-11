import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/session";
import { siteConfig } from "@/config/site";
import { LoginForm } from "@/components/admin/LoginForm";

export const metadata: Metadata = {
  title: `Connexion — Administration ${siteConfig.name}`,
  robots: { index: false },
};

export default async function LoginPage() {
  const session = await getSession();
  if (session.adminId) {
    redirect("/admin");
  }

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
