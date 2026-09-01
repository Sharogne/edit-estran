"use client";

import { useEffect, useRef, type ReactNode } from "react";
import { Button } from "@/components/ui/Button";

/**
 * Demande de confirmation, dans le style du site.
 *
 * Remplace `window.confirm`, qui affichait une boîte du navigateur : hors charte,
 * impossible à mettre en forme, et qui donne à une décision éditoriale l'allure
 * d'une alerte système.
 *
 * S'appuie sur `<dialog>` et `showModal()` plutôt que sur une surcouche maison :
 * le navigateur fournit alors le piège du focus, la fermeture par Échap, le
 * `role="dialog"` et l'inertie du reste de la page — quatre choses qu'une
 * réimplémentation rate en général une par une.
 *
 * Le composant est CONTRÔLÉ (`ouvert`) : l'appelant garde la main sur ce qui
 * déclenche la question, ce qui compte quand la réponse doit reprendre une
 * action déjà commencée (un envoi de formulaire, une case à cocher).
 */
export function ConfirmDialog({
  ouvert,
  titre,
  children,
  confirmer,
  variante = "primary",
  onConfirmer,
  onAnnuler,
  cy,
}: {
  ouvert: boolean;
  titre: string;
  /** Les conséquences, en clair. C'est le corps de la question. */
  children: ReactNode;
  /** Libellé du bouton d'action — un verbe, pas « OK ». */
  confirmer: string;
  variante?: "primary" | "danger";
  onConfirmer: () => void;
  onAnnuler: () => void;
  /** Suffixe des `data-cy`, pour distinguer deux dialogues d'une même page. */
  cy: string;
}) {
  const dialogue = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const element = dialogue.current;
    if (!element) return;
    // `showModal()` lève si le dialogue est déjà ouvert : on compare avant.
    if (ouvert && !element.open) element.showModal();
    if (!ouvert && element.open) element.close();
  }, [ouvert]);

  return (
    <dialog
      ref={dialogue}
      // Échap ferme le dialogue sans passer par nos boutons : sans ça, l'état de
      // l'appelant resterait « ouvert » et le dialogue ne reviendrait jamais.
      onCancel={(event) => {
        event.preventDefault();
        onAnnuler();
      }}
      // Un clic sur le fond a pour cible le <dialog> lui-même, jamais le panneau.
      onClick={(event) => {
        if (event.target === dialogue.current) onAnnuler();
      }}
      aria-labelledby={`titre-${cy}`}
      data-cy={`confirm-dialog-${cy}`}
      // `m-auto` n'est pas décoratif : le navigateur centre un dialogue modal
      // avec `margin: auto`, que le preflight de Tailwind remet à 0 — sans quoi
      // le panneau se colle en haut à gauche.
      className="m-auto max-h-[calc(100dvh-2rem)] bg-transparent p-4 backdrop:bg-paper-inverse/50"
    >
      <div
        className="font-sans w-full max-w-md rounded-md border border-line bg-paper p-6 text-ink shadow-book"
        data-cy={`confirm-dialog-${cy}-panel`}
      >
        <h2 id={`titre-${cy}`} className="font-display text-xl leading-snug">
          {titre}
        </h2>
        <div
          className="mt-3 space-y-2 text-sm text-ink-muted"
          data-cy={`confirm-dialog-${cy}-body`}
        >
          {children}
        </div>
        <div className="mt-6 flex flex-wrap justify-end gap-3">
          {/*
            Le focus part sur « Annuler ». Ces dialogues ne posent que des
            questions irréversibles : la touche Entrée réflexe ne doit pas
            déclencher l'action, elle doit y renoncer.
          */}
          <Button
            type="button"
            variant="ghost"
            autoFocus
            onClick={onAnnuler}
            data-cy={`confirm-dialog-${cy}-cancel`}
          >
            Annuler
          </Button>
          <Button
            type="button"
            variant={variante}
            onClick={onConfirmer}
            data-cy={`confirm-dialog-${cy}-accept`}
          >
            {confirmer}
          </Button>
        </div>
      </div>
    </dialog>
  );
}
