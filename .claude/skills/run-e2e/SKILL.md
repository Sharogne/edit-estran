---
name: run-e2e
description: Exécuter et déboguer la suite de tests e2e Cypress (publique + admin). À utiliser pour lancer les tests, comprendre un échec, ou itérer sur une spec. Explique l'orchestration fichier de contenu de test / serveur / Cypress propre au projet.
---

# Lancer & déboguer la suite e2e

## Les deux commandes

```bash
npm run e2e        # Suite COMPLÈTE headless, fidèle à la prod : reseed + build + run
npm run e2e:open   # Itération : reseed + serveur de DEV + Cypress interactif
```

## Ce qui se passe sous le capot

1. `e2e:seed` : `scripts/seed-content.ts --e2e` écrit `data/test-content.json` **de zéro** (wipe
   complet) avec des données DÉTERMINISTES — 2 livres publiés (slugs fixes
   `les-jardins-suspendus`, `cartographie-du-silence`), 1 brouillon (`manuscrit-inacheve`),
   images comprises. Le script refuse de tourner si `CONTENT_FILE` ne contient pas « test ».
2. Tout tourne sous `.env.test` (via `dotenv -e .env.test`) : `CONTENT_FILE=./data/test-content.json`,
   identifiants admin `admin@e2e.local` / `e2e-Password-123`. Ce fichier est committé
   volontairement (aucun vrai secret). Le contenu de dev `data/content.json` n'est JAMAIS touché
   par les tests.
3. Le compte admin n'est pas seedé : il vit dans `.env.test` (`ADMIN_EMAIL` +
   `ADMIN_PASSWORD_HASH_B64`). `cypress.config.ts` y lit aussi `ADMIN_PASSWORD` en clair pour que
   `cy.login()` puisse le taper.
4. `start-server-and-test` attend que http://localhost:3000 réponde avant de lancer Cypress.

## Organisation des specs

```
cypress/e2e/admin/auth.cy.ts             garde d'accès, login/logout, pas d'énumération
cypress/e2e/admin/book-crud.cy.ts        cycle de vie complet (chaîné) + renommage de slug
cypress/e2e/admin/book-validation.cy.ts  unicité du slug, refus des non-images (sans effet de bord)
cypress/e2e/admin/content-store.cy.ts    ce qui est réellement écrit dans content.json (chaîné)
cypress/e2e/public/{home,projects,project-detail}.cy.ts
cypress/e2e/public/i18n.cy.ts            parité fr/en, bascule de langue
cypress/e2e/public/seo.cy.ts             robots.txt, sitemap, /og
```

## Asserter sur le contenu stocké, pas seulement sur le rendu

Sans base de données, une page qui affiche la bonne chose ne prouve pas que la bonne chose a été
écrite. Trois tâches Node (`setupNodeEvents` dans `cypress.config.ts`) lisent le fichier de test :

| Appel                    | Renvoie                                                                                                                        |
| ------------------------ | ------------------------------------------------------------------------------------------------------------------------------ |
| `cy.storedBook(slug)`    | Projection légère d'un livre : statut, champs, taille **décodée** de chaque variante d'image, titres. `null` s'il n'existe pas |
| `cy.task("storedSlugs")` | Tous les slugs du fichier — pour vérifier qu'un cas d'erreur n'a rien créé                                                     |
| `cy.task("messageKeys")` | Les clés aplaties de `fr.json` et `en.json`, pour le test de parité                                                            |

Le fichier est relu à chaque appel : sous `.should()`, l'assertion réessaie donc jusqu'à ce que
l'écriture ait atterri. **Ne jamais renvoyer une data URI telle quelle** depuis une tâche — des
dizaines de Ko qui noieraient le log Cypress ; d'où la projection.

## Specs chaînées et nettoyage

`book-crud` et `content-store` enchaînent leurs tests volontairement : recréer un livre coûte
~3 s d'encodage sharp. La contrepartie, c'est qu'un échec en cours de route laisse un livre
derrière lui. Deux parades, à conserver :

- un `before` / `after` qui appelle `cy.removeBookIfPresent(slug)` ;
- les specs publiques qui comptent des cartes excluent les slugs `cy-`
  (`.not("[data-cy^=book-card-cy-]")`), pour qu'un résidu admin ne les fasse pas tomber en cascade.

## Test de charge

```bash
npm run perf        # seed 50 livres + build + mesures (≈ 2 min, dont ~40 s d'encodage)
```

Le spec vit dans `cypress/perf/`, **hors de `cypress/e2e/`** : il n'est donc jamais exécuté par
`npm run e2e`, qui doit rester rapide. `npm run cy:perf` le relance seul contre un serveur déjà
démarré (utile pour itérer sans re-seeder).

