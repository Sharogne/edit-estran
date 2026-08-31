import type { Metadata } from "next";
import { hasLocale, NextIntlClientProvider } from "next-intl";
import { getTranslations, setRequestLocale } from "next-intl/server";

import { routing } from "@/i18n/routing";
import { siteConfig } from "@/config/site";
import { fontClasses } from "@/styles/fonts";
import { Header } from "@/components/site/Header";
import { Footer } from "@/components/site/Footer";
import "../globals.css";

export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }));
}

export async function generateMetadata({
  params,
}: Omit<LayoutProps<"/[locale]">, "children">): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "site" });
  return {
    metadataBase: new URL(siteConfig.baseUrl),
    title: {
      default: `${siteConfig.name} — ${t("tagline")}`,
      template: `%s — ${siteConfig.name}`,
    },
    description: t("description"),
  };
}

export default async function LocaleLayout({ children, params }: LayoutProps<"/[locale]">) {
  const { locale } = await params;

  /*
   * La locale est refusée par les PAGES, pas ici. Un notFound() levé depuis un
   * layout remonte au-dessus de sa propre frontière : [locale]/not-found.tsx ne
   * s'appliquait pas, et /de ou /projets retombaient sur la page par défaut de
   * Next — en anglais et sans habillage. Chaque page du segment porte le garde,
   * ce qui laisse la 404 du site s'afficher normalement.
   *
   * Reste à ne pas annoncer une langue qui n'existe pas : le temps de rendre
   * cette 404, `lang` retombe sur la locale par défaut.
   */
  const langue = hasLocale(routing.locales, locale) ? locale : routing.defaultLocale;
  setRequestLocale(langue);

  return (
    <html lang={langue} className={`${fontClasses} h-full antialiased`}>
      <body className="flex min-h-full flex-col">
        <NextIntlClientProvider>
          <Header />
          <div className="flex-1">{children}</div>
          <Footer />
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
