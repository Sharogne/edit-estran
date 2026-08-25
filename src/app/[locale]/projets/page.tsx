import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import type { Locale } from "@/i18n/routing";
import { getPublishedBooks } from "@/lib/books";
import { Container } from "@/components/ui/Container";
import { BookCard } from "@/components/site/BookCard";

// Rendered per request rather than frozen at build time: the content lives in an
// in-memory JSON store, so a render costs a lookup and no I/O — while a
// build-time prerender would resurface the catalogue as it was at build after
// any restart not preceded by a rebuild (crash, reboot, plain pm2 restart).
export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: PageProps<"/[locale]/projets">): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "projects" });
  return {
    title: t("metaTitle"),
    description: t("metaDescription"),
    alternates: {
      canonical: `/${locale}/projets`,
      languages: { fr: "/fr/projets", en: "/en/projets" },
    },
  };
}

export default async function ProjectsPage({ params }: PageProps<"/[locale]/projets">) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("projects");
  const books = await getPublishedBooks(locale as Locale);

  return (
    <main>
      <Container className="py-16 sm:py-20">
        <h1 className="font-display text-3xl tracking-tight sm:text-4xl" data-cy="projects-title">
          {t("title")}
        </h1>
        <p className="mt-4 max-w-2xl text-ink-muted">{t("intro")}</p>

        {books.length === 0 ? (
          <p className="mt-16 text-ink-muted" data-cy="projects-empty">
            {t("empty")}
          </p>
        ) : (
          <div
            className="mt-12 grid grid-cols-2 gap-x-6 gap-y-12 md:grid-cols-3"
            data-cy="projects-grid"
          >
            {books.map((book) => (
              <BookCard key={book.id} book={book} locale={locale} />
            ))}
          </div>
        )}
      </Container>
    </main>
  );
}
