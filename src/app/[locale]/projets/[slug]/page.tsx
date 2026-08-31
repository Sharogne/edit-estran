import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { hasLocale } from "next-intl";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { routing, type Locale } from "@/i18n/routing";
import { getPublishedBookBySlug } from "@/lib/books";
import { Container } from "@/components/ui/Container";
import { Button } from "@/components/ui/Button";
import { BookCoverFlip } from "@/components/site/BookCoverFlip";

// Rendered per request rather than frozen at build time: the content lives in an
// in-memory JSON store, so a render costs a lookup and no I/O — while a
// build-time prerender would resurface the catalogue as it was at build after
// any restart not preceded by a rebuild (crash, reboot, plain pm2 restart).
export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: PageProps<"/[locale]/projets/[slug]">): Promise<Metadata> {
  const { locale, slug } = await params;
  const book = await getPublishedBookBySlug(slug, locale as Locale);
  if (!book) return {};
  return {
    title: book.title,
    description: book.synopsis.slice(0, 160),
    alternates: {
      canonical: `/${locale}/projets/${slug}`,
      languages: { fr: `/fr/projets/${slug}`, en: `/en/projets/${slug}` },
    },
    openGraph: {
      title: book.title,
      description: book.synopsis.slice(0, 200),
      type: "book",
      // Covers are stored inline as data URIs, which crawlers cannot read — the
      // /og route decodes one back to a real image response. Plain path: it is
      // resolved against metadataBase.
      ...(book.coverImage ? { images: [{ url: `/og/${slug}` }] } : {}),
    },
  };
}

export default async function ProjectPage({ params }: PageProps<"/[locale]/projets/[slug]">) {
  const { locale, slug } = await params;
  // Le layout valide déjà la locale, mais la page se rend en parallèle : sans
  // ce garde elle atteint Intl.DateTimeFormat avec une étiquette de langue
  // invalide (/e, /a-b-c) et lève une RangeError à chaque requête. Le statut
  // restait 404 pour le visiteur, mais chaque robot inondait les logs.
  if (!hasLocale(routing.locales, locale)) notFound();
  setRequestLocale(locale);
  const t = await getTranslations("project");
  const book = await getPublishedBookBySlug(slug, locale as Locale);
  if (!book) notFound();

  const publishedDate = book.publishedAt
    ? new Intl.DateTimeFormat(locale, { dateStyle: "long" }).format(book.publishedAt)
    : null;

  return (
    <main>
      <Container className="py-16 sm:py-20">
        <Link
          href="/projets"
          data-cy="project-back"
          className="text-sm text-ink-muted transition-colors hover:text-ink"
        >
          ← {t("backToList")}
        </Link>

        <div className="mt-10 grid gap-10 md:grid-cols-[300px_1fr] md:gap-16">
          {/* Cover — click to flip to the back cover */}
          <div>
            <BookCoverFlip
              title={book.title}
              coverImage={book.coverImage}
              backCoverImage={book.backCoverImage}
            />
          </div>

          {/* Texts */}
          <div className="max-w-2xl">
            <h1
              className="font-display text-3xl leading-tight tracking-tight sm:text-4xl"
              data-cy="project-title"
            >
              {book.title}
            </h1>
            {publishedDate && (
              <p className="mt-3 text-sm text-ink-muted" data-cy="project-published">
                {t("publishedOn", { date: publishedDate })}
              </p>
            )}
            <div className="mt-8 leading-relaxed whitespace-pre-line" data-cy="project-synopsis">
              {book.synopsis}
            </div>

            {/*
              Lien marchand saisi par l'éditeur. rel : noopener/noreferrer parce
              qu'il s'ouvre dans un onglet, nofollow parce que c'est un lien
              commercial et non une recommandation. Le protocole est contraint à
              http(s) à la validation — un href ne doit jamais pouvoir porter
              javascript:.
            */}
            {book.purchaseUrl && (
              <div className="mt-10">
                <Button
                  as="a"
                  href={book.purchaseUrl}
                  target="_blank"
                  rel="noopener noreferrer nofollow"
                  data-cy="project-buy"
                >
                  {t("buy")} ↗
                </Button>
              </div>
            )}
          </div>
        </div>
      </Container>
    </main>
  );
}
