"use client";

import { useLocale, useTranslations } from "next-intl";
import { Link, usePathname } from "@/i18n/navigation";
import { routing } from "@/i18n/routing";

export function LocaleSwitcher() {
  const locale = useLocale();
  const pathname = usePathname();
  const t = useTranslations("localeSwitcher");

  return (
    <nav
      aria-label={t("label")}
      className="flex items-center gap-1 text-sm"
      data-cy="locale-switcher"
    >
      {routing.locales.map((l) => (
        <Link
          key={l}
          href={pathname}
          locale={l}
          data-cy={`locale-switcher-${l}`}
          aria-current={l === locale ? "true" : undefined}
          className={
            l === locale
              ? "px-1.5 py-0.5 font-medium text-ink underline decoration-accent decoration-2 underline-offset-4"
              : "px-1.5 py-0.5 text-ink-muted transition-colors hover:text-ink"
          }
        >
          {l.toUpperCase()}
        </Link>
      ))}
    </nav>
  );
}
