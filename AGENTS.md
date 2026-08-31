# Maison d'édition — Site vitrine + Back office

Site vitrine bilingue (**FR** par défaut, **EN**) pour une maison d'édition de livres, avec back
office réservé à un éditeur unique (admin). Hébergement : **VPS OVH** (Node + PM2 + Nginx).

> **Variante sans base de données.** Cette branche remplace Prisma + SQLite + le dossier d'uploads
> par **un seul fichier JSON** (`content.json`) qui contient tout : textes ET images (encodées en
> data URI). Conséquences : plus de migrations, une seule chose à sauvegarder, et un déploiement
> qui se résume à un redémarrage. La branche `main` garde la version avec base de données.

## Stack

| Brique     | Choix                                       | Notes                                                                                        |
| ---------- | ------------------------------------------- | -------------------------------------------------------------------------------------------- |
| Framework  | Next.js 16 (App Router) + TypeScript strict | Serveur Node classique (`next start` derrière PM2)                                           |
| Styles     | Tailwind CSS v4                             | Tokens dans `src/app/globals.css` via `@theme` — JAMAIS de valeurs en dur                    |
| Données    | Un fichier JSON (`content.json`)            | **Aucune base de données.** Backup = copie d'un fichier                                      |
| i18n       | next-intl v4                                | Segment `[locale]`, messages dans `messages/{fr,en}.json`                                    |
| Auth       | iron-session + bcryptjs                     | Cookie chiffré, un seul compte admin (`ADMIN_EMAIL` + `ADMIN_PASSWORD_HASH_B64` dans `.env`) |
| Images     | sharp                                       | Recompressées en WebP puis **inlinées en data URI** dans le JSON — aucun dossier d'uploads   |
| Validation | Zod v4                                      | Schémas partagés dans `src/lib/validation/`                                                  |
| Tests e2e  | Cypress                                     | Sélecteurs `data-cy` uniquement, fichier de contenu de test dédié (`.env.test`)              |

## Carte d'architecture

```
messages/{fr,en}.json          Chaînes UI du site public (TOUT texte public passe par là)
data/content.json              TOUTES les données du site (textes + images) — hors dépôt
scripts/seed-content.ts        Écrit content.json (dev : catalogue démo ; --e2e : jeu déterministe)
scripts/hash-password.mjs      Génère la ligne ADMIN_PASSWORD_HASH_B64 à coller dans .env
src/
  config/site.ts               Identité du site (nom, baseline, contact) — branding centralisé
  i18n/                        routing.ts (locales), request.ts, navigation.ts (Link locale-aware)
  proxy.ts                     Middleware next-intl — matcher EXCLUT /admin /api /og
  lib/
    content-types.ts           Forme de content.json (StoredBook, ContentFile)
    store.ts                   SEUL module autorisé à toucher content.json (cache + écriture atomique)
    books.ts                   Toutes les requêtes livres (public + admin)
    images.ts                  SEUL module autorisé à encoder/décoder les images (sharp → data URI)
    session.ts                 iron-session : getSession(), requireAdmin()
    validation/book.ts         Schémas Zod des formulaires livre
  components/
    ui/                        Primitives du design system (Button, Card, …)
    site/                      Composants du site public (Header, Footer, BookCard, BookCoverFlip…)
    admin/                     Composants du back office (BookForm, StatusBadge, …)
  app/
    [locale]/                  SITE PUBLIC (html/body ici — layout racine multiple)
      page.tsx                 Accueil
      projets/page.tsx         Liste des projets publiés
      projets/[slug]/page.tsx  Détail d'un livre (couverture retournable recto/verso, synopsis)
    admin/                     BACK OFFICE (hors locale, UI en français, html/body propre)
      login/                   Page + actions login/logout (hors groupe protégé)
      (protected)/             layout.tsx = garde requireAdmin pour tout le groupe
        page.tsx               Dashboard : liste des livres
        livres/actions.ts      TOUTES les server actions livres (CRUD + images)
        livres/nouveau/        Création
        livres/[id]/           Édition, suppression
    og/[slug]/route.ts         Décode la couverture pour les crawlers (partages sociaux)
    sitemap.ts, robots.ts      SEO
```

