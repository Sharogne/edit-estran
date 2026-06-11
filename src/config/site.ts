// Centralised site identity (placeholder branding — swap here when the real
// publishing house identity is known). Translated strings (tagline, descriptions)
// live in messages/{fr,en}.json under the "site" namespace.
export const siteConfig = {
  name: "Éditions de l'Estran",
  contactEmail: "contact@editions-estran.fr",
  baseUrl: process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000",
} as const;
