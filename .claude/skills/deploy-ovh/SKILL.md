---
name: deploy-ovh
description: Installation initiale du VPS OVH et procédure de déploiement/mise à jour du site en production (Node, PM2, Nginx, SSL, backups). À utiliser pour le premier déploiement, chaque release, ou tout problème serveur.
---

# Déploiement sur VPS OVH

Cible : VPS OVH sous **Ubuntu 24.04 LTS** (ou Debian 12). Architecture serveur :

```
/srv/edit/app/                  Le dépôt git (code de l'application)
/srv/edit/shared/content.json   TOUTES les données du site — HORS du dépôt, survit aux déploiements
/srv/edit/backups/              Copies datées de content.json
```

Il n'y a **ni base de données ni dossier d'uploads** : textes et images vivent dans le même
fichier JSON. Un backup, c'est la copie de ce fichier ; un déploiement ne touche jamais aux
données.

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
sudo mkdir -p /srv/edit/{app,shared,backups}
sudo chown -R deploy:deploy /srv/edit
git clone https://github.com/Sharogne/edit-estran.git /srv/edit/app && cd /srv/edit/app

# --- Environnement de prod ---
cp .env.example .env
node scripts/hash-password.mjs "<mot-de-passe-de-l-éditeur>"   # colle la ligne dans .env
# Éditer .env :
#   CONTENT_FILE="/srv/edit/shared/content.json"
#   SESSION_SECRET=<node -e "console.log(require('crypto').randomBytes(32).toString('hex'))">
#   ADMIN_EMAIL=<adresse réelle de l'éditeur>
#   ADMIN_PASSWORD_HASH_B64=<sortie de hash-password.mjs, telle quelle>
#   NEXT_PUBLIC_SITE_URL="https://<domaine>"

# --- Première mise en service ---
npm ci
npm run build
pm2 start ecosystem.config.cjs && pm2 save
```

Pas de seed en production : `content.json` n'existe pas encore, le site démarre avec un
catalogue vide et l'éditeur crée ses livres depuis `/admin`. Le fichier est créé à la première
sauvegarde. (`npm run seed` écrirait le catalogue de démonstration — à ne lancer qu'en dev.)

### Nginx (`/etc/nginx/sites-available/edit`)

```nginx
server {
    server_name <domaine>;
    client_max_body_size 20m;                      # uploads d'images (10 Mo par fichier)

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

Il n'y a plus de `location /uploads/` : les images sont servies **dans le HTML** (data URI). Seul
`/og/<slug>` renvoie une vraie réponse image, pour les crawlers — elle passe par Node, sans
configuration particulière.

```bash
sudo ln -s /etc/nginx/sites-available/edit /etc/nginx/sites-enabled/
sudo nginx -t && sudo systemctl reload nginx
sudo certbot --nginx -d <domaine>        # SSL Let's Encrypt + renouvellement auto
```

### Backups quotidiens (`crontab -e` en deploy)

```cron
0 3 * * * cp /srv/edit/shared/content.json /srv/edit/backups/content-$(date +\%F).json && find /srv/edit/backups -mtime +30 -delete
```

`cp` suffit et reste sûr même pendant une écriture : l'application écrit dans un fichier `.tmp`
puis fait un `rename` atomique, donc `content.json` n'est jamais dans un état partiel.

## 2. Déployer une mise à jour (à chaque release)

```bash
cd /srv/edit/app
git pull
npm ci
npm run build
pm2 reload edit                   # reload sans coupure
pm2 logs edit --lines 30          # vérifier le démarrage
```

Aucune migration à jouer, aucune donnée à toucher. Vérification post-déploiement : la home
répond en https, le login admin fonctionne, une fiche livre affiche sa couverture et se retourne
au clic.

## 3. Rollback

```bash
cd /srv/edit/app && git log --oneline -5
git checkout <commit_precedent> && npm ci && npm run build && pm2 reload edit
```

Les données ne bougeant pas avec le code, un rollback est purement applicatif. Pour restaurer
un contenu perdu (mauvaise manipulation dans le back office) :

```bash
pm2 stop edit
cp /srv/edit/backups/content-<date>.json /srv/edit/shared/content.json
pm2 start edit          # le cache mémoire est reconstruit au démarrage
```

Toujours arrêter le process avant de remplacer le fichier à la main : le store le garde en
mémoire et le réécrirait par-dessus à la prochaine sauvegarde.

## Notes

- PM2 lance Next directement (`node_modules/next/dist/bin/next start`, voir
  `ecosystem.config.cjs` à la racine) : simple et suffisant pour un VPS mono-app.
- **`instances: 1` est obligatoire, pas un choix de confort** : le store garde `content.json` en
  mémoire et sérialise les écritures dans le process. Passer en mode cluster ferait diverger les
  caches et perdrait des sauvegardes.
- `max_memory_restart: "400M"` : le contenu entier tient en mémoire. Confortable pour quelques
  dizaines de livres ; à relever si le catalogue grossit beaucoup.
- `content.json` vit dans `/srv/edit/shared/` : un `git pull`/`npm ci` ne peut PAS le détruire.
- Les pages publiques sont rendues à la demande (`force-dynamic`) : un `pm2 restart` ou un
  reboot **sans** rebuild ne fait perdre aucun livre publié depuis le dernier déploiement.
  Vérifié en tuant le process et en le relançant : le contenu écrit entre-temps est toujours servi.
- Surveiller : `pm2 monit`, logs Nginx dans `/var/log/nginx/`.