Deux règles à respecter si tu y touches :

- **Images à entropie photographique obligatoire.** `perfBooks()` passe `photoSeed`, ce qui
  bascule `buildStoredBook` sur `photoArtwork()` au lieu du SVG plat. Mesurer avec l'artwork
  géométrique donnerait ~15 fois moins lourd : des chiffres rassurants et faux.
- **Budgets calibrés, pas devinés.** Chaque entrée de `BUDGET` porte en commentaire la valeur
  nominale mesurée. Après un changement qui déplace un chiffre, relancer, constater, et mettre à
  jour la valeur nominale — pas seulement le seuil.

Le récapitulatif chiffré s'affiche à la fin du run via la tâche `log`, même quand tout est vert :
un test de perf qui ne montre pas ses mesures ne sert qu'à moitié.

## Lancer une seule spec (headless)

```bash
npm run e2e:seed && npm run e2e:build
npx start-server-and-test e2e:start http://localhost:3000 "node scripts/run-cypress.cjs run --spec cypress/e2e/admin/book-crud.cy.ts"
```

## Pièges machine connus

- **Cypress lancé depuis VS Code** : l'environnement hérite `ELECTRON_RUN_AS_NODE=1`, ce qui
  fait démarrer Cypress.exe en mode Node pur (erreur « bad option: --smoke-test »). Les scripts
  `cy:run`/`cy:open` passent par `scripts/run-cypress.cjs` qui purge la variable — toujours
  lancer Cypress via les scripts npm, jamais `npx cypress` directement.
- **Smart App Control (Windows)** peut bloquer des DLL natives trop récentes (vécu avec sharp
  0.35.0). `scripts/fix-sharp-wasm.cjs` (postinstall) bascule alors sharp en WebAssembly.
- **Hash admin mangé par dotenv** : si le login échoue avec les bons identifiants, vérifier que
  `.env.test` contient bien `ADMIN_PASSWORD_HASH_B64` (base64) et non un hash bcrypt brut. Les
  chargeurs d'env expandent `$nom`, et `@next/env` ré-expand même ce que `dotenv-cli` a résolu :
  un hash brut est tronqué en silence. Contrôle rapide :
  ```bash
  node -e "const d=require('dotenv').config({path:'.env.test',processEnv:{}}).parsed;const h=Buffer.from(d.ADMIN_PASSWORD_HASH_B64,'base64').toString();console.log(h.length===60?'OK':'CASSÉ',h)"
  ```

## Diagnostic d'un échec, dans l'ordre

1. **Screenshot** : `cypress/screenshots/<spec>/<test>.png` — montre l'état exact à l'échec.
2. **Message d'assertion** : élément introuvable → le `data-cy` a-t-il été renommé/supprimé ?
   (`grep -r "data-cy=\"...\"" src/`)
3. **Seed** : la donnée attendue existe-t-elle dans `scripts/lib/seed-books.ts` ? (un changement
   de forme des données sans mise à jour du seed casse les specs)
4. **Contenu réellement écrit** : inspecter `data/test-content.json` — c'est lisible à l'œil nu.
   ```bash
   node -e "console.log(require('./data/test-content.json').books.map(b=>[b.slug,b.status].join(' ')).join('\n'))"
   ```
5. **Serveur** : port 3000 occupé par un vieux process → le tuer
   (PowerShell : `Get-NetTCPConnection -LocalPort 3000 | % { Stop-Process -Id $_.OwningProcess -Force }`).
6. **Build stale** : si le code a changé depuis le dernier `e2e:build`, rebuilder.

## Régression vs spec obsolète

- Le produit a un bug → NE PAS adapter la spec pour la faire passer : remonter/corriger le bug.
  (Vécu : la spec « dépublie le livre » a révélé un spread qui réécrasait `status` avec son
  ancienne valeur dans `updateBook` — le test avait raison.)
- Après avoir écrit une spec censée protéger quelque chose, **casser volontairement le code une
  fois** pour vérifier qu'elle tombe. Une assertion qui ne rougit jamais ne protège rien.
- Le produit a légitimement changé → adapter la spec ET vérifier les `data-cy` du composant.

## Conventions des specs (rappel)

Sélecteurs `data-cy` uniquement ; pas de `cy.wait(ms)` ; auth via `cy.login()` (cy.session) ;
données du seed = lecture seule pour les specs publiques ; les specs admin qui créent des
livres utilisent des slugs préfixés `cy-` pour ne pas collisionner avec le seed.

Les images étant des data URI, ne jamais comparer un `src` entier dans une assertion : comparer
un extrait (`String(src).slice(0, 200)`), sinon la sortie d'échec est illisible.
