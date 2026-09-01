import type { MetadataRoute } from "next";
import { siteConfig, isProduction } from "@/config/site";

// Lu à chaque requête, pas figé au build : la même image peut ainsi servir en
// staging et en production, seule la variable d'environnement change.
export const dynamic = "force-dynamic";

export default function robots(): MetadataRoute.Robots {
  // Un environnement de test en ligne DOIT être invisible des moteurs. Sans ce
  // garde-fou, le catalogue de staging se fait indexer et vient concurrencer la
  // production avec des contenus en double.
  if (!isProduction()) {
    return { rules: { userAgent: "*", disallow: "/" } };
  }

  return {
    rules: { userAgent: "*", allow: "/", disallow: ["/admin"] },
    sitemap: `${siteConfig.baseUrl}/sitemap.xml`,
  };
}
