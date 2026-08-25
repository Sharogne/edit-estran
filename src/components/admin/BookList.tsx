"use client";

import Image from "next/image";
import Link from "next/link";
import { useState, useTransition } from "react";
import { reorderBooks } from "@/app/admin/(protected)/livres/actions";
import { StatusBadge } from "@/components/admin/StatusBadge";

export type AdminBookRow = {
  id: string;
  slug: string;
  status: string;
  updatedAt: Date;
  coverThumb: string | null;
  title: string;
};

const dateFormat = new Intl.DateTimeFormat("fr", { dateStyle: "medium" });

/**
 * Liste des livres du back office, réordonnable.
 *
 * Le glisser-déposer utilise l'API HTML5 native plutôt qu'une librairie : le
 * projet n'a aucune dépendance UI hors Tailwind, et l'écart de code ne le
 * justifie pas. Contrepartie assumée : le glisser natif ne fonctionne pas au
 * tactile — d'où la poignée focusable, où les flèches haut/bas déplacent le
 * livre. Ce n'est pas un bonus d'accessibilité, c'est le seul chemin au clavier.
 */
export function BookList({ books }: { books: AdminBookRow[] }) {
  const [ordre, setOrdre] = useState(books);
  const [reference, setReference] = useState(books);
  const [depuis, setDepuis] = useState<number | null>(null);
  const [erreur, setErreur] = useState("");
  const [enCours, demarrer] = useTransition();

  // Le serveur reste la source de vérité : dès qu'il renvoie une nouvelle liste
  // (revalidate après réordonnancement, ou modification faite ailleurs), on
  // repart de lui. Ajustement pendant le rendu plutôt qu'un effet : c'est le
  // motif recommandé par React pour resynchroniser un état sur une prop.
  if (reference !== books) {
    setReference(books);
    setOrdre(books);
  }

  function deplacer(de: number, vers: number) {
    if (de === vers || vers < 0 || vers >= ordre.length) return;

    const suivant = [...ordre];
    const [livre] = suivant.splice(de, 1);
    suivant.splice(vers, 0, livre);
    setOrdre(suivant); // affichage optimiste : le glisser doit répondre tout de suite
    setErreur("");

    demarrer(async () => {
      const resultat = await reorderBooks(suivant.map((item) => item.id));
      if (resultat.error) {
        setErreur(resultat.error);
        setOrdre(books); // l'écriture a échoué : on ne laisse pas un ordre menteur à l'écran
      }
    });
  }

  function auClavier(event: React.KeyboardEvent, index: number) {
    const delta = event.key === "ArrowUp" ? -1 : event.key === "ArrowDown" ? 1 : 0;
    if (delta === 0) return;
    event.preventDefault();
    deplacer(index, index + delta);
  }

  return (
    <>
      <p className="mt-8 text-sm text-ink-muted" data-cy="admin-reorder-hint">
        Glissez un livre pour le déplacer, ou utilisez les flèches ↑ ↓ depuis sa poignée.
        L&apos;ordre est celui du catalogue public.
      </p>

      {erreur && (
        <p
          className="mt-4 rounded-md border border-accent/40 bg-accent/10 px-4 py-3 text-sm text-accent-deep"
          role="alert"
          data-cy="admin-reorder-error"
        >
          {erreur}
        </p>
      )}

      <ul
        className={`mt-4 divide-y divide-line border-y border-line ${enCours ? "opacity-70" : ""}`}
        data-cy="admin-book-list"
      >
        {ordre.map((book, index) => (
          <li
            key={book.id}
            draggable
            onDragStart={(event) => {
              setDepuis(index);
              // Firefox exige une donnée pour amorcer le glisser ; la logique,
              // elle, s'appuie sur l'état React (et reste ainsi testable).
              event.dataTransfer?.setData("text/plain", book.id);
              if (event.dataTransfer) event.dataTransfer.effectAllowed = "move";
            }}
            onDragOver={(event) => {
              event.preventDefault();
              if (event.dataTransfer) event.dataTransfer.dropEffect = "move";
            }}
            onDrop={(event) => {
              event.preventDefault();
              if (depuis !== null) deplacer(depuis, index);
              setDepuis(null);
            }}
            onDragEnd={() => setDepuis(null)}
            data-cy={`admin-book-item-${book.slug}`}
            data-position={index}
            className={`flex items-center gap-3 transition-colors ${
              depuis === index ? "opacity-40" : ""
            }`}
          >
            <button
              type="button"
              onKeyDown={(event) => auClavier(event, index)}
              aria-label={`Déplacer ${book.title} dans le catalogue`}
              title="Glisser pour déplacer, ou flèches ↑ ↓"
              data-cy={`admin-book-handle-${book.slug}`}
              className="cursor-grab px-2 py-4 text-ink-muted hover:text-ink"
            >
              <span aria-hidden="true">⠿</span>
            </button>

            <Link
              href={`/admin/livres/${book.id}`}
              draggable={false}
              data-cy={`admin-book-row-${book.slug}`}
              className="flex flex-1 items-center gap-5 py-4 transition-colors hover:bg-surface"
            >
              <div className="relative h-16 w-11 shrink-0 overflow-hidden rounded-sm bg-surface shadow-book">
                {book.coverThumb && (
                  <Image src={book.coverThumb} alt="" fill sizes="44px" className="object-cover" />
                )}
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate font-medium">{book.title}</p>
                <p className="truncate text-sm text-ink-muted">/{book.slug}</p>
              </div>
              <div className="hidden text-sm text-ink-muted sm:block">
                Modifié le {dateFormat.format(book.updatedAt)}
              </div>
              <StatusBadge status={book.status} />
            </Link>
          </li>
        ))}
      </ul>
    </>
  );
}
