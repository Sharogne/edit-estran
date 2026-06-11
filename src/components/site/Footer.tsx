import { useTranslations } from "next-intl";
import { siteConfig } from "@/config/site";
import { Container } from "@/components/ui/Container";

export function Footer() {
  const t = useTranslations("footer");
  const year = new Date().getFullYear();

  return (
    <footer className="mt-24 border-t border-line" data-cy="footer">
      <Container className="flex flex-col gap-2 py-10 text-sm text-ink-muted sm:flex-row sm:items-center sm:justify-between">
        <p className="font-display text-base text-ink">{siteConfig.name}</p>
        <p>
          <span>{t("contact")} — </span>
          <a
            href={`mailto:${siteConfig.contactEmail}`}
            className="underline decoration-line underline-offset-4 transition-colors hover:text-ink hover:decoration-accent"
          >
            {siteConfig.contactEmail}
          </a>
        </p>
        <p>
          © {year} {siteConfig.name}. {t("rights")}.
        </p>
      </Container>
    </footer>
  );
}
