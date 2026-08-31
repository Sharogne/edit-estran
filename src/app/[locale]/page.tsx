import { hasLocale } from "next-intl";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { notFound } from "next/navigation";
import { Link } from "@/i18n/navigation";
import { routing, type Locale } from "@/i18n/routing";
import { getLatestPublishedBooks } from "@/lib/books";
import { Container } from "@/components/ui/Container";
import { Button } from "@/components/ui/Button";
import { BookCard } from "@/components/site/BookCard";

// Rendered per request rather than frozen at build time: the content lives in an
// in-memory JSON store, so a render costs a lookup and no I/O — while a
// build-time prerender would resurface the catalogue as it was at build after
// any restart not preceded by a rebuild (crash, reboot, plain pm2 restart).
export const dynamic = "force-dynamic";

export default async function HomePage({ params }: PageProps<"/[locale]">) {
  const { locale } = await params;
  // Le layout valide déjà la locale, mais la page se rend en parallèle : sans
  // ce garde elle atteint Intl.DateTimeFormat avec une étiquette de langue
  // invalide (/e, /a-b-c) et lève une RangeError à chaque requête. Le statut
  // restait 404 pour le visiteur, mais chaque robot inondait les logs.
  if (!hasLocale(routing.locales, locale)) notFound();
  setRequestLocale(locale);
  const t = await getTranslations("home");
  const latest = await getLatestPublishedBooks(locale as Locale, 3);

  return (
    <main>
      {/* Hero */}
      <section className="border-b border-line bg-surface" data-cy="home-hero">
        <Container className="py-20 sm:py-28">
          <h1
            className="font-display max-w-3xl text-4xl leading-tight tracking-tight sm:text-5xl"
            data-cy="home-title"
          >
            {t("heroTitle")}
          </h1>
          <p className="mt-6 max-w-2xl text-lg leading-relaxed text-ink-muted">{t("heroText")}</p>
          <div className="mt-10">
            <Button as={Link} href="/projets" data-cy="home-cta">
              {t("heroCta")}
            </Button>
          </div>
        </Container>
      </section>

      {/* La maison */}
      <section data-cy="home-about">
        <Container className="grid gap-8 py-16 sm:py-20 md:grid-cols-[220px_1fr]">
          <h2 className="font-display text-2xl">{t("aboutTitle")}</h2>
          <div className="max-w-2xl space-y-5 leading-relaxed text-ink-muted">
            <p>{t("aboutP1")}</p>
            <p>{t("aboutP2")}</p>
          </div>
        </Container>
      </section>

      {/* Dernières parutions */}
      {latest.length > 0 && (
        <section className="border-t border-line" data-cy="home-latest">
          <Container className="py-16 sm:py-20">
            <div className="flex items-baseline justify-between gap-4">
              <h2 className="font-display text-2xl">{t("latestTitle")}</h2>
              <Link
                href="/projets"
                data-cy="home-all-projects"
                className="text-sm text-accent-deep underline decoration-line underline-offset-4 transition-colors hover:decoration-accent"
              >
                {t("allProjects")}
              </Link>
            </div>
            <div className="mt-10 grid grid-cols-2 gap-x-6 gap-y-12 md:grid-cols-3">
              {latest.map((book) => (
                <BookCard key={book.id} book={book} locale={locale} />
              ))}
            </div>
          </Container>
        </section>
      )}
    </main>
  );
}
