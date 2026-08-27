"use client";

import { useRef, useState } from "react";
import { deleteBook } from "@/app/admin/(protected)/livres/actions";
import { Button } from "@/components/ui/Button";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";

export function DeleteBookButton({ bookId, title }: { bookId: string; title: string }) {
  const [demande, setDemande] = useState(false);
  const formulaire = useRef<HTMLFormElement>(null);
  // Un ref, pas un state : il est lu dans le `onSubmit` que `requestSubmit()`
  // déclenche juste après, sans laisser à React le temps d'un nouveau rendu.
  const confirme = useRef(false);

  return (
    <>
      <form
        ref={formulaire}
        action={deleteBook}
        onSubmit={(event) => {
          // Le bouton reste un vrai `submit` : sans JavaScript, le formulaire
          // part directement — sans confirmation, mais il part.
          if (confirme.current) return;
          event.preventDefault();
          setDemande(true);
        }}
      >
        <input type="hidden" name="bookId" value={bookId} />
        <Button type="submit" variant="danger" data-cy="admin-delete-book">
          Supprimer ce livre
        </Button>
      </form>

      <ConfirmDialog
        ouvert={demande}
        titre={`Supprimer « ${title} » ?`}
        confirmer="Supprimer"
        variante="danger"
        cy="delete"
        onAnnuler={() => setDemande(false)}
        onConfirmer={() => {
          confirme.current = true;
          setDemande(false);
          formulaire.current?.requestSubmit();
        }}
      >
        <p>
          Le livre, ses traductions et ses images seront effacés du contenu du site. Cette action
          est irréversible.
        </p>
        <p>
          Si le livre est publié, sa page publique disparaîtra et son adresse redeviendra
          disponible.
        </p>
      </ConfirmDialog>
    </>
  );
}
