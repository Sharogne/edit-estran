import type { Metadata } from "next";
import Link from "next/link";
import Image from "next/image";
import { getAllBooksForAdmin } from "@/lib/books";
import { Container } from "@/components/ui/Container";
import { Button } from "@/components/ui/Button";
import { StatusBadge } from "@/components/admin/StatusBadge";

export const metadata: Metadata = { title: "Administration — Livres" };

export default async function AdminDashboardPage() {
  const books = await getAllBooksForAdmin();
  const dateFormat = new Intl.DateTimeFormat("fr", { dateStyle: "medium" });

  return (
    <main>
      <Container className="py-10">
        <div className="flex items-center justify-between gap-4">
          <h1 className="font-display text-2xl" data-cy="admin-dashboard-title">
            Livres
          </h1>
          <Button as={Link} href="/admin/livres/nouveau" data-cy="admin-new-book">
            Nouveau livre
          </Button>
        </div>

        {books.length === 0 ? (
          <p className="mt-12 text-ink-muted" data-cy="admin-empty">
            Aucun livre pour l&apos;instant. Créez le premier !
          </p>
        ) : (
          <ul className="mt-8 divide-y divide-line border-y border-line" data-cy="admin-book-list">
            {books.map((book) => (
              <li key={book.id}>
                <Link
                  href={`/admin/livres/${book.id}`}
                  data-cy={`admin-book-row-${book.slug}`}
                  className="flex items-center gap-5 py-4 transition-colors hover:bg-surface"
                >
                  <div className="relative h-16 w-11 shrink-0 overflow-hidden rounded-sm bg-surface shadow-book">
                    {book.coverImage && (
                      <Image
                        src={`/uploads/${book.coverImage}`}
                        alt=""
                        fill
                        sizes="44px"
                        className="object-cover"
                      />
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium">{book.title}</p>
                    <p className="truncate text-sm text-ink-muted">
                      /{book.slug} — {book.previewCount} page(s) de preview
                    </p>
                  </div>
                  <div className="hidden text-sm text-ink-muted sm:block">
                    Modifié le {dateFormat.format(book.updatedAt)}
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
