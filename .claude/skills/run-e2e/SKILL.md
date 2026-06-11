---
name: run-e2e
description: Exécuter et déboguer la suite de tests e2e Cypress (publique + admin). À utiliser pour lancer les tests, comprendre un échec, ou itérer sur une spec. Explique l'orchestration DB de test / serveur / Cypress propre au projet.
---

# Lancer & déboguer la suite e2e

## Les deux commandes

```bash
npm run e2e        # Suite COMPLÈTE headless, fidèle à la prod : reseed + build + run
npm run e2e:open   # Itération : reseed + serveur de DEV + Cypress interactif
```

## Ce qui se passe sous le capot

1. `e2e:seed` : supprime les fichiers `data/test.db*` (`scripts/reset-test-db.cjs`, strictement
   limité aux fichiers de test), reconstruit le schéma avec `prisma migrate deploy` (iso-prod :
   valide les migrations committées) puis exécute `scripts/seed-e2e.ts` → données
   DÉTERMINISTES : 2 livres publiés
   (slugs fixes `les-jardins-suspendus`, `cartographie-du-silence`), 1 brouillon
   (`manuscrit-inacheve`), le compte admin de test, et copie les images de fixtures dans
   `data/test-uploads`.
2. Tout tourne sous `.env.test` (via `dotenv -e .env.test`) : `DATABASE_URL=file:../data/test.db`,
   `UPLOADS_DIR=./data/test-uploads`, identifiants admin `admin@e2e.local` / `e2e-Password-123`.
   Ce fichier est committé volontairement (aucun vrai secret). La DB de dev `data/app.db` n'est
   JAMAIS touchée par les tests.
3. `start-server-and-test` attend que http://localhost:3000 réponde avant de lancer Cypress.

## Lancer une seule spec (headless)

```bash
npm run e2e:seed && npm run e2e:build
npx start-server-and-test e2e:start http://localhost:3000 "npx cypress run --spec cypress/e2e/admin/book-crud.cy.ts"
```

## Pièges machine connus

- **Cypress lancé depuis VS Code** : l'environnement hérite `ELECTRON_RUN_AS_NODE=1`, ce qui
  fait démarrer Cypress.exe en mode Node pur (erreur « bad option: --smoke-test »). Les scripts
  `cy:run`/`cy:open` passent par `scripts/run-cypress.cjs` qui purge la variable — toujours
  lancer Cypress via les scripts npm, jamais `npx cypress` directement.
- **Smart App Control (Windows)** peut bloquer des DLL natives trop récentes (vécu avec sharp
  0.35.0). `scripts/fix-sharp-wasm.cjs` (postinstall) bascule alors sharp en WebAssembly.

## Diagnostic d'un échec, dans l'ordre

1. **Screenshot** : `cypress/screenshots/<spec>/<test>.png` — montre l'état exact à l'échec.
2. **Message d'assertion** : élément introuvable → le `data-cy` a-t-il été renommé/supprimé ?
   (`grep -r "data-cy=\"...\"" src/`)
3. **Seed** : la donnée attendue existe-t-elle dans `scripts/seed-e2e.ts` ? (un changement de
   schéma sans mise à jour du seed casse les specs)
4. **Serveur** : port 3000 occupé par un vieux process → le tuer
   (PowerShell : `Get-NetTCPConnection -LocalPort 3000 | % { Stop-Process -Id $_.OwningProcess -Force }`).
5. **Build stale** : si le code a changé depuis le dernier `e2e:build`, rebuilder.

## Régression vs spec obsolète

- Le produit a un bug → NE PAS adapter la spec pour la faire passer : remonter/corriger le bug.
- Le produit a légitimement changé → adapter la spec ET vérifier les `data-cy` du composant.

## Conventions des specs (rappel)

Sélecteurs `data-cy` uniquement ; pas de `cy.wait(ms)` ; auth via `cy.login()` (cy.session) ;
données du seed = lecture seule pour les specs publiques ; les specs admin qui créent des
livres utilisent des slugs préfixés `cy-` pour ne pas collisionner avec le seed.
