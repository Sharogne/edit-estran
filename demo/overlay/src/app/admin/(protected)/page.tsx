"use client";

// STATIC DEMO BUILD — same dashboard, reading localStorage instead of Prisma.

import Link from "next/link";
import Image from "next/image";
import { pickTranslation, resetBooks } from "@/lib/demo-data";
import { uploadSrc } from "@/lib/image-src";
import { useDemoBooks } from "@/lib/demo-hooks";
import { Container } from "@/components/ui/Container";
import { Button } from "@/components/ui/Button";
import { StatusBadge } from "@/components/admin/StatusBadge";

const dateFormat = new Intl.DateTimeFormat("fr", { dateStyle: "medium" });

export default function AdminDashboardPage() {
  const books = useDemoBooks();

  const sorted = books
    ? [...books].sort(
        (a, b) => a.sortOrder - b.sortOrder || b.updatedAt.localeCompare(a.updatedAt)
      )
    : [];

  return (
    <main>
      <Container className="py-10">
        <div className="flex items-center justify-between gap-4">
          <h1 className="font-display text-2xl" data-cy="admin-dashboard-title">
            Livres
          </h1>
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => {
                if (confirm("Réinitialiser la démo et retrouver le catalogue d'origine ?")) {
                  resetBooks();
                  window.location.reload();
                }
              }}
              data-cy="admin-demo-reset"
              className="text-sm text-ink-muted underline decoration-line underline-offset-4 hover:text-ink"
            >
              Réinitialiser la démo
            </button>
            <Button as={Link} href="/admin/livres/nouveau" data-cy="admin-new-book">
              Nouveau livre
            </Button>
          </div>
        </div>

        {books === null ? (
          <p className="mt-12 text-ink-muted">Chargement…</p>
        ) : sorted.length === 0 ? (
          <p className="mt-12 text-ink-muted" data-cy="admin-empty">
            Aucun livre pour l&apos;instant. Créez le premier !
          </p>
        ) : (
          <ul className="mt-8 divide-y divide-line border-y border-line" data-cy="admin-book-list">
            {sorted.map((book) => (
              <li key={book.id}>
                <Link
                  href={`/admin/livres/editer/?id=${encodeURIComponent(book.id)}`}
                  data-cy={`admin-book-row-${book.slug}`}
                  className="flex items-center gap-5 py-4 transition-colors hover:bg-surface"
                >
                  <div className="relative h-16 w-11 shrink-0 overflow-hidden rounded-sm bg-surface shadow-book">
                    {book.coverImage && (
                      <Image
                        src={uploadSrc(book.coverImage)}
                        alt=""
                        fill
                        sizes="44px"
                        className="object-cover"
                      />
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium">
                      {pickTranslation(book, "fr")?.title ?? book.slug}
                    </p>
                    <p className="truncate text-sm text-ink-muted">
                      /{book.slug} — {book.previewPages.length} page(s) de preview
                    </p>
                  </div>
                  <div className="hidden text-sm text-ink-muted sm:block">
                    Modifié le {dateFormat.format(new Date(book.updatedAt))}
                  </div>
                  <StatusBadge status={book.status} />
                </Link>
              </li>
            ))}
          </ul>
        )}
      </Container>
    </main>
  );
}
