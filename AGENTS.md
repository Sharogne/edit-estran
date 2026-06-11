<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

# Maison d'édition — Site vitrine + Back office

Site vitrine bilingue (**FR** par défaut, **EN**) pour une maison d'édition de livres, avec back
office réservé à un éditeur unique (admin). Hébergement : **VPS OVH** (Node + PM2 + Nginx).

## Stack

| Brique | Choix | Notes |
| --- | --- | --- |
| Framework | Next.js 16 (App Router) + TypeScript strict | `output: "standalone"` pour le déploiement |
| Styles | Tailwind CSS v4 | Tokens dans `src/app/globals.css` via `@theme` — JAMAIS de valeurs en dur |
| Base de données | Prisma 6 + SQLite | Fichier `data/app.db` (dev) — backup = copie de fichier |
| i18n | next-intl v4 | Segment `[locale]`, messages dans `messages/{fr,en}.json` |
| Auth | iron-session + bcryptjs | Cookie chiffré, un seul compte admin (table `AdminUser`) |
| Images | sharp | Variantes WebP générées à l'upload, stockées dans `UPLOADS_DIR` |
| Validation | Zod v4 | Schémas partagés dans `src/lib/validation/` |
| Tests e2e | Cypress | Sélecteurs `data-cy` uniquement, DB de test dédiée (`.env.test`) |

## Carte d'architecture

```
messages/{fr,en}.json          Chaînes UI du site public (TOUT texte public passe par là)
prisma/schema.prisma           Modèles : Book, BookTranslation, BookPreviewPage, AdminUser
prisma/seed.ts                 Seed dev : admin (.env) + livres de démo
scripts/seed-e2e.ts            Seed déterministe pour Cypress (ne pas rendre aléatoire)
src/
  config/site.ts               Identité du site (nom, baseline, contact) — branding centralisé
  i18n/                        routing.ts (locales), request.ts, navigation.ts (Link locale-aware)
  proxy.ts                     Middleware next-intl — matcher EXCLUT /admin /api /uploads
  lib/
    db.ts                      Singleton PrismaClient
    books.ts                   Toutes les requêtes livres (public + admin)
    session.ts                 iron-session : getSession(), requireAdmin()
    uploads.ts                 SEUL module autorisé à toucher le filesystem des uploads
    validation/book.ts         Schémas Zod des formulaires livre
  components/
    ui/                        Primitives du design system (Button, Card, …)
    site/                      Composants du site public (Header, Footer, BookCard, …)
    admin/                     Composants du back office (BookForm, PreviewPagesManager, …)
  app/
    [locale]/                  SITE PUBLIC (html/body ici — layout racine multiple)
      page.tsx                 Accueil
      projets/page.tsx         Liste des projets publiés
      projets/[slug]/page.tsx  Détail d'un livre (cover, synopsis, previews)
    admin/                     BACK OFFICE (hors locale, UI en français, html/body propre)
      login/                   Page + actions login/logout (hors groupe protégé)
      (protected)/             layout.tsx = garde requireAdmin pour tout le groupe
        page.tsx               Dashboard : liste des livres
        livres/actions.ts      TOUTES les server actions livres (CRUD + uploads)
        livres/nouveau/        Création
        livres/[id]/           Édition (previews, suppression)
    uploads/[...path]/route.ts Sert les fichiers de UPLOADS_DIR (Nginx prend le relais en prod)
    sitemap.ts, robots.ts      SEO
cypress/e2e/{public,admin}/    Specs e2e
```

## Commandes

```bash
npm run dev          # Serveur de dev (http://localhost:3000)
npm run build        # Build de production
npm run lint         # ESLint
npm run format       # Prettier --write

npm run db:migrate   # Crée + applique une migration (dev)        [skill: db-migrate]
npm run db:deploy    # Applique les migrations (prod, sans prompt)
npm run db:seed      # Seed dev (admin + livres de démo)
npm run db:studio    # Inspection visuelle de la base

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

### i18n
- Tout texte du site public passe par `messages/fr.json` **et** `messages/en.json` — une clé
  ajoutée dans l'un DOIT exister dans l'autre. Jamais de texte public en dur.
- Le back office (`/admin`) est en français : texte en dur autorisé là-bas uniquement.
- Navigation publique : importer `Link`, `redirect`, `usePathname` depuis `@/i18n/navigation`,
  jamais depuis `next/link` ou `next/navigation` (sauf dans `/admin`).
- Contenu en base : champs traduits dans `BookTranslation` (une ligne par locale).

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

### Sécurité
- Jamais de secret en dur (tout passe par `.env`, voir `.env.example`).
- Uploads : type MIME et taille validés (Zod) ; traitement via `src/lib/uploads.ts` uniquement ;
  noms de fichiers générés (cuid), jamais le nom client ; chemins résolus et confinés sous
  `UPLOADS_DIR` (protection path traversal) dans la route `/uploads`.
- `robots.txt` exclut `/admin`.

## Agents & skills du projet

| Quand… | Utiliser |
| --- | --- |
| Implémenter une feature complète (données → admin → public) | agent `feature-dev` |
| Itérer sur le design (couleurs, typo, layout, composants) | agent `design-implementer` + skill `design-system` |
| Écrire/réparer/exécuter des tests Cypress | agent `e2e-guardian` + skill `run-e2e` |
| Relire des changements avant commit | agent `code-reviewer` |
| Ajouter un champ aux livres (ex. auteur, ISBN, date de parution) | skill `add-book-field` |
| Ajouter une page publique (ex. contact, à-propos) | skill `new-public-page` |
| Toucher au schéma / migrer la base | skill `db-migrate` |
| Déployer ou configurer le VPS OVH | skill `deploy-ovh` |

**Règle d'évolution des piliers** : quand une itération révèle une procédure récurrente non
couverte, créer le skill correspondant (même format) ; quand un skill ment (commande/chemin
obsolète), le corriger DANS la même session. Les piliers doivent toujours refléter la réalité.

## Particularités de la machine de dev (Windows 11)

Deux pièges documentés en détail dans le skill `run-e2e` (section « Pièges machine connus ») :
Smart App Control peut bloquer des DLL natives trop récentes (parade automatique :
`scripts/fix-sharp-wasm.cjs` en postinstall), et les shells lancés depuis VS Code héritent
`ELECTRON_RUN_AS_NODE=1` qui casse Cypress (parade : toujours passer par `npm run cy:run` /
`cy:open`, qui utilisent `scripts/run-cypress.cjs`).
