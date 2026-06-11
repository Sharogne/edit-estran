import { setRequestLocale } from "next-intl/server";
import { useTranslations } from "next-intl";
import { use } from "react";

export default function HomePage({ params }: PageProps<"/[locale]">) {
  const { locale } = use(params);
  setRequestLocale(locale);
  const t = useTranslations("home");

  return (
    <main className="flex flex-1 items-center justify-center">
      <h1 className="font-display text-4xl" data-cy="home-title">
        {t("title")}
      </h1>
    </main>
  );
}
