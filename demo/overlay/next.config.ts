import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";

// STATIC DEMO BUILD — replaces the app's next.config.ts for the GitHub Pages
// export. The real config is untouched in the repository.

const withNextIntl = createNextIntlPlugin("./src/i18n/request.ts");

const basePath = process.env.NEXT_PUBLIC_BASE_PATH ?? "";

const nextConfig: NextConfig = {
  // Emits plain HTML/CSS/JS into out/ — no Node server on GitHub Pages.
  output: "export",
  // Project Pages are served from https://<user>.github.io/<repo>/.
  basePath,
  // Pages must resolve as directories (…/projets/index.html).
  trailingSlash: true,
  images: {
    // No image optimisation server in a static export.
    unoptimized: true,
  },
};

export default withNextIntl(nextConfig);
