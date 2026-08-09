# Maison d'édition — Site vitrine & back office

Site vitrine bilingue (FR/EN) pour une maison d'édition, avec back office permettant à
l'éditeur de gérer ses livres (couverture, titre, synopsis traduits, pages de preview, statut
brouillon/publié). Pensé pour être hébergé sur un VPS OVH.

**Stack** : Next.js 16 (App Router) · TypeScript · Tailwind CSS v4 · Prisma 6 + SQLite ·
next-intl · iron-session · sharp · Cypress.

> 📘 La documentation de référence (architecture, conventions, agents & skills Claude Code)
> est dans [AGENTS.md](AGENTS.md). Les procédures opérationnelles sont dans
> [.claude/skills/](.claude/skills/).

## Démarrage rapide

```bash
cp .env.example .env       # puis éditer : SESSION_SECRET, ADMIN_EMAIL, ADMIN_PASSWORD
npm install                # génère aussi le client Prisma (postinstall)
npm run db:migrate         # crée data/app.db et applique les migrations
npm run db:seed            # compte admin (.env) + catalogue de démonstration
npm run dev                # http://localhost:3000
```

- Site public : http://localhost:3000/fr (et `/en`)
- Back office : http://localhost:3000/admin (identifiants du `.env`)

## Commandes

| Commande | Rôle |
| --- | --- |
| `npm run dev` / `build` / `start` | Développement / build prod / serveur prod |
| `npm run lint` / `format` | ESLint / Prettier |
| `npm run db:migrate` | Nouvelle migration (dev) — voir skill `db-migrate` |
| `npm run db:deploy` | Applique les migrations (prod) |
| `npm run db:seed` | Seed admin + livres de démo |
| `npm run db:studio` | Explorer la base |
| `npm run e2e` | Suite Cypress complète headless (DB de test dédiée) |
| `npm run e2e:open` | Cypress interactif sur serveur de dev |

## Tests e2e

21 tests couvrent les parcours essentiels : navigation publique FR/EN, visibilité des livres
publiés (et invisibilité des brouillons), 404, authentification admin, et cycle de vie complet
d'un livre (création avec uploads, édition, gestion des previews, dépublication, suppression).
La suite tourne sur une base et un dossier d'uploads **dédiés au test** (`.env.test`) — vos
données de dev ne sont jamais touchées. Détails : skill `run-e2e`.

## Démo en ligne

<https://sharogne.github.io/edit-estran/> — le site public et une **maquette cliquable** du back
office (login `admin` / `admin`), exportés en statique et publiés à chaque push sur `main`.

Aucun serveur ni base derrière : les données du back office de démo vivent dans le navigateur
du visiteur, et les pages publiques sont figées au build — un livre créé dans la démo n'apparaît
donc pas sur le site public. Mécanique et limites : [demo/README.md](demo/README.md), skill
`static-demo`.

## Déploiement (OVH VPS)

Procédure complète (installation initiale Node/PM2/Nginx/SSL, releases, backups, rollback) :
[.claude/skills/deploy-ovh/SKILL.md](.claude/skills/deploy-ovh/SKILL.md). En résumé pour une
release : `git pull && npm ci && npm run db:deploy && npm run build && pm2 reload edit`.

## Évolutivité

- **Ajouter un champ aux livres** (auteur, ISBN, prix…) : procédure pas-à-pas dans le skill
  `add-book-field` (~10 fichiers, de la migration au test e2e).
- **Ajouter une page publique** : skill `new-public-page`.
- **Itérer sur le design** : tokens centralisés dans `src/app/globals.css` (`@theme`) ; méthode
  et règles dans le skill `design-system` (agent dédié : `design-implementer`).
