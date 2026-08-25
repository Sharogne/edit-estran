# Maison d'édition — Site vitrine & back office

Site vitrine bilingue (FR/EN) pour une maison d'édition, avec back office permettant à
l'éditeur de gérer ses livres (couverture, 4ème de couverture, titre, synopsis traduits, statut
brouillon/publié). Pensé pour être hébergé sur un VPS OVH.

> **Variante sans base de données.** Toutes les données du site — textes **et** images — tiennent
> dans un seul fichier JSON. Pas de SQLite, pas de migrations, pas de dossier d'uploads : une
> sauvegarde, c'est la copie d'un fichier. La branche `main` garde la version Prisma + SQLite.

**Stack** : Next.js 16 (App Router) · TypeScript · Tailwind CSS v4 · fichier JSON ·
next-intl · iron-session · sharp · Cypress.

> 📘 La documentation de référence (architecture, conventions, agents & skills Claude Code)
> est dans [AGENTS.md](AGENTS.md). Les procédures opérationnelles sont dans
> [.claude/skills/](.claude/skills/).

## Démarrage rapide

```bash
cp .env.example .env                            # puis éditer SESSION_SECRET et ADMIN_EMAIL
node scripts/hash-password.mjs "<mot-de-passe>" # coller la ligne obtenue dans .env
npm install
npm run seed                                    # écrit data/content.json (catalogue de démo)
npm run dev                                     # http://localhost:3000
```

- Site public : http://localhost:3000/fr (et `/en`)
- Back office : http://localhost:3000/admin (identifiants du `.env`)

## Comment les données sont stockées

Un fichier, désigné par `CONTENT_FILE` (`./data/content.json` en dev) :

```json
{
  "version": 1,
  "books": [
    {
      "id": "…", "slug": "les-jardins-suspendus", "status": "published",
      "coverThumb": "data:image/webp;base64,…",
      "coverImage": "data:image/webp;base64,…",
      "backCoverImage": "data:image/webp;base64,…",
      "translations": { "fr": { "title": "…", "synopsis": "…" }, "en": { … } }
    }
  ]
}
```

Les images uploadées sont recompressées en WebP par sharp puis encodées **dans le fichier**, en
trois variantes : une miniature 320 px pour les pages de liste, et deux images 900 px pour le
recto et le verso affichés sur la fiche du livre. Il n'y a donc aucun fichier image sur le
disque, et rien à nettoyer quand un livre est supprimé.

Ordre de grandeur : ~15 à 25 Ko par livre avec les visuels de démonstration, jusqu'à ~250 Ko par
variante pour de vraies photographies (plafond appliqué à l'encodage). Le modèle reste confortable
jusqu'à une cinquantaine de titres ; au-delà, il faudra ressortir les images du JSON.

## Commandes

| Commande | Rôle |
| --- | --- |
| `npm run dev` / `build` / `start` | Développement / build prod / serveur prod |
| `npm run lint` / `format` | ESLint / Prettier |
| `npm run seed` | (Ré)écrit `data/content.json` avec le catalogue de démo |
| `node scripts/hash-password.mjs "…"` | Génère `ADMIN_PASSWORD_HASH_B64` pour `.env` |
| `npm run e2e` | Suite Cypress complète headless (fichier de contenu de test dédié) |
| `npm run e2e:open` | Cypress interactif sur serveur de dev |

## Tests e2e

**41 tests** répartis en neuf specs, sur un fichier de contenu **dédié au test**
(`.env.test` → `data/test-content.json`) — vos données de dev ne sont jamais touchées.

| Spec | Ce qu'elle protège |
| --- | --- |
| `admin/auth` | Garde d'accès sur toutes les pages du back office, absence d'énumération de compte |
| `admin/book-crud` | Cycle de vie complet d'un livre, dont le renommage de slug |
| `admin/book-validation` | Unicité du slug et refus des fichiers non-images — les garanties que la base assurait avant |
| `admin/content-store` | Ce qui est **réellement écrit** dans `content.json` : trois variantes WebP inline, forme de l'entrée, absence de verso |
| `public/home`, `public/projects`, `public/project-detail` | Navigation, visibilité des publiés, invisibilité des brouillons, carte retournable, accessibilité |
| `public/i18n` | Parité stricte des clés `fr.json`/`en.json`, bascule de langue |
| `public/seo` | `robots.txt`, sitemap sans brouillon, image OpenGraph décodée |

Deux tâches Node (`cypress.config.ts`) permettent d'asserter sur le fichier de contenu
lui-même plutôt que sur le rendu : sans base de données, c'est le seul moyen de vérifier ce qui
est vraiment persisté. Détails : skill `run-e2e`.

## Déploiement (OVH VPS)

Procédure complète (installation initiale Node/PM2/Nginx/SSL, releases, backups, rollback) :
[.claude/skills/deploy-ovh/SKILL.md](.claude/skills/deploy-ovh/SKILL.md). En résumé pour une
release : `git pull && npm ci && npm run build && pm2 reload edit` — il n'y a plus de migration
à jouer.

Deux points d'attention : `CONTENT_FILE` doit pointer hors du répertoire de release
(`/srv/edit/shared/content.json`), et PM2 doit rester en `instances: 1` (le store garde le
fichier en mémoire).

Les pages publiques sont rendues à la demande plutôt que figées au build : lire le catalogue
coûte une lecture mémoire (~10 ms), et un redémarrage sans rebuild ne fait donc perdre aucun
livre publié depuis le dernier déploiement.

## Évolutivité

- **Ajouter un champ aux livres** (auteur, ISBN, prix…) : procédure pas-à-pas dans le skill
  `add-book-field` — sans base de données, cela se réduit au type, au schéma Zod, au formulaire
  et à l'affichage.
- **Ajouter une page publique** : skill `new-public-page`.
- **Itérer sur le design** : tokens centralisés dans `src/app/globals.css` (`@theme`) ; méthode
  et règles dans le skill `design-system` (agent dédié : `design-implementer`).
