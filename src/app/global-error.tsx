"use client";

import { fontClasses } from "@/styles/fonts";
import "./globals.css";

/**
 * Dernier filet : il ne se déclenche que si un layout racine lui-même a échoué.
 * Il REMPLACE ce layout, d'où ses propres <html>/<body> — le projet n'a pas de
 * layout racine unique, chaque segment ([locale] et admin) porte les siens.
 *
 * Aucun contexte next-intl ici, et aucune locale à déduire : le texte est écrit
 * en dur, dans les deux langues du site. Une page d'erreur qui échoue à
 * s'afficher parce qu'elle cherchait ses traductions ne servirait à rien.
 */
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="fr" className={`${fontClasses} h-full antialiased`}>
      <body className="flex min-h-full flex-col items-center justify-center px-5 text-center">
        <p className="font-display text-7xl text-line">!</p>
        <h1 className="font-display mt-6 text-3xl" data-cy="global-error-title">
          Le site est momentanément indisponible
        </h1>
        <p className="mt-4 max-w-xl text-ink-muted">
          Une erreur inattendue empêche l&apos;affichage de cette page. Réessayez dans un instant.
        </p>
        <p className="mt-2 max-w-xl text-sm text-ink-muted" lang="en">
          An unexpected error is preventing this page from loading. Please try again shortly.
        </p>
        {error.digest && <p className="mt-4 font-mono text-xs text-ink-muted">{error.digest}</p>}
        <button
          type="button"
          onClick={reset}
          data-cy="global-error-retry"
          className="mt-10 inline-flex items-center justify-center rounded-md border border-transparent bg-ink px-5 py-2.5 text-sm font-medium tracking-wide text-paper transition-colors hover:bg-accent-deep"
        >
          Réessayer / Try again
        </button>
      </body>
    </html>
  );
}
