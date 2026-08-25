---
name: add-book-field
description: Procédure complète pour ajouter un champ aux livres (ex. auteur, ISBN, date de parution, prix, citation). À utiliser dès que l'éditeur veut un nouveau paramètre sur les fiches livres — c'est LA procédure d'évolutivité du projet, du type de données jusqu'aux tests.
---

# Ajouter un champ aux livres

Procédure de bout en bout. Sans base de données, il n'y a **ni schéma ni migration** : le point
de départ est le type TypeScript. Ne JAMAIS sauter les étapes seeds et e2e.

## 0. Décider de l'emplacement du champ

- **Texte lu par les visiteurs et différent selon la langue** (sous-titre, citation, note
  d'intention…) → `StoredTranslation` (une valeur par locale).
- **Donnée indépendante de la langue** (ISBN, date de parution, prix, nombre de pages, auteur…)
  → `StoredBook`.

## 1. Type — `src/lib/content-types.ts`

Ajouter le champ. Le rendre **optionnel (`?`) ou nullable** : les `content.json` déjà écrits ne
le contiennent pas et doivent rester valides.

```ts
// ex. dans StoredBook :        author: string | null;
// ex. dans StoredTranslation : subtitle?: string;
```

Il n'y a pas de migration à jouer : les entrées existantes rendront `undefined` pour ce champ,
d'où l'obligation du `?`/`| null` et d'un fallback à la lecture. Si le champ doit absolument
avoir une valeur partout, écrire un petit script de reprise qui lit, complète et réécrit le
fichier via `mutateContent`.

## 2. Lecture — `src/lib/books.ts`

Ajouter le champ au type de sortie concerné (`PublicBook` pour les listes, `PublicBookDetail`
pour la fiche, `AdminBook` pour le back office) et le mapper dans la ou les fonctions qui le
construisent. Les pages ne connaissent que ces types.

## 3. Validation — `src/lib/validation/book.ts`

Ajouter le champ à `bookFormSchema` (partie commune ou `localeContentSchema`), et à
`bookFormDataToObject` pour qu'il soit lu du `FormData`. C'est ici que vivent les contraintes
réelles (longueur, format, plage de dates…).

## 4. Server actions — `src/app/admin/(protected)/livres/actions.ts`

`createBook` (objet poussé dans `draft.books`) et `updateBook` (`Object.assign`) : ajouter le
champ au mapping. **Attention à l'ordre des clés** dans ces littéraux — un spread placé après
une clé explicite l'écrase (bug déjà vécu avec `status`).

## 5. Formulaire admin — `src/components/admin/BookForm.tsx`

Ajouter l'input avec :
- un `<label>` français explicite,
- `defaultValue` branché sur `BookFormDefaults` (mode édition) — penser à étendre ce type et
  `emptyDefaults`, ainsi que la construction des `defaults` dans `livres/[id]/page.tsx`,
- `data-cy="book-form-<champ>"` (suffixe `-fr` / `-en` si champ traduit, dans chaque volet).

Pour un champ **image**, réutiliser le composant local `ImageField` et ajouter une variante dans
`src/lib/images.ts` plutôt que d'inventer un encodage — et mesurer l'impact sur le poids du JSON.

## 6. Affichage public

- Détail : `src/app/[locale]/projets/[slug]/page.tsx` (+ composants `src/components/site/`).
- Liste/cartes si pertinent : `src/components/site/BookCard.tsx`.
- Si le champ a un libellé visible (« Parution », « ISBN »…) : ajouter la clé dans
  `messages/fr.json` ET `messages/en.json` (section `project`).
- Poser `data-cy="project-<champ>"` sur l'élément affiché.

## 7. Seeds — `scripts/lib/seed-books.ts`

Ajouter le champ à `BookSeedDef`, le mapper dans `buildStoredBook`, et renseigner des valeurs
réalistes pour les 4 livres de `demoBooks`. Les **trois premiers** servent aussi au seed e2e :
leurs valeurs doivent rester FIXES et déterministes.

## 8. Tests e2e

- `cypress/e2e/admin/book-crud.cy.ts` : remplir le champ à la création, vérifier sa
  persistance à l'édition.
- `cypress/e2e/public/project-detail.cy.ts` : vérifier l'affichage public (via le seed).

## 9. Vérification finale

```bash
npm run lint && npm run seed && npm run e2e
```

Suite verte = champ livré. Sinon, corriger avant tout commit.