## Commandes

```bash
npm run dev          # Serveur de dev (http://localhost:3000)
npm run build        # Build de production
npm run lint         # ESLint
npm run format       # Prettier --write

npm run seed         # (Ré)écrit data/content.json avec le catalogue de démonstration
node scripts/hash-password.mjs "<mot-de-passe>"   # Ligne ADMIN_PASSWORD_HASH_B64 pour .env

npm run e2e          # Suite Cypress complète headless (seed + build + run)  [skill: run-e2e]
npm run e2e:open     # Cypress interactif contre le serveur de dev
```

## Conventions — NON NÉGOCIABLES

### Code

- TypeScript strict ; pas de `any` non justifié.
- Server Components par défaut ; `"use client"` uniquement quand nécessaire (état, événements).
- Mutations = **Server Actions** dans un fichier `actions.ts` du segment concerné. Jamais de
  route API pour une mutation interne.
- Chaque server action admin commence par `await requireAdmin()` (`src/lib/session.ts`) puis
  valide ses entrées avec Zod. **Aucune exception** — le layout admin ne protège pas les actions.
- Après toute mutation qui touche au contenu public : `revalidatePath` sur les pages concernées
  (`/[locale]`, `/[locale]/projets`, `/[locale]/projets/[slug]`).

### Données

- `content.json` ne se lit et ne s'écrit QUE via `src/lib/store.ts`. Les pages et composants ne
  connaissent que `src/lib/books.ts` — ils ne touchent jamais au store directement.
- Toute écriture passe par `mutateContent()` : les mutations sont sérialisées et le fichier est
  remplacé atomiquement (`.tmp` puis `rename`). Ne jamais muter l'objet rendu par `readContent()`,
  il est partagé.
- Le store garde le fichier en mémoire → **un seul process** (`instances: 1` côté PM2). Un mode
  cluster ferait diverger les caches.
- Le fichier vit HORS du répertoire de build (`CONTENT_FILE`), pour survivre aux déploiements.
- **L'adresse publique d'un livre (`slug`) n'est pas saisie** : elle est dérivée du titre FR, à
  défaut du titre EN, et suffixée (`-2`, `-3`) en cas de doublon. Elle suit le titre tant que le
  livre n'a jamais été publié (`publishedAt === null`), puis elle est **figée** : une URL déjà
  diffusée ne doit pas casser parce qu'on corrige une coquille. Côté formulaire, le titre qui a
  produit l'adresse passe en `readOnly` (jamais `disabled` : un champ désactivé n'est pas envoyé
  et effacerait le titre), et basculer un livre en « Publié » demande confirmation. Ces deux
  garde-fous sont de l'aide à la saisie — **la règle est appliquée côté serveur** (`slugFige`).
- **L'ordre du catalogue (`sortOrder`) n'est pas saisi non plus** : il se règle au glisser-déposer
  dans le tableau de bord (action `reorderBooks`). Un livre créé prend le dernier rang.
- Les pages publiques qui lisent le contenu sont en `export const dynamic = "force-dynamic"`.
  Le rendu ne coûte qu'une lecture mémoire (~10 ms), alors qu'un pré-rendu figé au build
  reservirait le catalogue tel qu'il était au build après tout redémarrage non précédé d'un
  rebuild (crash, reboot, `pm2 restart`). `revalidatePath` reste obligatoire après une
  mutation : il purge le router cache côté client.

### i18n

- Tout texte du site public passe par `messages/fr.json` **et** `messages/en.json` — une clé
  ajoutée dans l'un DOIT exister dans l'autre. Jamais de texte public en dur.
- Le back office (`/admin`) est en français : texte en dur autorisé là-bas uniquement.
- Navigation publique : importer `Link`, `redirect`, `usePathname` depuis `@/i18n/navigation`,
  jamais depuis `next/link` ou `next/navigation` (sauf dans `/admin`).
