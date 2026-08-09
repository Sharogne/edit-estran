import type { MetadataRoute } from "next";
import { routing } from "@/i18n/routing";
import { siteConfig } from "@/config/site";
import { getPublishedSlugs } from "@/lib/books";

// STATIC DEMO BUILD — identical to the real route, plus the force-static flag
// that `output: "export"` requires on metadata routes.
export const dynamic = "force-static";

function entry(path: string): MetadataRoute.Sitemap[number] {
  const languages = Object.fromEntries(
    routing.locales.map((locale) => [locale, `${siteConfig.baseUrl}/${locale}${path}`])
  );
  return {
    url: `${siteConfig.baseUrl}/${routing.defaultLocale}${path}`,
    lastModified: new Date(),
    alternates: { languages },
  };
}

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const slugs = await getPublishedSlugs();
  return [
    entry(""),
    entry("/projets"),
    ...slugs.map((slug) => entry(`/projets/${slug}`)),
  ];
}
