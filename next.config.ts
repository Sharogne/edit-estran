import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";
import { SERVER_ACTION_BODY_LIMIT_MB } from "./src/config/uploads";

const withNextIntl = createNextIntlPlugin("./src/i18n/request.ts");

const nextConfig: NextConfig = {
  experimental: {
    serverActions: {
      // Couverture + 4e de couverture passent par une server action. La valeur
      // est DÉRIVÉE des limites annoncées dans le formulaire (src/config/uploads.ts) :
      // une limite de transport plus basse que ce que l'éditeur a le droit de
      // déposer produirait un écran d'erreur Next au lieu d'un message.
      bodySizeLimit: `${SERVER_ACTION_BODY_LIMIT_MB}mb`,
    },
  },
};

export default withNextIntl(nextConfig);
