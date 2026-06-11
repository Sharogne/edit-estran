"use client";

import { useActionState, useRef, useEffect } from "react";
import {
  addPreviewPages,
  type BookActionState,
} from "@/app/admin/(protected)/livres/actions";
import { Button } from "@/components/ui/Button";

export function AddPreviewsForm({ bookId }: { bookId: string }) {
  const [state, formAction, isPending] = useActionState<BookActionState, FormData>(
    addPreviewPages,
    {}
  );
  const formRef = useRef<HTMLFormElement>(null);

  // Clear the file input after a successful upload.
  useEffect(() => {
    if (state.success) formRef.current?.reset();
  }, [state]);

  return (
    <form ref={formRef} action={formAction} className="mt-6 max-w-md">
      <input type="hidden" name="bookId" value={bookId} />
      <label htmlFor="add-previews" className="mb-1 block text-sm font-medium">
        Ajouter des pages
      </label>
      <div className="flex items-center gap-3">
        <input
          id="add-previews"
          name="previews"
          type="file"
          multiple
          required
          accept="image/jpeg,image/png,image/webp,image/avif"
          data-cy="admin-preview-add-input"
          className="w-full rounded-md border border-line bg-paper px-3 py-2 text-sm file:mr-3 file:rounded-md file:border-0 file:bg-ink file:px-3 file:py-1 file:text-xs file:text-paper"
        />
        <Button
          type="submit"
          variant="ghost"
          disabled={isPending}
          data-cy="admin-preview-add-submit"
        >
          {isPending ? "Ajout…" : "Ajouter"}
        </Button>
      </div>
      {state.error && (
        <p className="mt-2 text-sm text-accent-deep" role="alert" data-cy="admin-preview-add-error">
          {state.error}
        </p>
      )}
    </form>
  );
}
