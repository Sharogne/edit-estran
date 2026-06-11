import type { Metadata } from "next";
import { fontClasses } from "@/styles/fonts";
import "../globals.css";

// Second root layout (the public one lives under [locale]/) — the back office
// is outside the locale segment and is French-only by design.

export const metadata: Metadata = {
  robots: { index: false },
};

export default function AdminRootLayout({ children }: LayoutProps<"/admin">) {
  return (
    <html lang="fr" className={`${fontClasses} h-full antialiased`}>
      <body className="flex min-h-full flex-col">{children}</body>
    </html>
  );
}
