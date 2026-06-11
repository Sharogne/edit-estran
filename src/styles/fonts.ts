import { Fraunces, Inter } from "next/font/google";

// Editorial pairing: expressive serif for display/headings, neutral sans for text/UI.
// Exposed as CSS variables consumed by the design tokens in globals.css (@theme).
// Shared by every root layout (public site + admin) so typography stays consistent.

export const fontDisplay = Fraunces({
  variable: "--font-display",
  subsets: ["latin"],
  axes: ["opsz"],
});

export const fontSans = Inter({
  variable: "--font-sans",
  subsets: ["latin"],
});

export const fontClasses = `${fontDisplay.variable} ${fontSans.variable}`;
