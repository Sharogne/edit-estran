import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { Container } from "@/components/ui/Container";
import { Button } from "@/components/ui/Button";

export default function NotFoundPage() {
  const t = useTranslations("notFound");

  return (
    <main>
      <Container className="py-24 text-center sm:py-32">
        <p className="font-display text-7xl text-line">404</p>
        <h1 className="font-display mt-6 text-3xl" data-cy="not-found-title">
          {t("title")}
        </h1>
        <p className="mt-4 text-ink-muted">{t("text")}</p>
        <div className="mt-10">
          <Button as={Link} href="/" variant="ghost" data-cy="not-found-home">
            {t("backHome")}
          </Button>
        </div>
      </Container>
    </main>
  );
}
