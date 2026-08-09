"use client";

import Image from "next/image";
import { uploadSrc } from "@/lib/image-src";
import { useActionState } from "react";
import type { BookActionState } from "@/app/admin/(protected)/livres/actions";
import { slugify } from "@/lib/slugify";
import { Button } from "@/components/ui/Button";

export type BookFormDefaults = {
  bookId?: string;
  slug: string;
  status: string;
  publishedAt: string; // "" or "YYYY-MM-DD"
  sortOrder: number;
  coverImage: string | null;
  fr: { title: string; synopsis: string };
  en: { title: string; synopsis: string };
};

const emptyDefaults: BookFormDefaults = {
  slug: "",
  status: "draft",
  publishedAt: "",
  sortOrder: 0,
  coverImage: null,
  fr: { title: "", synopsis: "" },
  en: { title: "", synopsis: "" },
};

const inputClasses =
  "w-full rounded-md border border-line bg-paper px-3 py-2 text-sm text-ink placeholder:text-ink-muted/60 focus:border-ink";
const labelClasses = "mb-1 block text-sm font-medium";
const helpClasses = "mt-1 text-xs text-ink-muted";

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

  // Auto-suggest the slug from the French title (create mode, only while empty).
  function maybeFillSlug(event: React.FocusEvent<HTMLInputElement>) {
    if (mode !== "create") return;
    const form = event.currentTarget.form;
    const slugInput = form?.elements.namedItem("slug") as HTMLInputElement | null;
    if (slugInput && slugInput.value.trim() === "") {
      slugInput.value = slugify(event.currentTarget.value);
    }
  }

  return (
    <form action={formAction} className="mt-8 space-y-10" data-cy="book-form">
      {defaults.bookId && <input type="hidden" name="bookId" value={defaults.bookId} />}

      {/* Contenus FR / EN */}
      <div className="grid gap-8 lg:grid-cols-2">
        <fieldset className="space-y-4">
          <legend className="font-display mb-3 text-lg">Français</legend>
          <div>
            <label htmlFor="title_fr" className={labelClasses}>
              Titre (FR)
            </label>
            <input
              id="title_fr"
              name="title_fr"
              required
              maxLength={200}
              defaultValue={defaults.fr.title}
              onBlur={maybeFillSlug}
              data-cy="book-form-title-fr"
              className={inputClasses}
            />
          </div>
          <div>
            <label htmlFor="synopsis_fr" className={labelClasses}>
              Synopsis (FR)
            </label>
            <textarea
              id="synopsis_fr"
              name="synopsis_fr"
              required
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
          <div>
            <label htmlFor="title_en" className={labelClasses}>
              Titre (EN)
            </label>
            <input
              id="title_en"
              name="title_en"
              required
              maxLength={200}
              defaultValue={defaults.en.title}
              data-cy="book-form-title-en"
              className={inputClasses}
            />
          </div>
          <div>
            <label htmlFor="synopsis_en" className={labelClasses}>
              Synopsis (EN)
            </label>
            <textarea
              id="synopsis_en"
              name="synopsis_en"
              required
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
      <fieldset className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <legend className="font-display mb-3 text-lg">Paramètres</legend>
        <div>
          <label htmlFor="slug" className={labelClasses}>
            Slug (URL)
          </label>
          <input
            id="slug"
            name="slug"
            required
            pattern="[a-z0-9]+(-[a-z0-9]+)*"
            maxLength={120}
            defaultValue={defaults.slug}
            data-cy="book-form-slug"
            className={inputClasses}
          />
          <p className={helpClasses}>minuscules-et-tirets ; ex. les-jardins-suspendus</p>
        </div>
        <div>
          <label htmlFor="status" className={labelClasses}>
            Statut
          </label>
          <select
            id="status"
            name="status"
            defaultValue={defaults.status}
            data-cy="book-form-status"
            className={inputClasses}
          >
            <option value="draft">Brouillon</option>
            <option value="published">Publié</option>
          </select>
          <p className={helpClasses}>Seuls les livres publiés apparaissent sur le site</p>
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
        <div>
          <label htmlFor="sortOrder" className={labelClasses}>
            Ordre d&apos;affichage
          </label>
          <input
            id="sortOrder"
            name="sortOrder"
            type="number"
            min={0}
            max={9999}
            defaultValue={defaults.sortOrder}
            data-cy="book-form-sort-order"
            className={inputClasses}
          />
          <p className={helpClasses}>Du plus petit au plus grand dans le catalogue</p>
        </div>
      </fieldset>

      {/* Couverture (+ previews à la création) */}
      <fieldset className="space-y-4">
        <legend className="font-display mb-3 text-lg">Images</legend>
        <div className="flex items-start gap-6">
          {defaults.coverImage && (
            <div className="relative h-36 w-24 shrink-0 overflow-hidden rounded-sm bg-surface shadow-book">
              <Image
                src={uploadSrc(defaults.coverImage)}
                alt="Couverture actuelle"
                fill
                sizes="96px"
                className="object-cover"
                data-cy="book-form-current-cover"
              />
            </div>
          )}
          <div className="flex-1">
            <label htmlFor="cover" className={labelClasses}>
              {defaults.coverImage ? "Remplacer la couverture" : "Image de couverture"}
            </label>
            <input
              id="cover"
              name="cover"
              type="file"
              accept="image/jpeg,image/png,image/webp,image/avif"
              data-cy="book-form-cover"
              className={`${inputClasses} file:mr-3 file:rounded-md file:border-0 file:bg-ink file:px-3 file:py-1 file:text-xs file:text-paper`}
            />
            <p className={helpClasses}>JPEG, PNG, WebP ou AVIF — 10 Mo max, convertie en WebP</p>
          </div>
        </div>

        {mode === "create" && (
          <div>
            <label htmlFor="previews" className={labelClasses}>
              Pages de preview (plusieurs fichiers possibles)
            </label>
            <input
              id="previews"
              name="previews"
              type="file"
              multiple
              accept="image/jpeg,image/png,image/webp,image/avif"
              data-cy="book-form-previews"
              className={`${inputClasses} file:mr-3 file:rounded-md file:border-0 file:bg-ink file:px-3 file:py-1 file:text-xs file:text-paper`}
            />
            <p className={helpClasses}>L&apos;ordre de sélection devient l&apos;ordre d&apos;affichage (modifiable ensuite)</p>
          </div>
        )}
      </fieldset>

      {state.error && (
        <p className="rounded-md border border-accent/40 bg-accent/10 px-4 py-3 text-sm text-accent-deep" role="alert" data-cy="book-form-error">
          {state.error}
        </p>
      )}
      {state.success && (
        <p className="rounded-md border border-line bg-surface px-4 py-3 text-sm" role="status" data-cy="book-form-success">
          Modifications enregistrées.
        </p>
      )}

      <div className="flex items-center gap-4 border-t border-line pt-6">
        <Button type="submit" disabled={isPending} data-cy="book-form-submit">
          {isPending ? "Enregistrement…" : mode === "create" ? "Créer le livre" : "Enregistrer"}
        </Button>
      </div>
    </form>
  );
}
