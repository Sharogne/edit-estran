---
name: db-migrate
description: Workflow sûr pour modifier le schéma Prisma et migrer la base SQLite, en dev comme en prod (VPS OVH). À utiliser pour tout changement de schema.prisma, problème de migration, drift, ou restauration de la base.
---

# Migrations base de données (Prisma + SQLite)

La base est un FICHIER : `data/app.db` (dev), `/srv/edit/shared/data/app.db` (prod).
Backup = copie du fichier. C'est la force du setup : en profiter systématiquement.

## En développement

```bash
# 1. Éditer prisma/schema.prisma
# 2. Créer + appliquer la migration (régénère aussi le client Prisma) :
npm run db:migrate -- --name <nom_explicite>     # ex. add_book_author
# 3. Mettre à jour les seeds si le modèle change : prisma/seed.ts + scripts/seed-e2e.ts
npm run db:seed                                   # vérifier que le seed passe toujours
```

Règles :
- Nouvelle colonne : TOUJOURS optionnelle (`?`) ou avec `@default` (les lignes existantes
  doivent rester valides).
- Ne JAMAIS éditer une migration déjà committée/appliquée → toujours une nouvelle migration.
- SQLite ne supporte pas les enums Prisma → `String` + validation Zod.
- `prisma db push` est réservé à la DB de test e2e (jetable). Jamais en dev partagé ni en prod.

## En production (VPS OVH)

```bash
# Depuis /srv/edit/app, AVANT toute migration :
cp /srv/edit/shared/data/app.db /srv/edit/shared/data/app.db.bak.$(date +%Y%m%d-%H%M%S)
npm run db:deploy        # prisma migrate deploy : applique les migrations en attente, rien d'autre
pm2 reload edit
```

`migrate deploy` ne demande rien, ne reset jamais, n'applique que les migrations committées —
c'est la SEULE commande de migration autorisée en prod.

## Restauration

```bash
pm2 stop edit
cp /srv/edit/shared/data/app.db.bak.<timestamp> /srv/edit/shared/data/app.db
pm2 start edit
```

(Si la migration fautive est déjà committée, revert du code AVANT de redémarrer.)

## Drift (schéma ≠ migrations)

Symptôme : `migrate dev` propose un reset inattendu. Diagnostiquer SANS accepter le reset :

```bash
npx prisma migrate status
npx prisma migrate diff --from-migrations prisma/migrations --to-schema-datamodel prisma/schema.prisma --script
```

En dev, le reset est acceptable (DB jetable, reseeder ensuite). En prod, ne JAMAIS reset :
restaurer le backup ou réconcilier avec `prisma migrate resolve` en comprenant la cause.

## Changer de moteur plus tard (MySQL/PostgreSQL)

Prisma isole le moteur : changer `datasource` + `DATABASE_URL`, regénérer les migrations sur le
nouveau moteur (`migrate dev` sur base vide), migrer les données (script ou `pg_loader`/outil
ad hoc). Les types `String`-au-lieu-d'enum restent compatibles.
