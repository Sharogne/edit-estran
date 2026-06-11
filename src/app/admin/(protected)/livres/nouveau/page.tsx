import type { Metadata } from "next";
import Link from "next/link";
import { createBook } from "../actions";
import { Container } from "@/components/ui/Container";
import { BookForm } from "@/components/admin/BookForm";

export const metadata: Metadata = { title: "Nouveau livre — Administration" };

export default function NewBookPage() {
  return (
    <main>
      <Container className="py-10">
        <Link href="/admin" className="text-sm text-ink-muted hover:text-ink" data-cy="admin-back">
          ← Tous les livres
        </Link>
        <h1 className="font-display mt-4 text-2xl" data-cy="admin-new-title">
          Nouveau livre
        </h1>
        <BookForm action={createBook} mode="create" />
      </Container>
    </main>
  );
}
