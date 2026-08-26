# Maison d'édition — Site vitrine + Back office

Site vitrine bilingue (**FR** par défaut, **EN**) pour une maison d'édition de livres, avec back
office réservé à un éditeur unique (admin). Hébergement : **VPS OVH** (Node + PM2 + Nginx).

> **Variante sans base de données.** Cette branche remplace Prisma + SQLite + le dossier d'uploads
> par **un seul fichier JSON** (`content.json`) qui contient tout : textes ET images (encodées en
> data URI). Conséquences : plus de migrations, une seule chose à sauvegarder, et un déploiement
> qui se résume à un redémarrage. La branche `main` garde la version avec base de données.

## Stack

| Brique | Choix | Notes |
| --- | --- | --- |
| Framework | Next.js 16 (App Router) + TypeScript strict | Serveur Node classique (`next start` derrière PM2) |
| Styles | Tailwind CSS v4 | Tokens dans `src/app/globals.css` via `@theme` — JAMAIS de valeurs en dur |
| Données | Un fichier JSON (`content.json`) | **Aucune base de données.** Backup = copie d'un fichier |
| i18n | next-intl v4 | Segment `[locale]`, messages dans `messages/{fr,en}.json` |
| Auth | iron-session + bcryptjs | Cookie chiffré, un seul compte admin (`ADMIN_EMAIL` + `ADMIN_PASSWORD_HASH_B64` dans `.env`) |
| Images | sharp | Recadrées au **format 2:3**, recompressées en WebP, stockées en data URI dans le JSON — aucun dossier d'uploads. **Servies par la route `/media`**, jamais inline dans le HTML |
| Validation | Zod v4 | Schémas partagés dans `src/lib/validation/` |
| Tests e2e | Cypress | Sélecteurs `data-cy` uniquement, fichier de contenu de test dédié (`.env.test`) |

## Carte d'architecture

```
messages/{fr,en}.json          Chaînes UI du site public (TOUT texte public passe par là)
data/content.json              TOUTES les données du site (textes + images) — hors dépôt
scripts/seed-content.ts        Écrit content.json (dev : catalogue démo ; --e2e : jeu déterministe)
scripts/migrate-media.ts       Ré-encode les images d'un content.json existant (format 2:3, /media)
scripts/hash-password.mjs      Génère la ligne ADMIN_PASSWORD_HASH_B64 à coller dans .env
src/
  config/site.ts               Identité du site (nom, baseline, contact) — branding centralisé
  config/uploads.ts            Limites d'import des images + COVER_RATIO — formulaire / Zod / next.config
  config/content-limits.ts     Longueurs maximales des champs texte — partagées formulaire / Zod
  i18n/                        routing.ts (locales), request.ts, navigation.ts (Link locale-aware)
  proxy.ts                     Middleware next-intl — matcher EXCLUT /admin /api /media /og
  lib/
    content-types.ts           Forme de content.json (StoredBook, ContentFile)
    store.ts                   SEUL module autorisé à toucher content.json (cache + écriture atomique)
    books.ts                   Toutes les requêtes livres (public + admin)
    images.ts                  SEUL module autorisé à encoder/décoder les images (sharp → data URI)
    media.ts                   Adressage des images : variantes, version d'URL, analyse du nom de fichier
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
    media/[id]/[fichier]/      Sert les images décodées (URL versionnée, cache immuable)
    og/[slug]/route.ts         Décode la couverture pour les crawlers — URL STABLE, cf. Données
    sitemap.ts, robots.ts      SEO
```

## Commandes

