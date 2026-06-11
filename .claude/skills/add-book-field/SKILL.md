---
name: add-book-field
description: Procédure complète pour ajouter un champ aux livres (ex. auteur, ISBN, date de parution, prix, citation). À utiliser dès que l'éditeur veut un nouveau paramètre sur les fiches livres — c'est LA procédure d'évolutivité du projet, de la base de données jusqu'aux tests.
---

# Ajouter un champ aux livres

Procédure de bout en bout (~10 fichiers, tous listés). Ne JAMAIS sauter les étapes seeds et e2e.

## 0. Décider de l'emplacement du champ

- **Texte lu par les visiteurs et différent selon la langue** (sous-titre, citation, note
  d'intention…) → `BookTranslation` (une valeur FR + une valeur EN).
- **Donnée indépendante de la langue** (ISBN, date de parution, prix, nombre de pages, auteur…)
  → `Book`.
- Donnée ponctuelle/expérimentale qu'on ne veut pas encore figer → champ JSON `extras` de
  `Book` (pas de migration, mais pas de garantie de type — à régulariser si ça devient pérenne).

## 1. Schéma — `prisma/schema.prisma`

Ajouter la colonne (TOUJOURS optionnelle `?` ou avec `@default` : les livres existants doivent
rester valides). SQLite : pas d'enum → `String` + contrainte Zod.

```prisma
// ex. dans Book :        author  String?
// ex. dans BookTranslation : subtitle String?
```

## 2. Migration

```bash
npm run db:migrate -- --name add_book_<champ>
```

Vérifier que le dossier `prisma/migrations/<timestamp>_add_book_<champ>/` est créé. Ne jamais
modifier une migration déjà appliquée/committée.

## 3. Validation — `src/lib/validation/book.ts`

Ajouter le champ au(x) schéma(s) Zod (`bookFormSchema` : partie commune ou partie par-locale).
C'est ici que vivent les contraintes réelles (longueur, format, plage de dates…).

## 4. Server actions — `src/app/admin/livres/actions.ts`

Les actions `createBook`/`updateBook` mappent le résultat Zod vers Prisma : ajouter le champ au
mapping (données `Book`) ou au bloc translations (données `BookTranslation`).

## 5. Formulaire admin — `src/components/admin/BookForm.tsx`

Ajouter l'input avec :
- un `<label>` français explicite,
- `defaultValue` branché sur le livre existant (mode édition),
- `data-cy="book-form-<champ>"` (suffixe `-fr` / `-en` si champ traduit, dans chaque volet).

## 6. Affichage public

- Détail : `src/app/[locale]/projets/[slug]/page.tsx` (+ composants `src/components/site/`).
- Liste/cartes si pertinent : `src/components/site/BookCard.tsx`.
- Si le champ a un libellé visible (« Parution », « ISBN »…) : ajouter la clé dans
  `messages/fr.json` ET `messages/en.json` (section `project`).
- Poser `data-cy="project-<champ>"` sur l'élément affiché.

## 7. Seeds

- `prisma/seed.ts` : valeurs réalistes pour les livres de démo.
- `scripts/seed-e2e.ts` : valeurs FIXES (déterministes) pour les livres de test.

## 8. Tests e2e

- `cypress/e2e/admin/book-crud.cy.ts` : remplir le champ à la création, vérifier sa
  persistance à l'édition.
- `cypress/e2e/public/project-detail.cy.ts` : vérifier l'affichage public (via le seed).

## 9. Vérification finale

```bash
npm run lint && npm run db:seed && npm run e2e
```

Suite verte = champ livré. Sinon, corriger avant tout commit.
