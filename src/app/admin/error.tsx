"use client";

import { Container } from "@/components/ui/Container";
import { Button } from "@/components/ui/Button";

/**
 * Filet du back office : toute exception non rattrapée par une action s'arrête
 * ici plutôt que de produire une erreur 500 nue.
 *
 * Ce n'est PAS un substitut à la gestion d'erreur des server actions — une
 * cause prévisible (fichier illisible, livre supprimé) doit être renvoyée dans
 * `BookActionState` pour que l'éditeur garde sa saisie. Cette page ne traite
 * que l'imprévu, et le seul message honnête qu'on puisse alors afficher est
 * qu'on ne sait pas.
 */
export default function AdminError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <main className="flex flex-1 items-center justify-center py-16">
      <Container className="max-w-xl">
        <p className="font-display text-5xl text-line">!</p>
        <h1 className="font-display mt-5 text-2xl" data-cy="admin-error-title">
          Une erreur inattendue est survenue
        </h1>
        <p className="mt-3 text-ink-muted">
          L&apos;opération n&apos;a pas abouti. Aucune donnée n&apos;a été modifiée : le contenu du
          site est écrit d&apos;un seul bloc, une écriture interrompue laisse le fichier précédent
          intact.
        </p>
        {error.digest && (
          <p className="mt-4 text-sm text-ink-muted">
            Référence à communiquer en cas de besoin :{" "}
            <code className="rounded-sm bg-surface px-1.5 py-0.5">{error.digest}</code>
          </p>
        )}
        <div className="mt-8 flex flex-wrap items-center gap-3">
          <Button type="button" onClick={reset} data-cy="admin-error-retry">
            Réessayer
          </Button>
          <Button as="a" href="/admin" variant="ghost" data-cy="admin-error-home">
            Retour aux livres
          </Button>
        </div>
      </Container>
    </main>
  );
}
