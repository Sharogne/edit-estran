"use client";

import Image from "next/image";
import { useActionState, useState } from "react";
import type { BookActionState } from "@/app/admin/(protected)/livres/actions";
import { ALLOWED_IMAGE_TYPES, MAX_IMAGE_BYTES, MAX_IMAGE_PIXELS } from "@/config/uploads";
import { Button } from "@/components/ui/Button";

export type BookFormDefaults = {
  bookId?: string;
  slug: string;
  status: string;
  publishedAt: string; // "" or "YYYY-MM-DD"
  coverThumb: string | null;
  backCoverImage: string | null;
  purchaseUrl: string;
  /** Le livre a déjà été publié : son adresse est figée (cf. slugFige côté serveur). */
  urlFigee: boolean;
  fr: { title: string; synopsis: string };
  en: { title: string; synopsis: string };
};

const emptyDefaults: BookFormDefaults = {
  slug: "",
  status: "draft",
  publishedAt: "",
  coverThumb: null,
  backCoverImage: null,
  purchaseUrl: "",
  urlFigee: false,
  fr: { title: "", synopsis: "" },
  en: { title: "", synopsis: "" },
};

const inputClasses =
  "w-full rounded-md border border-line bg-paper px-3 py-2 text-sm text-ink placeholder:text-ink-muted/60 focus:border-ink";
const labelClasses = "mb-1 block text-sm font-medium";
const helpClasses = "mt-1 text-xs text-ink-muted";
const errorClasses = "mt-1 text-xs text-accent-deep";
const verrouilleClasses =
  "w-full cursor-not-allowed rounded-md border border-line bg-surface px-3 py-2 text-sm text-ink-muted";
const fileClasses = `${inputClasses} file:mr-3 file:rounded-md file:border-0 file:bg-ink file:px-3 file:py-1 file:text-xs file:text-paper`;

const MAX_IMAGE_MO = MAX_IMAGE_BYTES / (1024 * 1024);

/**
 * Petit repère d'aide. Le `title` donne l'infobulle au survol, mais le même
 * texte est TOUJOURS affiché sous le champ : une infobulle est invisible au
 * tactile et au clavier, elle ne peut pas porter seule une information dont
 * l'éditeur a besoin pour décider.
 */
function Repere({ texte }: { texte: string }) {
  return (
    <span className="ml-1 cursor-help text-ink-muted" title={texte} aria-hidden="true">
      ⓘ
    </span>
  );
}
const mo = (octets: number) => (octets / (1024 * 1024)).toFixed(1).replace(".", ",");
const mpx = (pixels: number) => (pixels / 1_000_000).toFixed(0);

/**
 * Décode réellement le fichier pour en tirer ses dimensions.
 *
 * C'est le seul contrôle qui regarde le CONTENU : sous Windows, `file.type`
 * est déduit de l'extension via la base de registre, donc un fichier corrompu,
 * tronqué, ou simplement renommé en `.jpg` s'annonce `image/jpeg` sans en
 * être une. Côté serveur, sharp lève alors une exception (« premature end of
 * JPEG image », « unsupported image format ») — pas un message d'erreur.
 *
 * Retourne `null` quand le fichier est indécodable, `undefined` quand le
 * navigateur ne sait pas faire le contrôle (on laisse alors le serveur trancher
 * plutôt que de bloquer une image valide).
 */
async function dimensionsImage(
  file: File
): Promise<{ width: number; height: number } | null | undefined> {
  if (typeof createImageBitmap !== "function") return undefined;
  try {
    const bitmap = await createImageBitmap(file);
    const taille = { width: bitmap.width, height: bitmap.height };
    bitmap.close();
    return taille;
  } catch {
    return null;
  }
}

/**
 * Vérifie un fichier AVANT l'envoi. Ce n'est pas un doublon de la validation
 * serveur : les deux causes d'écran d'erreur Next (« A server error occurred »)
 * sont hors de portée d'un message de formulaire.
 *
 *  - Au-delà de `serverActions.bodySizeLimit`, Next rejette la requête au
 *    transport : la server action n'est jamais appelée.
 *  - Sur un fichier que sharp ne sait pas décoder, ou trop grand pour son
 *    `limitInputPixels`, l'encodage lève une exception au milieu de l'action.
 *
 * Les quatre contrôles vont donc du moins cher au plus cher : type, poids,
 * décodage, dimensions.
 */
