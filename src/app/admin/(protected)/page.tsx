import type { Metadata } from "next";
import Link from "next/link";
import { getAllBooksForAdmin } from "@/lib/books";
import { Container } from "@/components/ui/Container";
import { Button } from "@/components/ui/Button";
import { BookList } from "@/components/admin/BookList";

export const metadata: Metadata = { title: "Administration — Livres" };

export default async function AdminDashboardPage() {
  const books = await getAllBooksForAdmin();

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
          <BookList books={books} />
        )}
      </Container>
    </main>
  );
}
