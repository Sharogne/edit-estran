"use client";

import Image from "next/image";
import { useActionState, useRef, useState } from "react";
import type { BookActionState } from "@/app/admin/(protected)/livres/actions";
import {
  ALLOWED_IMAGE_TYPES,
  COVER_RATIO,
  MAX_IMAGE_BYTES,
  MAX_IMAGE_PIXELS,
} from "@/config/uploads";
import {
  MAX_PURCHASE_URL_CHARS,
  MAX_SYNOPSIS_CHARS,
  MAX_TITLE_CHARS,
  SEUIL_ALERTE,
} from "@/config/content-limits";
import { Button } from "@/components/ui/Button";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";

export type BookFormDefaults = {
  bookId?: string;
  slug: string;
  status: string;
  publishedAt: string; // "" or "YYYY-MM-DD"
  coverCard: string | null;
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
  coverCard: null,
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
const avertClasses = "mt-1 text-xs text-accent";
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

/** En deçà, le rognage ne se remarque pas : prévenir ferait du bruit. */
const SEUIL_CADRAGE = 0.15;

/**
 * Part de l'image qui sera rognée pour tenir au format 2:3 des couvertures.
 *
 * Le recadrage se décide à l'encodage (src/lib/images.ts) et l'éditeur ne le
 * découvrirait qu'une fois l'image enregistrée. Ce n'est pas une faute — une
 * photo de couverture n'est pas toujours calibrée — donc un avertissement
 * chiffré avant l'envoi, jamais un refus.
 */
function avertissementCadrage(taille: { width: number; height: number }): string {
  const ratio = taille.width / taille.height;
  const perte =
    ratio > COVER_RATIO
      ? 1 - COVER_RATIO / ratio // trop large : les côtés sautent
      : 1 - ratio / COVER_RATIO; // trop haute : le bas saute
  if (perte < SEUIL_CADRAGE) return "";
  const sens = ratio > COVER_RATIO ? "sur les côtés" : "en bas";
  return (
    `Format ${taille.width} × ${taille.height} : environ ${Math.round(perte * 100)} % de ` +
    `l'image sera rogné ${sens} pour tenir au format 2:3 des couvertures. ` +
    "Recadrez-la vous-même avant de l'envoyer si ce résultat ne vous convient pas."
  );
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
async function analyserFichier(file: File): Promise<{ erreur: string; avertissement: string }> {
  const refus = (erreur: string) => ({ erreur, avertissement: "" });
  if (!ALLOWED_IMAGE_TYPES.includes(file.type)) {
    const type = file.type ? ` (${file.type})` : "";
    return refus(`Format non supporté${type}. Formats acceptés : JPEG, PNG, WebP ou AVIF.`);
  }
  if (file.size > MAX_IMAGE_BYTES) {
    return refus(
      `Image trop lourde : ${mo(file.size)} Mo pour ${MAX_IMAGE_MO} Mo maximum. Réduisez-la avant de la déposer.`
    );
  }

  const taille = await dimensionsImage(file);
  if (taille === null) {
    return refus(
      "Image illisible : le fichier est abîmé, ou son contenu ne correspond pas à son extension. " +
        "Ouvrez-le puis ré-enregistrez-le en JPEG ou PNG."
    );
  }
  if (taille && taille.width * taille.height > MAX_IMAGE_PIXELS) {
    return refus(
      `Image trop grande : ${taille.width} × ${taille.height} pixels, soit plus de ${mpx(MAX_IMAGE_PIXELS)} millions. Réduisez ses dimensions avant de la déposer.`
    );
  }
  return { erreur: "", avertissement: taille ? avertissementCadrage(taille) : "" };
}

/** One file input, with a thumbnail of the image currently stored (if any). */
function ImageField({
  name,
  cy,
  label,
  current,
  currentAlt,
  erreur,
  avertissement,
  onFichier,
}: {
  name: string;
  cy: string;
  label: string;
  current: string | null;
  currentAlt: string;
  erreur?: string;
  avertissement?: string;
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
        {!erreur && avertissement && (
          <p className={avertClasses} role="status" data-cy={`book-form-warning-${cy}`}>
            {avertissement}
          </p>
        )}
      </div>
    </div>
  );
}

/**
 * Synopsis d'une langue, avec son compteur.
 *
 * Le champ reste NON contrôlé, comme tout le formulaire : l'état ne porte que
 * la longueur, puisque c'est le compteur qui doit se re-rendre, pas la saisie.
 * `valeur` sert aussi de repère de resynchronisation — React réinitialise le
 * formulaire après chaque server action, donc le textarea revient à la valeur
 * du serveur, et sans cela le compteur resterait sur le décompte d'avant envoi.
 *
 * Le décompte peut dépasser le plafond : `maxLength` empêche d'en saisir plus,
 * pas d'en afficher un qui a été stocké quand la limite était plus haute. Mieux
 * vaut le montrer que de refuser l'enregistrement sans que rien ne l'ait annoncé.
 */
function ChampSynopsis({
  locale,
  label,
  valeur,
}: {
  locale: "fr" | "en";
  label: string;
  valeur: string;
}) {
  const [longueur, setLongueur] = useState(valeur.length);
  const [valeurServeur, setValeurServeur] = useState(valeur);
  if (valeurServeur !== valeur) {
    setValeurServeur(valeur);
    setLongueur(valeur.length);
  }

  const restant = MAX_SYNOPSIS_CHARS - longueur;
  const alerte = longueur >= MAX_SYNOPSIS_CHARS * SEUIL_ALERTE;

  return (
    <div>
      <label htmlFor={`synopsis_${locale}`} className={labelClasses}>
        {label}
      </label>
      <textarea
        id={`synopsis_${locale}`}
        name={`synopsis_${locale}`}
        rows={7}
        maxLength={MAX_SYNOPSIS_CHARS}
        defaultValue={valeur}
        onInput={(event) => setLongueur(event.currentTarget.value.length)}
        aria-describedby={`compteur_synopsis_${locale}`}
        data-cy={`book-form-synopsis-${locale}`}
        className={inputClasses}
      />
      <p
        id={`compteur_synopsis_${locale}`}
        className={alerte ? errorClasses : helpClasses}
        data-cy={`book-form-synopsis-${locale}-compteur`}
      >
        {longueur} / {MAX_SYNOPSIS_CHARS} caractères
        {restant < 0
          ? ` — ${-restant} de trop, l'enregistrement sera refusé`
          : alerte
            ? ` — il en reste ${restant}`
            : ""}
      </p>
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
  const [avertissementsFichier, setAvertissementsFichier] = useState<Record<string, string>>({});
  // Le décodage d'une image est asynchrone : sans ce compteur, un envoi lancé
  // dans la foulée du choix de fichier partirait avant le verdict.
  const [verifications, setVerifications] = useState(0);
  // Le titre du livre au moment de la demande — null quand aucune question
  // n'est posée. Il sert à la fois d'interrupteur et de contenu du dialogue.
  const [titrePublication, setTitrePublication] = useState<string | null>(null);
  const casePublier = useRef<HTMLInputElement>(null);

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
   * Publier est définitif : le livre part en ligne ET son titre se fige, puisque
   * l'adresse publique en découle. Deux conséquences lourdes et invisibles, dont
   * une sans marche arrière — on les fait donc confirmer explicitement, au même
   * niveau que la suppression d'un livre.
   *
   * Le dialogue répond de façon asynchrone, contrairement au window.confirm
   * qu'il remplace : la case est donc DÉCOCHÉE le temps de la question, et
   * cochée seulement si l'éditeur confirme. L'inverse laisserait, l'espace d'un
   * rendu, une case qui affirme une publication qui n'a pas été décidée.
   */
  function demanderPublication(event: React.ChangeEvent<HTMLInputElement>) {
    if (!event.target.checked) return;
    event.target.checked = false;

    const champs = event.target.form?.elements;
    const titreFr = (champs?.namedItem("title_fr") as HTMLInputElement | null)?.value.trim();
    const titreEn = (champs?.namedItem("title_en") as HTMLInputElement | null)?.value.trim();
    setTitrePublication(titreFr || titreEn || "ce livre");
  }

  async function verifierFichier(name: string, input: HTMLInputElement) {
    const file = input.files?.[0];
    if (!file) {
      setErreursFichier((precedent) => ({ ...precedent, [name]: "" }));
      setAvertissementsFichier((precedent) => ({ ...precedent, [name]: "" }));
      return;
    }
    setVerifications((nombre) => nombre + 1);
    try {
      const { erreur, avertissement } = await analyserFichier(file);
      // Vider l'input : sans ça le fichier refusé partirait quand même à l'envoi.
      if (erreur) input.value = "";
      setErreursFichier((precedent) => ({ ...precedent, [name]: erreur }));
      setAvertissementsFichier((precedent) => ({ ...precedent, [name]: avertissement }));
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
              maxLength={MAX_TITLE_CHARS}
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
          <ChampSynopsis locale="fr" label="Synopsis (FR)" valeur={defaults.fr.synopsis} />
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
              maxLength={MAX_TITLE_CHARS}
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
          <ChampSynopsis locale="en" label="Synopsis (EN)" valeur={defaults.en.synopsis} />
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
        {/*
          Publication à SENS UNIQUE. Un livre en ligne ne redevient pas un
          brouillon : le retirer, c'est le supprimer. D'où deux rendus exclusifs
          plutôt qu'une liste déroulante — il n'y a pas de choix à reprendre une
          fois qu'il est fait, et un contrôle qui laisserait croire le contraire
          republierait le livre au premier enregistrement suivant.
        */}
        <div>
          <span className={labelClasses}>Statut</span>
          {defaults.status === "published" ? (
            <>
              <input type="hidden" name="status" value="published" data-cy="book-form-status" />
              <p className={verrouilleClasses} data-cy="book-form-status-publie">
                Publié — définitif
              </p>
              <p className={helpClasses}>
                Le livre est en ligne. La publication ne se défait pas : pour le retirer du site,
                supprimez-le depuis la zone dangereuse, en bas de page.
              </p>
            </>
          ) : (
            <>
              <label
                htmlFor="status"
                className={`${inputClasses} flex cursor-pointer items-center gap-2`}
              >
                <input
                  id="status"
                  name="status"
                  type="checkbox"
                  value="published"
                  defaultChecked={false}
                  ref={casePublier}
                  onChange={demanderPublication}
                  data-cy="book-form-status"
                />
                Publier ce livre
              </label>
              <p className={helpClasses}>
                Brouillon tant que la case n&apos;est pas cochée : le livre n&apos;apparaît pas sur
                le site. La publication est définitive et fige le titre.
              </p>
            </>
          )}
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
            maxLength={MAX_PURCHASE_URL_CHARS}
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
            label={defaults.coverCard ? "Remplacer la couverture" : "Image de couverture"}
            current={defaults.coverCard}
            currentAlt="Couverture actuelle"
            erreur={erreursFichier.cover}
            avertissement={avertissementsFichier.cover}
            onFichier={verifierFichier}
          />
          {/*
            L'aperçu du verso pointe sur la variante pleine taille, faute d'en
            avoir une au format carte. C'était un vrai coût quand les images
            étaient inlinées dans le HTML ; depuis qu'elles passent par /media,
            c'est une requête mise en cache et l'écart ne se paie plus.
          */}
          <ImageField
            name="backCover"
            cy="back-cover"
            label={
              defaults.backCoverImage ? "Remplacer le 4e de couverture" : "4e de couverture (verso)"
            }
            current={defaults.backCoverImage}
            currentAlt="4e de couverture actuel"
            erreur={erreursFichier.backCover}
            avertissement={avertissementsFichier.backCover}
            onFichier={verifierFichier}
          />
        </div>
        <p className={helpClasses}>
          JPEG, PNG, WebP ou AVIF — {MAX_IMAGE_MO} Mo max. Les images sont recadrées au format 2:3
          des couvertures, recompressées en WebP, puis servies depuis le contenu du site : inutile
          de les optimiser avant.
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

      <ConfirmDialog
        ouvert={titrePublication !== null}
        titre={`Publier « ${titrePublication} » ?`}
        confirmer="Publier"
        cy="publish"
        onAnnuler={() => setTitrePublication(null)}
        onConfirmer={() => {
          if (casePublier.current) casePublier.current.checked = true;
          setTitrePublication(null);
        }}
      >
        <p>
          Le livre deviendra visible sur le site. Cette action est définitive : pour l&apos;en
          retirer, il faudra le supprimer.
        </p>
        <p>
          Son titre ne sera plus modifiable, car l&apos;adresse publique en découle et la changer
          casserait les liens déjà partagés.
        </p>
        <p>La publication ne prendra effet qu&apos;à l&apos;enregistrement du formulaire.</p>
      </ConfirmDialog>

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
