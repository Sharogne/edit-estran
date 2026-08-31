---
name: new-public-page
description: Ajouter une page publique au site (ex. contact, à-propos, actualités) avec i18n FR/EN, navigation, SEO et test e2e. À utiliser pour toute nouvelle page du site vitrine hors back office.
---

# Ajouter une page publique

Toute page publique est bilingue, référencée et testée. Checklist complète :

## 1. La route — `src/app/[locale]/<segment>/page.tsx`

Le segment d'URL est en français (convention du site : `/projets`, `/contact`, `/a-propos`).

```tsx
import { setRequestLocale, getTranslations } from "next-intl/server";

export async function generateMetadata({ params }: PageProps<"/[locale]/<segment>">) {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "<ns>" });
  return { title: t("metaTitle"), description: t("metaDescription") };
}

export default async function Page({ params }: PageProps<"/[locale]/<segment>">) {
  const { locale } = await params;
  setRequestLocale(locale); // OBLIGATOIRE (rendu statique)
  const t = await getTranslations("<ns>");
  // ...
}
```

Rappels : `params` est une Promise (Next 16) ; composants réutilisables dans
`src/components/site/` ; styles via tokens uniquement ; `data-cy` sur les éléments clés
(`data-cy="<segment>-title"` au minimum).

## 2. Les textes — `messages/fr.json` ET `messages/en.json`

Créer le namespace de la page avec les MÊMES clés dans les deux fichiers (dont `metaTitle` et
`metaDescription`). Une clé manquante dans une locale = erreur au rendu.

## 3. La navigation — `src/components/site/Header.tsx`

Lien via `Link` de `@/i18n/navigation` + clé `nav.<page>` (fr + en) +
`data-cy="nav-<segment>"`. Si pertinent, ajouter aussi au footer.

## 4. Le SEO — `src/app/sitemap.ts`

Ajouter la route dans la liste des pages statiques (elle sera déclinée fr/en avec hreflang
automatiquement par la fonction existante).

## 5. Le test — `cypress/e2e/public/<segment>.cy.ts`

Smoke test minimum : la page répond en `/fr/...` et `/en/...`, le titre `data-cy` est visible,
le lien de nav y mène. S'inspirer de `cypress/e2e/public/home.cy.ts`.

## 6. Vérifier

```bash
npm run lint && npm run e2e
```

Et contrôle manuel : `/fr/<segment>` + `/en/<segment>` + le switcher de langue sur cette page.
