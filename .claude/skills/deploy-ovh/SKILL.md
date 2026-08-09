---
name: deploy-ovh
description: Installation initiale du VPS OVH et procédure de déploiement/mise à jour du site en production (Node, PM2, Nginx, SSL, backups). À utiliser pour le premier déploiement, chaque release, ou tout problème serveur.
---

# Déploiement sur VPS OVH

Cible : VPS OVH sous **Ubuntu 24.04 LTS** (ou Debian 12). Architecture serveur :

```
/srv/edit/app/              Le dépôt git (code de l'application)
/srv/edit/shared/data/      app.db (SQLite) — HORS du dépôt, survit aux déploiements
/srv/edit/shared/uploads/   Images uploadées — idem
/srv/edit/backups/          Backups quotidiens (db + uploads)
```

## 1. Installation initiale (une seule fois)

```bash
# --- En root : utilisateur applicatif + pare-feu ---
adduser deploy && usermod -aG sudo deploy
ufw allow OpenSSH && ufw allow 80 && ufw allow 443 && ufw enable

# --- En deploy : Node 22 LTS (NodeSource) + PM2 ---
curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash -
sudo apt-get install -y nodejs nginx certbot python3-certbot-nginx git
sudo npm i -g pm2
pm2 startup   # exécuter la commande affichée (démarrage au boot)

# --- Arborescence + code ---
sudo mkdir -p /srv/edit/{app,shared/data,shared/uploads,backups}
sudo chown -R deploy:deploy /srv/edit
git clone https://github.com/Sharogne/edit-estran.git /srv/edit/app && cd /srv/edit/app

# --- Environnement de prod ---
cp .env.example .env
# Éditer .env :
#   DATABASE_URL="file:/srv/edit/shared/data/app.db"
#   UPLOADS_DIR="/srv/edit/shared/uploads"
#   SESSION_SECRET=<node -e "console.log(require('crypto').randomBytes(32).toString('hex'))">
#   ADMIN_EMAIL / ADMIN_PASSWORD : identifiants réels de l'éditeur
#   NEXT_PUBLIC_SITE_URL="https://<domaine>"

# --- Première mise en service ---
npm ci
npm run db:deploy && npm run db:seed      # migrations + compte admin
npm run build
pm2 start ecosystem.config.cjs && pm2 save
```

### Nginx (`/etc/nginx/sites-available/edit`)

```nginx
server {
    server_name <domaine>;
    client_max_body_size 20m;                      # uploads d'images

    location /uploads/ {                           # fichiers servis par Nginx directement
        alias /srv/edit/shared/uploads/;
        expires 30d;
        add_header Cache-Control "public, immutable";
    }
    location /_next/static/ {
        alias /srv/edit/app/.next/static/;
        expires 365d;
        add_header Cache-Control "public, immutable";
    }
    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

```bash
sudo ln -s /etc/nginx/sites-available/edit /etc/nginx/sites-enabled/
sudo nginx -t && sudo systemctl reload nginx
sudo certbot --nginx -d <domaine>        # SSL Let's Encrypt + renouvellement auto
```

### Backups quotidiens (`crontab -e` en deploy)

```cron
0 3 * * * sqlite3 /srv/edit/shared/data/app.db ".backup /srv/edit/backups/app-$(date +\%F).db" && tar -czf /srv/edit/backups/uploads-$(date +\%F).tar.gz -C /srv/edit/shared uploads && find /srv/edit/backups -mtime +30 -delete
```

(`sudo apt-get install -y sqlite3` si absent. `.backup` est sûr même base ouverte, grâce au WAL.)

## 2. Déployer une mise à jour (à chaque release)

```bash
cd /srv/edit/app
git pull
npm ci
cp /srv/edit/shared/data/app.db /srv/edit/shared/data/app.db.bak.$(date +%Y%m%d-%H%M%S)
npm run db:deploy                 # ne fait rien s'il n'y a pas de nouvelle migration
npm run build
pm2 reload edit                   # reload sans coupure
pm2 logs edit --lines 30          # vérifier le démarrage
```

Vérification post-déploiement : la home répond en https, login admin OK, une image d'upload
s'affiche (teste le chemin Nginx /uploads/).

## 3. Rollback

```bash
cd /srv/edit/app && git log --oneline -5
git checkout <commit_precedent> && npm ci && npm run build && pm2 reload edit
# Si une migration était passée : restaurer le backup db (skill db-migrate, section Restauration)
```

## Notes

- PM2 lance Next directement (`node_modules/next/dist/bin/next start`, voir
  `ecosystem.config.cjs` à la racine) : simple et suffisant pour un VPS mono-app. Pas de
  `output: standalone` — le déploiement garde `node_modules` (requis de toute façon par
  Prisma et le `npm ci` de release).
- SQLite + uploads vivent dans `/srv/edit/shared/` : un `git pull`/`npm ci` ne peut PAS les
  détruire.
- Surveiller : `pm2 monit`, logs Nginx dans `/var/log/nginx/`.
