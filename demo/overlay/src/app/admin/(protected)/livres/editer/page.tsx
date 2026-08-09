"use client";

// STATIC DEMO BUILD — replaces /admin/livres/[id]. A static export can only
// pre-render the ids it knows at build time, so books created during the demo
// would 404 on a dynamic segment: the id travels as a query parameter instead.

import { Suspense } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { updateBook } from "../actions";
import { pickTranslation, seedBooks } from "@/lib/demo-data";
import { useDemoBooks } from "@/lib/demo-hooks";
import { Container } from "@/components/ui/Container";
import { BookForm, type BookFormDefaults } from "@/components/admin/BookForm";
import { PreviewPagesManager } from "@/components/admin/PreviewPagesManager";
import { DeleteBookButton } from "@/components/admin/DeleteBookButton";
import { StatusBadge } from "@/components/admin/StatusBadge";

/** Only seeded books have a pre-rendered public page in the static demo. */
const publicSlugs = new Set(
  seedBooks.filter((book) => book.status === "published").map((book) => book.slug)
);

function EditBookContent() {
  const id = useSearchParams().get("id") ?? "";
  const books = useDemoBooks();

  if (books === null) {
    return (
      <Container className="py-10">
        <p className="text-ink-muted">Chargement…</p>
      </Container>
    );
  }

  const book = books.find((entry) => entry.id === id);
  if (!book) {
    return (
      <Container className="py-10">
        <Link href="/admin" className="text-sm text-ink-muted hover:text-ink" data-cy="admin-back">
          ← Tous les livres
        </Link>
        <p className="mt-6" data-cy="admin-edit-missing">
          Livre introuvable.
        </p>
      </Container>
    );
  }

  const fr = pickTranslation(book, "fr");
  const en = book.translations.find((t) => t.locale === "en");

  const defaults: BookFormDefaults = {
    bookId: book.id,
    slug: book.slug,
    status: book.status,
    publishedAt: book.publishedAt ?? "",
    sortOrder: book.sortOrder,
    coverImage: book.coverImage,
    fr: { title: fr?.title ?? "", synopsis: fr?.synopsis ?? "" },
    en: { title: en?.title ?? "", synopsis: en?.synopsis ?? "" },
  };

  return (
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
        {book.status === "published" && publicSlugs.has(book.slug) && (
          <a
            href={`${process.env.NEXT_PUBLIC_BASE_PATH ?? ""}/fr/projets/${book.slug}/`}
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

      <PreviewPagesManager bookId={book.id} previewPages={book.previewPages} />

      <section className="mt-12 border-t border-line pt-8">
        <h2 className="font-display text-xl">Zone dangereuse</h2>
        <p className="mt-1 mb-4 text-sm text-ink-muted">
          Supprime le livre, ses traductions et toutes ses images. Irréversible.
        </p>
        <DeleteBookButton bookId={book.id} title={fr?.title ?? book.slug} />
      </section>
    </Container>
  );
}

export default function EditBookPage() {
  return (
    <main>
      {/* useSearchParams needs a Suspense boundary in a statically exported page. */}
      <Suspense fallback={null}>
        <EditBookContent />
      </Suspense>
    </main>
  );
}
