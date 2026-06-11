import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { siteConfig } from "@/config/site";
import { Container } from "@/components/ui/Container";
import { LocaleSwitcher } from "./LocaleSwitcher";

export function Header() {
  const t = useTranslations("nav");

  return (
    <header className="border-b border-line">
      <Container className="flex items-center justify-between py-5">
        <Link
          href="/"
          data-cy="header-title"
          className="font-display text-xl tracking-tight text-ink transition-colors hover:text-accent-deep"
        >
          {siteConfig.name}
        </Link>
        <div className="flex items-center gap-6">
          <nav className="flex items-center gap-5 text-sm">
            <Link
              href="/"
              data-cy="nav-home"
              className="text-ink-muted transition-colors hover:text-ink"
            >
              {t("home")}
            </Link>
            <Link
              href="/projets"
              data-cy="nav-projects"
              className="text-ink-muted transition-colors hover:text-ink"
            >
              {t("projects")}
            </Link>
          </nav>
          <LocaleSwitcher />
        </div>
      </Container>
    </header>
  );
}
