import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getBookForAdmin } from "@/lib/books";
import { updateBook } from "../actions";
import { Container } from "@/components/ui/Container";
import { BookForm, type BookFormDefaults } from "@/components/admin/BookForm";
import { DeleteBookButton } from "@/components/admin/DeleteBookButton";
import { StatusBadge } from "@/components/admin/StatusBadge";

export const metadata: Metadata = { title: "Modifier un livre — Administration" };

export default async function EditBookPage({ params }: PageProps<"/admin/livres/[id]">) {
  const { id } = await params;
  const book = await getBookForAdmin(id);
  if (!book) notFound();

  const fr = book.translations.fr;
  const en = book.translations.en;

  const defaults: BookFormDefaults = {
    bookId: book.id,
    slug: book.slug,
    status: book.status,
    publishedAt: book.publishedAt ? book.publishedAt.toISOString().slice(0, 10) : "",
    coverThumb: book.coverThumb,
    backCoverImage: book.backCoverImage,
    purchaseUrl: book.purchaseUrl ?? "",
    // Miroir exact de slugFige() côté serveur.
    urlFigee: book.urlFigee,
    fr: { title: fr?.title ?? "", synopsis: fr?.synopsis ?? "" },
    en: { title: en?.title ?? "", synopsis: en?.synopsis ?? "" },
  };

  return (
    <main>
      <Container className="py-10">
        <Link href="/admin" className="text-sm text-ink-muted hover:text-ink" data-cy="admin-back">
          ← Tous les livres
        </Link>
        <div className="mt-4 flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <h1 className="font-display text-2xl" data-cy="admin-edit-title">
              {fr?.title ?? book.slug}
            </h1>
            <StatusBadge status={book.status} />
          </div>
          {book.status === "published" && (
            <a
              href={`/fr/projets/${book.slug}`}
              target="_blank"
              rel="noreferrer"
              data-cy="admin-view-public"
              className="text-sm text-accent-deep underline decoration-line underline-offset-4 hover:decoration-accent"
            >
              Voir la page publique ↗
            </a>
          )}
        </div>

        <BookForm action={updateBook} defaults={defaults} mode="edit" />

        <section className="mt-12 border-t border-line pt-8">
          <h2 className="font-display text-xl">Zone dangereuse</h2>
          <p className="mt-1 mb-4 text-sm text-ink-muted">
            Supprime le livre, ses traductions et toutes ses images. Irréversible.
          </p>
          <DeleteBookButton bookId={book.id} title={fr?.title ?? book.slug} />
        </section>
      </Container>
    </main>
  );
}