async function erreurFichier(file: File): Promise<string> {
  if (!ALLOWED_IMAGE_TYPES.includes(file.type)) {
    const type = file.type ? ` (${file.type})` : "";
    return `Format non supporté${type}. Formats acceptés : JPEG, PNG, WebP ou AVIF.`;
  }
  if (file.size > MAX_IMAGE_BYTES) {
    return `Image trop lourde : ${mo(file.size)} Mo pour ${MAX_IMAGE_MO} Mo maximum. Réduisez-la avant de la déposer.`;
  }

  const taille = await dimensionsImage(file);
  if (taille === null) {
    return (
      "Image illisible : le fichier est abîmé, ou son contenu ne correspond pas à son extension. " +
      "Ouvrez-le puis ré-enregistrez-le en JPEG ou PNG."
    );
  }
  if (taille && taille.width * taille.height > MAX_IMAGE_PIXELS) {
    return `Image trop grande : ${taille.width} × ${taille.height} pixels, soit plus de ${mpx(MAX_IMAGE_PIXELS)} millions. Réduisez ses dimensions avant de la déposer.`;
  }
  return "";
}

/** One file input, with a thumbnail of the image currently stored (if any). */
function ImageField({
  name,
  cy,
  label,
  current,
  currentAlt,
  erreur,
  onFichier,
}: {
  name: string;
  cy: string;
  label: string;
  current: string | null;
  currentAlt: string;
  erreur?: string;
  onFichier: (name: string, input: HTMLInputElement) => void;
}) {
  return (
    <div className="flex items-start gap-4">
      {current && (
        <div className="relative h-36 w-24 shrink-0 overflow-hidden rounded-sm bg-surface shadow-book">
          <Image
            src={current}
            alt={currentAlt}
            fill
            sizes="96px"
            className="object-cover"
            data-cy={`book-form-current-${cy}`}
          />
        </div>
      )}
      <div className="flex-1">
        <label htmlFor={name} className={labelClasses}>
          {label}
        </label>
        <input
          id={name}
          name={name}
          type="file"
          accept={ALLOWED_IMAGE_TYPES.join(",")}
          onChange={(event) => onFichier(name, event.currentTarget)}
          data-cy={`book-form-${cy}`}
          className={fileClasses}
        />
        {erreur && (
          <p className={errorClasses} role="alert" data-cy={`book-form-error-${cy}`}>
            {erreur}
          </p>
        )}
      </div>
    </div>
  );
}