```bash
npm run dev          # Serveur de dev (http://localhost:3000)
npm run build        # Build de production
npm run lint         # ESLint
npm run format       # Prettier --write

npm run seed         # (Ré)écrit data/content.json avec le catalogue de démonstration
npx tsx scripts/migrate-media.ts           # Rapport de migration des images (rien n'est écrit)
npx tsx scripts/migrate-media.ts --write   # …et l'applique
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
- **La publication est à SENS UNIQUE** : un livre va de brouillon à publié, jamais l'inverse ;
  pour le retirer du site, on le supprime. Le formulaire ne propose donc pas de marche arrière
  (case à cocher tant que le livre est en brouillon, état en lecture seule ensuite), et
  `updateBook` force le statut d'un livre déjà publié (`statutApresEdition`). Motif : une liste
  déroulante laissait croire au retour en brouillon, et React ne resynchronise pas le
  `defaultValue` d'un `<select>` après le `form.reset()` qu'il déclenche à chaque server action —
  la combo réaffichait « Publié » alors que le store disait `draft`, et l'envoi suivant
  republiait le livre sans que personne l'ait demandé.
- **L'adresse publique d'un livre (`slug`) n'est pas saisie** : elle est dérivée du titre FR, à
  défaut du titre EN, et suffixée (`-2`, `-3`) en cas de doublon. Elle suit le titre tant que le
  livre est en brouillon (`status !== "published"`), puis elle est **figée** : une URL déjà
  diffusée ne doit pas casser parce qu'on corrige une coquille. C'est bien le STATUT qui fait foi,
  pas `publishedAt` : cette date est un champ éditorial librement saisi, et s'en servir figeait le
  titre d'un brouillon jamais mis en ligne. Côté formulaire, le titre qui a produit l'adresse
  passe en `readOnly` (jamais `disabled` : un champ désactivé n'est pas envoyé et effacerait le
  titre), et publier demande confirmation. Ces deux garde-fous sont de l'aide à la saisie —
  **la règle est appliquée côté serveur** (`slugFige`).
- **L'ordre du catalogue (`sortOrder`) n'est pas saisi non plus** : il se règle au glisser-déposer
  dans le tableau de bord (action `reorderBooks`). Un livre créé prend le dernier rang.
- **Les images sont stockées dans le JSON mais servies par `/media`**, jamais inline dans le HTML.
  Une data URI dans une page y pèse deux fois (balise `<img>` et charge utile RSC), interdit le
  cache navigateur et désactive le chargement différé (`next/image` force `unoptimized` et
  `isLazy = false` sur toute source `data:`) — ce qui plafonnait la résolution des vignettes. Les
  projections de `books.ts` ne rendent donc QUE des URLs ; le test de charge
  (`cypress/perf/catalogue.cy.ts`) échoue si une data URI réapparaît dans une page.
  L'URL porte une version dérivée de `updatedAt`, ce qui autorise un cache immuable. `/og/[slug]`
  reste à part et garde une adresse STABLE par slug : les plateformes sociales mettent l'image de
  partage en cache, une URL versionnée les ferait re-télécharger à chaque édition et rendrait
  caduc un lien déjà partagé.
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
- **Les couvertures sont au format 2:3**, garanti à l'encodage (`COVER_RATIO`, `src/config/uploads.ts`)
  et non par le CSS. `object-cover` sur un conteneur `aspect-2/3` rognait en silence toute image
  d'un autre format ; le recadrage est désormais décidé par sharp, et le formulaire annonce à
  l'éditeur la part qui sera perdue avant l'envoi.
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
- Images : type MIME et taille validés par Zod ; encodage via `src/lib/images.ts` uniquement.
  Aucun chemin fourni par l'utilisateur n'atteint le filesystem — le seul fichier écrit est
  `content.json`.
- **`/media` ne filtre pas sur le statut** : le back office doit afficher les couvertures des
  brouillons, et un filtre par cookie rendrait la réponse incachable. L'`id` du livre est un UUID
  non devinable et l'URL d'un brouillon n'est jamais publiée : c'est la non-découvrabilité qui
  protège, pas un contrôle d'accès. À revoir si un jour les brouillons doivent être secrets.
- **Longueurs de texte : `src/config/content-limits.ts`, nulle part ailleurs.** Le formulaire en
  dérive son `maxLength` et son compteur, les schémas Zod leur `.max()`. Un plafond recopié à deux
  endroits finit par diverger, et c'est l'éditeur qui l'apprend — en se faisant refuser une saisie
  que le champ avait acceptée.
- **Limites d'import : `src/config/uploads.ts`, nulle part ailleurs.** Le formulaire les applique
  AVANT l'envoi (type, poids, décodage réel du fichier, nombre de pixels) et `next.config.ts` en
  dérive `serverActions.bodySizeLimit`. Motif : les deux échecs qui comptent — dépassement du
  plafond de transport et exception sharp sur un fichier illisible — échappent au formulaire et
  produisent la page d'erreur générique de Next (« A server error occurred »), écran noir qui perd
  la saisie. Toute image encodée passe donc par `encoder()` (livres/actions.ts), qui renvoie un
  message plutôt que de laisser filer l'exception. Côté serveur d'entrée, Nginx doit rester
  au-dessus du plafond de Next (skill `deploy-ovh`), sinon c'est lui qui renvoie un 413.
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