- Contenu en base : champs traduits dans `StoredBook.translations`, une entrée par locale.

### Design

- Couleurs, typo, rayons, espacements : **uniquement** via les tokens `@theme` de
  `src/app/globals.css`. Un composant ne contient jamais de couleur hex/oklch en dur.
- Primitives réutilisables dans `src/components/ui/` — les pages composent, elles ne stylent pas
  à la main ce qui existe déjà.
- Toute itération design passe par l'agent `design-implementer` et le skill `design-system`.

### Tests

- Tout élément interactif ou assertable porte un attribut **`data-cy`** (kebab-case :
  `data-cy="book-form-title-fr"`). Les specs Cypress ne sélectionnent QUE via `data-cy`.
- Toute feature livrée = spec e2e mise à jour ou créée. La suite `npm run e2e` doit être verte
  avant de considérer un travail terminé.
- Ce qui touche au contenu stocké s'asserte sur `content.json`, pas seulement sur le rendu :
  tâches `storedBook` / `storedSlugs` (`cypress.config.ts`), exposées via `cy.storedBook()`.
- Les specs admin qui créent des livres utilisent des slugs préfixés `cy-` et se nettoient dans
  un `before`/`after` (`cy.removeBookIfPresent`) — un échec ne doit pas contaminer le run suivant.

### Sécurité

- Jamais de secret en dur (tout passe par `.env`, voir `.env.example`). Le mot de passe admin
  n'existe QUE sous forme de hash bcrypt, base64-encodé (`ADMIN_PASSWORD_HASH_B64`) — jamais
  en clair, jamais commité.
- Le base64 n'est pas cosmétique : un hash bcrypt est truffé de `$`, et les chargeurs d'env
  expandent `$nom`. `@next/env` ré-expand même ce que `dotenv-cli` a déjà résolu, ce qui
  tronque un hash brut en silence et fait échouer le login sans message. Toujours coller la
  sortie de `scripts/hash-password.mjs`, jamais un hash à la main.
- Images : type MIME et taille validés par Zod (10 Mo max) ; encodage via `src/lib/images.ts`
  uniquement. Aucun chemin fourni par l'utilisateur n'atteint le filesystem — le seul fichier
  écrit est `content.json`.
- `robots.txt` exclut `/admin`.

## Agents & skills du projet

| Quand…                                                           | Utiliser                                           |
| ---------------------------------------------------------------- | -------------------------------------------------- |
| Implémenter une feature complète (données → admin → public)      | agent `feature-dev`                                |
| Itérer sur le design (couleurs, typo, layout, composants)        | agent `design-implementer` + skill `design-system` |
| Écrire/réparer/exécuter des tests Cypress                        | agent `e2e-guardian` + skill `run-e2e`             |
| Relire des changements avant commit                              | agent `code-reviewer`                              |
| Ajouter un champ aux livres (ex. auteur, ISBN, date de parution) | skill `add-book-field`                             |
| Ajouter une page publique (ex. contact, à-propos)                | skill `new-public-page`                            |
| Déployer ou configurer le VPS OVH                                | skill `deploy-ovh`                                 |

**Règle d'évolution des piliers** : quand une itération révèle une procédure récurrente non
couverte, créer le skill correspondant (même format) ; quand un skill ment (commande/chemin
obsolète), le corriger DANS la même session. Les piliers doivent toujours refléter la réalité.

## Particularités de la machine de dev (Windows 11)

Deux pièges documentés en détail dans le skill `run-e2e` (section « Pièges machine connus ») :
Smart App Control peut bloquer des DLL natives trop récentes (parade automatique :
`scripts/fix-sharp-wasm.cjs` en postinstall), et les shells lancés depuis VS Code héritent
`ELECTRON_RUN_AS_NODE=1` qui casse Cypress (parade : toujours passer par `npm run cy:run` /
`cy:open`, qui utilisent `scripts/run-cypress.cjs`).
