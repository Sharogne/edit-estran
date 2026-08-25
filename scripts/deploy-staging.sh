#!/usr/bin/env bash
#
# Déploiement du staging auto-hébergé (ThinkPad).
#
#   ./scripts/deploy-staging.sh              déploie la branche courante
#   ./scripts/deploy-staging.sh main         déploie une branche précise
#
# Le script s'arrête à la première erreur et vérifie APRÈS déploiement que le
# site est bien fermé aux moteurs de recherche : un environnement de test
# indexé vient concurrencer la production avec des contenus en double, et cette
# erreur ne se voit pas à l'œil nu.

set -euo pipefail

BRANCHE="${1:-}"
RACINE="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$RACINE"

echo "→ Déploiement du staging depuis $RACINE"

# --- 1. Configuration -------------------------------------------------------
if [[ ! -f .env.staging ]]; then
  echo "✗ .env.staging manquant. Copiez .env.staging.example et renseignez-le." >&2
  exit 1
fi
set -a
# shellcheck disable=SC1091
source .env.staging
set +a

for variable in NEXT_PUBLIC_SITE_URL SESSION_SECRET ADMIN_EMAIL ADMIN_PASSWORD_HASH_B64; do
  if [[ -z "${!variable:-}" ]]; then
    echo "✗ $variable est vide dans .env.staging" >&2
    exit 1
  fi
done

# Une erreur silencieuse coûteuse : réutiliser le secret de session de la prod.
if [[ -f .env ]] && grep -q "^SESSION_SECRET=\"\?${SESSION_SECRET}\"\?$" .env 2>/dev/null; then
  echo "✗ SESSION_SECRET est identique à celui de .env — un cookie de staging" >&2
  echo "  serait rejouable en production. Générez-en un autre." >&2
  exit 1
fi

# --- 2. Code ----------------------------------------------------------------
if [[ -n "$BRANCHE" ]]; then
  echo "→ Bascule sur $BRANCHE"
  git fetch origin "$BRANCHE"
  git checkout "$BRANCHE"
fi
git pull --ff-only
echo "→ Commit déployé : $(git rev-parse --short HEAD) ($(git rev-parse --abbrev-ref HEAD))"

# --- 3. Sauvegarde du contenu avant toute chose -----------------------------
# Le volume survit au rebuild, mais une sauvegarde datée coûte une seconde et
# évite de découvrir trop tard qu'on a écrasé quelque chose.
mkdir -p backups
if docker volume inspect edit_edit-content >/dev/null 2>&1; then
  HORODATAGE="$(date +%Y%m%d-%H%M%S)"
  docker run --rm -v edit_edit-content:/data -v "$RACINE/backups:/backup" node:22-slim \
    sh -c 'test -f /data/content.json && cp /data/content.json /backup/content-'"$HORODATAGE"'.json' \
    2>/dev/null && echo "→ Sauvegarde : backups/content-$HORODATAGE.json" \
    || echo "→ Pas encore de contenu à sauvegarder"
  find backups -name 'content-*.json' -mtime +30 -delete 2>/dev/null || true
fi

# --- 4. Construction et démarrage -------------------------------------------
echo "→ Construction de l'image (quelques minutes la première fois)"
docker compose build
echo "→ Démarrage"
docker compose up -d

# --- 5. Attente du healthcheck ----------------------------------------------
echo -n "→ Attente du démarrage "
for _ in $(seq 1 60); do
  ETAT="$(docker inspect -f '{{.State.Health.Status}}' edit-staging 2>/dev/null || echo starting)"
  if [[ "$ETAT" == "healthy" ]]; then
    echo " prêt"
    break
  fi
  if [[ "$ETAT" == "unhealthy" ]]; then
    echo ""
    echo "✗ Le conteneur ne répond pas. Journaux :" >&2
    docker compose logs --tail 40 edit >&2
    exit 1
  fi
  echo -n "."
  sleep 2
done

if [[ "${ETAT:-}" != "healthy" ]]; then
  echo ""
  echo "✗ Délai dépassé. Journaux :" >&2
  docker compose logs --tail 40 edit >&2
  exit 1
fi

# --- 6. Vérifications ------------------------------------------------------
echo "→ Vérifications"

verifier() {
  local chemin="$1" attendu="$2"
  local code
  code="$(curl -s -o /dev/null -w '%{http_code}' "http://127.0.0.1:3000$chemin")"
  if [[ "$code" != "$attendu" ]]; then
    echo "✗ $chemin a répondu $code au lieu de $attendu" >&2
    return 1
  fi
  echo "  ✓ $chemin ($code)"
}

verifier /fr 200
verifier /fr/projets 200
verifier /admin/login 200

# LE contrôle qui justifie ce script : un staging en ligne DOIT être fermé aux
# moteurs. Si ce test tombe, le site est exposé à l'indexation.
ROBOTS="$(curl -s http://127.0.0.1:3000/robots.txt)"
if ! grep -qi 'Disallow: /$' <<<"$ROBOTS"; then
  echo "✗ robots.txt n'interdit PAS l'indexation. Le staging serait référencé." >&2
  echo "  Vérifiez que SITE_ENV vaut bien \"staging\" dans compose.yml." >&2
  echo "  Reçu :" >&2
  sed 's/^/    /' <<<"$ROBOTS" >&2
  docker compose down
  echo "✗ Conteneur arrêté par précaution." >&2
  exit 1
fi
echo "  ✓ robots.txt ferme l'indexation"

# --- 7. Exposition ----------------------------------------------------------
echo ""
if command -v tailscale >/dev/null 2>&1; then
  if tailscale funnel status >/dev/null 2>&1; then
    echo "→ Tailscale Funnel actif :"
    tailscale funnel status | sed 's/^/    /'
  else
    echo "→ Funnel pas encore activé. Une fois pour toutes :"
    echo "    sudo tailscale funnel --bg 3000"
  fi
else
  echo "→ Tailscale absent : le site n'écoute que sur 127.0.0.1:3000."
  echo "  Voir le skill deploy-staging pour l'installation."
fi

echo ""
echo "✓ Staging déployé — $NEXT_PUBLIC_SITE_URL"
