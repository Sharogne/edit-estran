import type { MetadataRoute } from "next";
import { routing } from "@/i18n/routing";
import { siteConfig } from "@/config/site";
import { getPublishedSlugs } from "@/lib/books";

// Rendered per request rather than frozen at build time: the content lives in an
// in-memory JSON store, so a render costs a lookup and no I/O — while a
// build-time prerender would resurface the catalogue as it was at build after
// any restart not preceded by a rebuild (crash, reboot, plain pm2 restart).
export const dynamic = "force-dynamic";

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
  return [entry(""), entry("/projets"), ...slugs.map((slug) => entry(`/projets/${slug}`))];
}
