import type { Metadata } from "next";
import { fontClasses } from "@/styles/fonts";
import "../globals.css";

// STATIC DEMO BUILD — same root layout as the real back office, with a default
// title: the demo pages are client components and cannot export metadata.

export const metadata: Metadata = {
  title: "Administration (démo) — Éditions de l'Estran",
  robots: { index: false },
};

export default function AdminRootLayout({ children }: LayoutProps<"/admin">) {
  return (
    <html lang="fr" className={`${fontClasses} h-full antialiased`}>
      <body className="flex min-h-full flex-col">{children}</body>
    </html>
  );
}
