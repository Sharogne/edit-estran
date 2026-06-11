import type { Metadata } from "next";
import Image from "next/image";
import { notFound } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import type { Locale } from "@/i18n/routing";
import { getPublishedBookBySlug, getPublishedSlugs } from "@/lib/books";
import { Container } from "@/components/ui/Container";

export async function generateStaticParams() {
  const slugs = await getPublishedSlugs();
  return slugs.map((slug) => ({ slug }));
}

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
      ...(book.coverImage ? { images: [{ url: `/uploads/${book.coverImage}` }] } : {}),
    },
  };
}

export default async function ProjectPage({ params }: PageProps<"/[locale]/projets/[slug]">) {
  const { locale, slug } = await params;
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
          {/* Cover */}
          <div>
            <div className="relative aspect-2/3 overflow-hidden rounded-sm bg-surface shadow-book">
              {book.coverImage ? (
                <Image
                  src={`/uploads/${book.coverImage}`}
                  alt={book.title}
                  fill
                  priority
                  sizes="(max-width: 768px) 80vw, 300px"
                  className="object-cover"
                  data-cy="project-cover"
                />
              ) : (
                <div className="flex h-full items-center justify-center border border-line p-4">
                  <span className="font-display text-center text-xl text-ink-muted">
                    {book.title}
                  </span>
                </div>
              )}
            </div>
          </div>

          {/* Texts */}
          <div className="max-w-2xl">
            <h1 className="font-display text-3xl leading-tight tracking-tight sm:text-4xl" data-cy="project-title">
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
          </div>
        </div>

        {/* Preview pages */}
        {book.previewPages.length > 0 && (
          <section className="mt-20 border-t border-line pt-12" data-cy="project-previews">
            <h2 className="font-display text-2xl">{t("previewsTitle")}</h2>
            <div className="mt-8 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
              {book.previewPages.map((page, index) => (
                <div
                  key={page.id}
                  className="relative aspect-3/4 overflow-hidden rounded-sm bg-surface shadow-book"
                  data-cy="project-preview-page"
                >
                  <Image
                    src={`/uploads/${page.imagePath}`}
                    alt={t("previewAlt", { title: book.title, number: index + 1 })}
                    fill
                    sizes="(max-width: 640px) 45vw, (max-width: 1024px) 30vw, 240px"
                    className="object-cover"
                  />
                </div>
              ))}
            </div>
          </section>
        )}
      </Container>
    </main>
  );
}
