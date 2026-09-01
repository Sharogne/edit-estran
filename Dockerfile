# Image de staging pour le ThinkPad. Debian slim et non Alpine : sharp installe
# son binaire natif pour glibc sans détour, alors que musl demande un paquet
# séparé — inutile de s'imposer ça pour gagner quelques mégaoctets.
FROM node:22-slim AS deps
WORKDIR /app
COPY package.json package-lock.json ./
# `npm install` et non `npm ci`, à contrecœur mais sciemment : le
# package-lock.json est généré sous Windows, où npm n'enregistre pas les
# dépendances transitives des paquets optionnels de sharp (@img/sharp-wasm32 →
# @emnapi/*, @swc/helpers). Vu depuis Linux le lock est donc « out of sync » et
# `npm ci` refuse de tourner. Même constat que l'ancien workflow GitHub Actions
# du dépôt. Ne pas « corriger » en remettant npm ci sans avoir d'abord
# régénéré le lock sur Linux.
#
# --ignore-scripts : le postinstall bascule sharp en WebAssembly, parade utile
# sur la machine Windows de dev mais nuisible ici où le binaire natif fonctionne.
RUN npm install --no-audit --no-fund --ignore-scripts

FROM node:22-slim AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
# NEXT_PUBLIC_* est figé à la compilation : l'URL publique doit donc être connue
# ici, pas seulement au démarrage.
ARG NEXT_PUBLIC_SITE_URL
ENV NEXT_PUBLIC_SITE_URL=$NEXT_PUBLIC_SITE_URL
ENV NEXT_TELEMETRY_DISABLED=1
RUN npm run build

FROM node:22-slim AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

# Utilisateur non privilégié : le conteneur n'a aucune raison de tourner en root.
RUN groupadd --system --gid 1001 nodejs \
 && useradd --system --uid 1001 --gid nodejs nextjs

COPY --from=deps /app/node_modules ./node_modules
COPY --from=builder /app/.next ./.next
COPY --from=builder /app/public ./public
COPY --from=builder /app/package.json ./package.json

# next.config.ts ET le graphe qu'il importe. `next start` RELIT la configuration
# au démarrage : sans ces fichiers, Next tourne sur ses valeurs par défaut sans
# rien signaler — dont une limite de corps de requête à 1 Mo, qui fait échouer en
# 413 tout envoi d'image un peu lourde. Le symptôme est un écran d'erreur Next
# côté admin et une seule ligne dans les journaux du conteneur.
# Si next.config.ts venait à importer autre chose, ce COPY doit suivre.
COPY --from=builder /app/next.config.ts ./next.config.ts
COPY --from=builder /app/src/config ./src/config

# Le contenu vit sur un volume, hors de l'image : c'est la seule chose à
# sauvegarder et elle doit survivre à chaque reconstruction.
RUN mkdir -p /data && chown nextjs:nodejs /data
VOLUME /data

USER nextjs
EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:3000/fr').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

CMD ["npx", "next", "start"]
