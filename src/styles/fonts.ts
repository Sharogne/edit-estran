import { Fraunces, Inter } from "next/font/google";

// Editorial pairing: expressive serif for display/headings, neutral sans for text/UI.
// These inject raw CSS variables consumed by the @theme tokens in globals.css
// (--font-display / --font-sans). Shared by every root layout (public + admin).

export const fontDisplay = Fraunces({
  variable: "--font-fraunces",
  subsets: ["latin"],
  axes: ["opsz"],
});

export const fontSans = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
});

export const fontClasses = `${fontDisplay.variable} ${fontSans.variable}`;
