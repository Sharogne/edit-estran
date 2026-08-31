"use client";

import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { Container } from "@/components/ui/Container";
import { Button } from "@/components/ui/Button";

/**
 * Filet du site public.
 *
 * Le cas concret : `content.json` illisible — tronqué par un disque plein, ou
 * restauré depuis une sauvegarde d'une autre version. Le store lève alors
 * volontairement, plutôt que de servir un catalogue vide qui ferait croire à
 * une perte de données. Sans cette page, chaque URL publique répondait 500 nu.
 *
 * Cette frontière remplace les enfants du layout, pas le layout lui-même : le
 * NextIntlClientProvider reste au-dessus, donc les traductions fonctionnent.
 */
export default function PublicError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const t = useTranslations("error");

  return (
    <main>
      <Container className="py-24 text-center sm:py-32">
        <p className="font-display text-7xl text-line">!</p>
        <h1 className="font-display mt-6 text-3xl" data-cy="error-title">
          {t("title")}
        </h1>
        <p className="mx-auto mt-4 max-w-xl text-ink-muted">{t("text")}</p>
        {error.digest && <p className="mt-4 font-mono text-xs text-ink-muted">{error.digest}</p>}
        <div className="mt-10 flex flex-wrap items-center justify-center gap-3">
          <Button type="button" onClick={reset} data-cy="error-retry">
            {t("retry")}
          </Button>
          <Button as={Link} href="/" variant="ghost" data-cy="error-home">
            {t("backHome")}
          </Button>
        </div>
      </Container>
    </main>
  );
}
