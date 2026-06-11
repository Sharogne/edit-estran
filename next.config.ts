import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";

const withNextIntl = createNextIntlPlugin("./src/i18n/request.ts");

const nextConfig: NextConfig = {
  experimental: {
    serverActions: {
      // Cover + preview images are uploaded through server actions
      bodySizeLimit: "15mb",
    },
  },
};

export default withNextIntl(nextConfig);
