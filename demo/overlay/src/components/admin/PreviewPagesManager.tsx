"use client";

// STATIC DEMO BUILD — identical to the real component except for two things:
// it is a client component (the demo actions are client functions), and image
// sources go through uploadSrc() so images uploaded in the browser (data:
// URLs) display alongside the seeded ones.

import Image from "next/image";
import {
  deletePreviewPage,
  movePreviewPage,
} from "@/app/admin/(protected)/livres/actions";
import { uploadSrc } from "@/lib/image-src";
import { AddPreviewsForm } from "./AddPreviewsForm";

type PreviewPage = { id: string; imagePath: string; sortOrder: number };

export function PreviewPagesManager({
  bookId,
  previewPages,
}: {
  bookId: string;
  previewPages: PreviewPage[];
}) {
  return (
    <section className="mt-12 border-t border-line pt-8" data-cy="admin-previews">
      <h2 className="font-display text-xl">Pages de preview</h2>
      <p className="mt-1 text-sm text-ink-muted">
        Les extraits feuilletables sur la page publique du livre, dans cet ordre.
      </p>

      {previewPages.length === 0 ? (
        <p className="mt-6 text-sm text-ink-muted" data-cy="admin-previews-empty">
          Aucune page de preview pour l&apos;instant.
        </p>
      ) : (
        <ul className="mt-6 flex flex-wrap gap-4">
          {previewPages.map((page, index) => (
            <li
              key={page.id}
              className="w-32 rounded-md border border-line bg-surface p-2"
              data-cy="admin-preview-item"
            >
              <div className="relative aspect-3/4 overflow-hidden rounded-sm bg-paper">
                <Image
                  src={uploadSrc(page.imagePath)}
                  alt={`Page ${index + 1}`}
                  fill
                  sizes="128px"
                  className="object-cover"
                />
              </div>
              <div className="mt-2 flex items-center justify-between">
                <span className="text-xs text-ink-muted">n° {index + 1}</span>
                <div className="flex items-center gap-1">
                  <form action={movePreviewPage}>
                    <input type="hidden" name="previewId" value={page.id} />
                    <input type="hidden" name="direction" value="up" />
                    <button
                      type="submit"
                      disabled={index === 0}
                      aria-label="Monter"
                      data-cy="admin-preview-up"
                      className="rounded px-1 text-sm text-ink-muted hover:text-ink disabled:opacity-30"
                    >
                      ←
                    </button>
                  </form>
                  <form action={movePreviewPage}>
                    <input type="hidden" name="previewId" value={page.id} />
                    <input type="hidden" name="direction" value="down" />
                    <button
                      type="submit"
                      disabled={index === previewPages.length - 1}
                      aria-label="Descendre"
                      data-cy="admin-preview-down"
                      className="rounded px-1 text-sm text-ink-muted hover:text-ink disabled:opacity-30"
                    >
                      →
                    </button>
                  </form>
                  <form action={deletePreviewPage}>
                    <input type="hidden" name="previewId" value={page.id} />
                    <button
                      type="submit"
                      aria-label="Supprimer cette page"
                      data-cy="admin-preview-delete"
                      className="rounded px-1 text-sm text-accent-deep hover:text-accent"
                    >
                      ✕
                    </button>
                  </form>
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}

      <AddPreviewsForm bookId={bookId} />
    </section>
  );
}
