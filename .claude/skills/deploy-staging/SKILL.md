---
name: deploy-staging
description: Environnement de test en ligne auto-hébergé sur le ThinkPad (Docker + Tailscale Funnel). À utiliser pour installer le staging, y déployer une branche avant la production, ou diagnostiquer un problème dessus.
---

# Staging auto-hébergé (ThinkPad)

Tester en conditions réelles — vraie URL HTTPS, vrais aperçus de partage, vrai
mobile — avant de toucher à la production OVH. Le tout sur une machine déjà
allumée, sans rien exposer de la box.

```
ThinkPad
  Docker : conteneur edit-staging, écoute 127.0.0.1:3000 UNIQUEMENT
  Volume : edit_edit-content → /data/content.json
  Tailscale Funnel : expose 3000 sur https://<machine>.<tailnet>.ts.net
```

Aucun port ouvert sur la box, l'IP domestique reste masquée, et le DNS du
domaine personnel n'est pas touché.

## Pourquoi Funnel plutôt qu'un tunnel Cloudflare

Cloudflare Tunnel en mode nommé exige que la **zone DNS entière** soit chez
Cloudflare : impossible de n'y déléguer qu'un sous-domaine. Utiliser un domaine
personnel déjà en service imposerait donc d'y déplacer aussi le site et surtout
la **messagerie** — un risque réel pris pour un simple environnement de test.
Funnel ne demande aucun changement DNS.

Le jour où la maison d'édition aura son propre domaine, il sera neuf : le migrer
chez Cloudflare sera alors sans risque, et cette page n'aura plus lieu d'être.

## 1. Installation (une seule fois)

### Docker

```bash
curl -fsSL https://get.docker.com | sudo sh
sudo usermod -aG docker "$USER"    # puis se reconnecter
```

### Tailscale

```bash
curl -fsSL https://tailscale.com/install.sh | sh
sudo tailscale up
```

La commande affiche une URL à ouvrir dans un navigateur pour rattacher la
machine au compte. Étape interactive, à faire soi-même.

### Activer Funnel

Funnel a besoin de deux réglages **dans la console d'administration Tailscale**
(login.tailscale.com) :

1. **DNS → MagicDNS** activé, et **HTTPS Certificates** activé. Sans ça, pas de
   certificat, donc pas de Funnel.
2. **Access Controls** : le nœud doit avoir l'attribut `funnel`. Sur un tailnet
   personnel, `tailscale funnel` affiche le lien exact à ouvrir pour l'accorder
   s'il manque — suivre ce que dit la commande plutôt que deviner.

Puis, une fois pour toutes :

```bash
sudo tailscale funnel --bg 3000
```

```bash
tailscale funnel status
```

Le second affiche l'URL publique. C'est elle qui va dans `NEXT_PUBLIC_SITE_URL`.

### Le dépôt et la configuration

```bash
git clone https://github.com/Sharogne/edit-estran.git ~/edit && cd ~/edit
cp .env.staging.example .env.staging
node scripts/hash-password.mjs "<mot-de-passe-du-staging>"
```

Éditer `.env.staging` :

- `NEXT_PUBLIC_SITE_URL` : l'URL donnée par `tailscale funnel status` ;
- `SESSION_SECRET` : **différent de la production**, sinon un cookie obtenu sur
  le staging serait rejouable sur le site réel ;
- `ADMIN_EMAIL` + `ADMIN_PASSWORD_HASH_B64` : sortie du script ci-dessus.

Le script de déploiement refuse de démarrer si le secret est identique à celui
de `.env`.

## 2. Déployer

```bash
./scripts/deploy-staging.sh
```

```bash
./scripts/deploy-staging.sh feat/ma-branche
```

Le script enchaîne : lecture de `.env.staging`, mise à jour du code, sauvegarde
datée du contenu, construction de l'image, démarrage, attente du healthcheck,
puis vérifications.

**La vérification qui compte** : il interroge `/robots.txt` et **arrête le
conteneur** si l'indexation n'est pas fermée. Un environnement de test référencé
par Google vient concurrencer la production avec des contenus en double, et rien
ne le signale à l'œil nu.

Ce garde-fou repose sur `SITE_ENV`. Seule la valeur `production` autorise
l'indexation ; toute autre valeur, ou son absence, ferme `robots.txt` et affiche
un bandeau rouge dans le back office. `compose.yml` fixe `SITE_ENV: staging`.

## 3. Tester sur les vraies données

```bash
scp deploy@<vps>:/srv/edit/shared/content.json /tmp/prod.json
docker cp /tmp/prod.json edit-staging:/data/content.json
docker compose restart edit
```

Le redémarrage est obligatoire : le store garde le fichier en mémoire et ne voit
pas une écriture faite dans son dos.

Ce fichier ne contient que du contenu éditorial — aucun secret, aucun mot de
passe. Le copier ne présente pas de risque.

## 4. Exploitation

```bash
docker compose logs -f edit          # journaux
docker compose restart edit          # redémarrage
docker compose down                  # arrêt (le volume survit)
docker compose down -v               # arrêt + SUPPRESSION du contenu
```

Les sauvegardes datées s'accumulent dans `backups/`, purgées au-delà de 30
jours. Pour restaurer :

```bash
docker compose down
docker run --rm -v edit_edit-content:/data -v "$PWD/backups:/b" node:22-slim \
  cp /b/content-<date>.json /data/content.json
docker compose up -d
```

## Pièges connus

- **`NEXT_PUBLIC_SITE_URL` est figée à la compilation.** Changer l'URL Funnel
  impose de reconstruire l'image, pas seulement de redémarrer. Le script le fait
  de toute façon.
- **Un seul conteneur, jamais de réplique.** Le store garde `content.json` en
  mémoire et sérialise les écritures dans le process. Deux conteneurs feraient
  diverger les caches et perdraient des sauvegardes.
- **`--ignore-scripts` au `npm ci` de l'image.** Le postinstall bascule sharp en
  WebAssembly, parade nécessaire sur la machine Windows de développement mais
  inutile et pénalisante ici, où le binaire natif fonctionne.
- **Le conteneur n'écoute que sur `127.0.0.1`.** C'est Tailscale qui décide de ce
  qui sort. Ne pas publier le port sur `0.0.0.0` : ce serait exposer le back
  office à tout le réseau local.
- **Le ThinkPad héberge déjà d'autres services** (Home Assistant, AdGuard).
  Vérifier que le port 3000 est libre : `sudo ss -tlnp | grep 3000`.

## Différences avec la production

| | Staging (ThinkPad) | Production (OVH) |
| --- | --- | --- |
| Exécution | Docker | PM2 (`ecosystem.config.cjs`) |
| Exposition | Tailscale Funnel | Nginx + Let's Encrypt |
| `SITE_ENV` | `staging` → non indexable | `production` |
| Contenu | volume Docker | `/srv/edit/shared/content.json` |
| Déploiement | `./scripts/deploy-staging.sh` | skill `deploy-ovh` |

Mettre au point le déploiement ici dérisque celui d'OVH : c'est la même
application, les mêmes variables, le même fichier de contenu.
