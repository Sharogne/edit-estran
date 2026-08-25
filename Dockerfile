# Image de staging pour le ThinkPad. Debian slim et non Alpine : sharp installe
# son binaire natif pour glibc sans détour, alors que musl demande un paquet
# séparé — inutile de s'imposer ça pour gagner quelques mégaoctets.
FROM node:22-slim AS deps
WORKDIR /app
COPY package.json package-lock.json ./
# --ignore-scripts : le postinstall bascule sharp en WebAssembly, parade utile
# sur la machine Windows de dev mais nuisible ici où le natif fonctionne.
RUN npm ci --ignore-scripts

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

# Le contenu vit sur un volume, hors de l'image : c'est la seule chose à
# sauvegarder et elle doit survivre à chaque reconstruction.
RUN mkdir -p /data && chown nextjs:nodejs /data
VOLUME /data

USER nextjs
EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:3000/fr').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

CMD ["npx", "next", "start"]
