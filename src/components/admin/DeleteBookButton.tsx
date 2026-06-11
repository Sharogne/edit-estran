"use client";

import { deleteBook } from "@/app/admin/(protected)/livres/actions";
import { Button } from "@/components/ui/Button";

export function DeleteBookButton({ bookId, title }: { bookId: string; title: string }) {
  return (
    <form
      action={deleteBook}
      onSubmit={(event) => {
        if (!confirm(`Supprimer définitivement « ${title} » (textes et images) ?`)) {
          event.preventDefault();
        }
      }}
    >
      <input type="hidden" name="bookId" value={bookId} />
      <Button type="submit" variant="danger" data-cy="admin-delete-book">
        Supprimer ce livre
      </Button>
    </form>
  );
}
