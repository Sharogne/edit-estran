"use client";

// STATIC DEMO BUILD — identical to the real page; only the action differs.

import Link from "next/link";
import { createBook } from "../actions";
import { Container } from "@/components/ui/Container";
import { BookForm } from "@/components/admin/BookForm";

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
