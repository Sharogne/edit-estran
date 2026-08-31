---
name: design-system
description: Référence du design system du site (tokens, composants, règles) et méthode pour itérer sur le design avec Claude. À lire AVANT toute modification visuelle, et à METTRE À JOUR après chaque itération design validée — c'est l'état documenté du design.
---

# Design system — référence & méthode

Identité : maison d'édition → esthétique **éditoriale** (typographie au premier plan, blancs
généreux, sobriété, le livre est la vedette).

## Où vivent les choses

| Quoi                                      | Où                                                                |
| ----------------------------------------- | ----------------------------------------------------------------- |
| Tokens (couleurs, rayons, ombres, fontes) | `src/app/globals.css`, bloc `@theme`                              |
| Fontes (next/font)                        | `src/styles/fonts.ts` → variables `--font-display`, `--font-sans` |
| Primitives réutilisables                  | `src/components/ui/`                                              |
| Composants du site public                 | `src/components/site/`                                            |
| Composants du back office                 | `src/components/admin/`                                           |
| Identité textuelle (nom, baseline)        | `src/config/site.ts` + `messages/{fr,en}.json`                    |

Tailwind v4 : un token `--color-accent` déclaré dans `@theme` donne les classes `bg-accent`,
`text-accent`, etc. Changer le token rethème tout le site — c'est TOUJOURS la première option.

## État actuel des tokens (à maintenir à jour)

- `--color-paper` : fond principal (blanc cassé chaud) — `--color-ink` : texte principal
- `--color-ink-muted` : texte secondaire — `--color-accent` : accent (terracotta)
- `--color-accent-deep` : accent foncé (hover, liens visités de l'accent)
- `--color-line` : filets/bordures — `--color-surface` : fonds de cartes/encarts
- `--color-paper-inverse` : fond sombre (réservé, pas encore utilisé)
- `--font-display` : Fraunces (titres) — `--font-sans` : Inter (texte courant & UI)
  (variables next/font sous-jacentes : `--font-fraunces`, `--font-inter` dans `src/styles/fonts.ts`)
- `--radius-sm`/`--radius-md`, `--shadow-book` : volontairement discrets (esthétique imprimée)

L'admin utilise les mêmes tokens (pas de second thème à maintenir).

## Règles non négociables

1. Aucune couleur/valeur en dur dans un composant : nouvelle couleur ⇒ nouveau token d'abord.
2. Ne jamais supprimer/renommer un `data-cy` (les tests e2e reposent dessus).
3. Ne pas toucher à la logique (`src/lib/`, `actions.ts`) pendant une itération design.
4. Contraste AA : 4.5:1 texte courant, 3:1 grands titres. Focus visible stylé partout.
5. Tester visuellement : mobile ~375px ET desktop ≥1280px, FR ET EN, états vides
   (livre sans cover, liste vide).

## Méthode d'itération (avec Claude)

1. **Brief** : références concrètes (« les blancs de tel site », « titres comme tel autre »)
   plutôt qu'adjectifs vagues. Capture d'écran de l'existant si possible.
2. **Explorer par variantes** : demander 2-3 ambiances = 2-3 jeux de tokens `@theme` appliqués
   à UNE page (l'accueil), comparer, choisir, puis généraliser.
3. **Itérer en petits diffs** : une intention par itération (« plus d'air dans le hero »),
   re-capture, ajuster.
4. **Vérifier** : `npm run e2e` après une série d'itérations (le design ne doit rien casser).
5. **Capitaliser** : itération validée ⇒ mettre à jour la section « État actuel » ci-dessus
   (tokens, nouveaux composants, partis pris). La session suivante repart d'ici.

Agent dédié : `design-implementer` (périmètre restreint à la couche visuelle).
