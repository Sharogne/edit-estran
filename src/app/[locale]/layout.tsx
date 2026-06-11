import type { Metadata } from "next";
import { hasLocale, NextIntlClientProvider } from "next-intl";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { notFound } from "next/navigation";
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
  if (!hasLocale(routing.locales, locale)) {
    notFound();
  }
  setRequestLocale(locale);

  return (
    <html lang={locale} className={`${fontClasses} h-full antialiased`}>
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