export function BookForm({
  action,
  defaults = emptyDefaults,
  mode,
}: {
  action: (prevState: BookActionState, formData: FormData) => Promise<BookActionState>;
  defaults?: BookFormDefaults;
  mode: "create" | "edit";
}) {
  const [state, formAction, isPending] = useActionState<BookActionState, FormData>(action, {});
  const [erreursFichier, setErreursFichier] = useState<Record<string, string>>({});
  // Le décodage d'une image est asynchrone : sans ce compteur, un envoi lancé
  // dans la foulée du choix de fichier partirait avant le verdict.
  const [verifications, setVerifications] = useState(0);

  // On verrouille le titre QUI A PRODUIT l'adresse, pas les deux : sinon on
  // interdirait d'ajouter la traduction anglaise d'un livre déjà publié, alors
  // que ce titre-là n'a aucune incidence sur l'URL.
  const titreFrVerrouille = defaults.urlFigee && Boolean(defaults.fr.title);
  const titreEnVerrouille = defaults.urlFigee && !defaults.fr.title;

  function messageTitre(verrouille: boolean): string {
    return verrouille
      ? `L'adresse publique /fr/projets/${defaults.slug} a été générée à partir de ce titre. ` +
          "La modifier changerait l'adresse d'une page déjà en ligne : le champ est verrouillé."
      : "L'adresse publique du livre sera dérivée de ce titre. Vous pouvez encore le corriger : " +
          "elle se figera à la première publication.";
  }

  /**
   * La publication rend le titre définitivement non modifiable, puisque
   * l'adresse publique en découle. C'est une conséquence lourde et invisible :
   * on la fait confirmer explicitement, au moment où l'éditeur bascule le
   * statut. Même parti pris que la suppression d'un livre (window.confirm).
   */
  function confirmerPublication(event: React.ChangeEvent<HTMLSelectElement>) {
    if (event.target.value !== "published" || defaults.urlFigee) return;

    const champs = event.target.form?.elements;
    const titreFr = (champs?.namedItem("title_fr") as HTMLInputElement | null)?.value.trim();
    const titreEn = (champs?.namedItem("title_en") as HTMLInputElement | null)?.value.trim();
    const titre = titreFr || titreEn || "ce livre";

    const accepte = window.confirm(
      `Attention : une fois « ${titre} » publié, son titre ne sera plus modifiable.\n\n` +
        "L'adresse publique du livre en est dérivée, et la changer casserait les liens " +
        "déjà partagés. Corrigez le titre maintenant si nécessaire.\n\nPublier ce livre ?"
    );
    if (!accepte) event.target.value = "draft";
  }

  async function verifierFichier(name: string, input: HTMLInputElement) {
    const file = input.files?.[0];
    if (!file) {
      setErreursFichier((precedent) => ({ ...precedent, [name]: "" }));
      return;
    }
    setVerifications((nombre) => nombre + 1);
    try {
      const erreur = await erreurFichier(file);
      // Vider l'input : sans ça le fichier refusé partirait quand même à l'envoi.
      if (erreur) input.value = "";
      setErreursFichier((precedent) => ({ ...precedent, [name]: erreur }));
    } finally {
      setVerifications((nombre) => nombre - 1);
    }
  }

  return (
    <form action={formAction} className="mt-8 space-y-10" data-cy="book-form">
      {defaults.bookId && <input type="hidden" name="bookId" value={defaults.bookId} />}

      {/* Contenus FR / EN */}
      <div className="grid gap-8 lg:grid-cols-2">
        <fieldset className="space-y-4">
          <legend className="font-display mb-3 text-lg">Français</legend>
          <p className={helpClasses}>
            Laisser vide pour reprendre l&apos;anglais sur les pages françaises.
          </p>
          <div>
            <label htmlFor="title_fr" className={labelClasses}>
              Titre (FR)
              <Repere texte={messageTitre(titreFrVerrouille)} />
            </label>
            <input
              id="title_fr"
              name="title_fr"
              maxLength={200}
              defaultValue={defaults.fr.title}
              readOnly={titreFrVerrouille}
              aria-describedby="aide_titre_fr"
              data-cy="book-form-title-fr"
              className={titreFrVerrouille ? verrouilleClasses : inputClasses}
            />
            <p id="aide_titre_fr" className={helpClasses} data-cy="book-form-title-fr-aide">
              {messageTitre(titreFrVerrouille)}
            </p>
          </div>
          <div>
            <label htmlFor="synopsis_fr" className={labelClasses}>
              Synopsis (FR)
            </label>
            <textarea
              id="synopsis_fr"
              name="synopsis_fr"
              rows={7}
              maxLength={5000}
              defaultValue={defaults.fr.synopsis}
              data-cy="book-form-synopsis-fr"
              className={inputClasses}
            />
          </div>
        </fieldset>

        <fieldset className="space-y-4">
          <legend className="font-display mb-3 text-lg">English</legend>
          <p className={helpClasses}>
            Laisser vide pour reprendre le français sur les pages anglaises.
          </p>
          <div>
            <label htmlFor="title_en" className={labelClasses}>
              Titre (EN)
              {titreEnVerrouille && <Repere texte={messageTitre(true)} />}
            </label>
            <input
              id="title_en"
              name="title_en"
              maxLength={200}
              defaultValue={defaults.en.title}
              readOnly={titreEnVerrouille}
              data-cy="book-form-title-en"
              className={titreEnVerrouille ? verrouilleClasses : inputClasses}
            />
            {titreEnVerrouille && (
              <p className={helpClasses} data-cy="book-form-title-en-aide">
                {messageTitre(true)}
              </p>
            )}
          </div>
          <div>
            <label htmlFor="synopsis_en" className={labelClasses}>
              Synopsis (EN)
            </label>
            <textarea
              id="synopsis_en"
              name="synopsis_en"
              rows={7}
              maxLength={5000}
              defaultValue={defaults.en.synopsis}
              data-cy="book-form-synopsis-en"
              className={inputClasses}
            />
          </div>
        </fieldset>
      </div>

      {/* Paramètres */}
      <fieldset className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <legend className="font-display mb-3 text-lg">Paramètres</legend>
        {defaults.slug && (
          <div>
            <span className={labelClasses}>Adresse publique</span>
            <p
              className="truncate rounded-md border border-line bg-surface px-3 py-2 text-sm text-ink-muted"
              data-cy="book-form-slug-preview"
            >
              /fr/projets/{defaults.slug}
            </p>
            <p className={helpClasses}>
              Dérivée du titre. Elle suit le titre tant que le livre n&apos;est pas publié, puis
              reste figée pour ne pas casser les liens partagés.
            </p>
          </div>
        )}
        <div>
          <label htmlFor="status" className={labelClasses}>
            Statut
          </label>
          <select
            id="status"
            name="status"
            defaultValue={defaults.status}
            onChange={confirmerPublication}
            data-cy="book-form-status"
            className={inputClasses}
          >
            <option value="draft">Brouillon</option>
            <option value="published">Publié</option>
          </select>
          <p className={helpClasses}>
            Seuls les livres publiés apparaissent sur le site.
            {!defaults.urlFigee && " La publication fige définitivement le titre."}
          </p>
        </div>
        <div>
          <label htmlFor="publishedAt" className={labelClasses}>
            Date de parution
          </label>
          <input
            id="publishedAt"
            name="publishedAt"
            type="date"
            defaultValue={defaults.publishedAt}
            data-cy="book-form-published-at"
            className={inputClasses}
          />
          <p className={helpClasses}>Vide = date du jour à la publication</p>
        </div>
        <div className="sm:col-span-2 lg:col-span-3">
          <label htmlFor="purchaseUrl" className={labelClasses}>
            Lien d&apos;achat
          </label>
          <input
            id="purchaseUrl"
            name="purchaseUrl"
            type="url"
            inputMode="url"
            maxLength={500}
            placeholder="https://…"
            defaultValue={defaults.purchaseUrl}
            data-cy="book-form-purchase-url"
            className={inputClasses}
          />
          <p className={helpClasses}>
            Facultatif. Renseigné, un bouton « Acheter » apparaît sur la fiche du livre.
          </p>
        </div>
      </fieldset>

      {/* Couverture + 4e de couverture */}
      <fieldset className="space-y-4">
        <legend className="font-display mb-3 text-lg">Images</legend>
        <div className="grid gap-6 sm:grid-cols-2">
          <ImageField
            name="cover"
            cy="cover"
            label={defaults.coverThumb ? "Remplacer la couverture" : "Image de couverture"}
            current={defaults.coverThumb}
            currentAlt="Couverture actuelle"
            erreur={erreursFichier.cover}
            onFichier={verifierFichier}
          />
          <ImageField
            name="backCover"
            cy="back-cover"
            label={
              defaults.backCoverImage ? "Remplacer le 4e de couverture" : "4e de couverture (verso)"
            }
            current={defaults.backCoverImage}
            currentAlt="4e de couverture actuel"
            erreur={erreursFichier.backCover}
            onFichier={verifierFichier}
          />
        </div>
        <p className={helpClasses}>
          JPEG, PNG, WebP ou AVIF — {MAX_IMAGE_MO} Mo max. Les images sont recompressées en WebP et
          stockées directement dans la page : inutile de les optimiser avant.
        </p>
      </fieldset>

      {state.error && (
        <p
          className="rounded-md border border-accent/40 bg-accent/10 px-4 py-3 text-sm text-accent-deep"
          role="alert"
          data-cy="book-form-error"
        >
          {state.error}
        </p>
      )}
      {state.success && (
        <p
          className="rounded-md border border-line bg-surface px-4 py-3 text-sm"
          role="status"
          data-cy="book-form-success"
        >
          Modifications enregistrées.
        </p>
      )}

      <div className="flex items-center gap-4 border-t border-line pt-6">
        <Button type="submit" disabled={isPending || verifications > 0} data-cy="book-form-submit">
          {verifications > 0
            ? "Vérification de l'image…"
            : isPending
              ? "Enregistrement…"
              : mode === "create"
                ? "Créer le livre"
                : "Enregistrer"}
        </Button>
      </div>
    </form>
  );
}
