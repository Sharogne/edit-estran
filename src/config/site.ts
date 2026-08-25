// Centralised site identity (placeholder branding — swap here when the real
// publishing house identity is known). Translated strings (tagline, descriptions)
// live in messages/{fr,en}.json under the "site" namespace.
export const siteConfig = {
  name: "Éditions de l'Estran",
  contactEmail: "contact@editions-estran.fr",
  baseUrl: process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000",
} as const;

/**
 * Seule la production s'expose aux moteurs de recherche et aux partages.
 * Tout le reste — staging sur le ThinkPad, préproduction, machine de dev —
 * renvoie un robots.txt fermé et affiche un bandeau dans le back office.
 * Piloté par SITE_ENV, dont la valeur par défaut est volontairement NON
 * production : on ne s'expose que sur décision explicite.
 */
export function isProduction(): boolean {
  return process.env.SITE_ENV === "production";
}

/** Étiquette affichée dans le back office hors production ("staging", "dev"…). */
export function environmentLabel(): string {
  return process.env.SITE_ENV || "développement";
}
