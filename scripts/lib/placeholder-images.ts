import path from "node:path";
import fs from "node:fs/promises";
import sharp from "sharp";

// Deterministic placeholder artwork for seeds (dev + e2e).
// Pure geometric SVG (no <text>) so rendering never depends on system fonts,
// which keeps output identical on Windows (dev) and Linux (prod/CI).

export type CoverPalette = {
  bg: string;
  band: string;
  accent: string;
};

export const palettes: Record<string, CoverPalette> = {
  forest: { bg: "#1f3a2d", band: "#e9e2d0", accent: "#c47a4a" },
  slate: { bg: "#2c3e50", band: "#ecf0f1", accent: "#e2b04a" },
  dusk: { bg: "#3b3a5d", band: "#efe9e1", accent: "#b85c6e" },
  stone: { bg: "#8a8276", band: "#f4f1ea", accent: "#42594e" },
};

/** Book cover, 2:3 ratio (1000x1500), saved as WebP. */
export async function generateCoverImage(
  outAbsolutePath: string,
  palette: CoverPalette
): Promise<void> {
  const { bg, band, accent } = palette;
  const svg = `<svg width="1000" height="1500" viewBox="0 0 1000 1500" xmlns="http://www.w3.org/2000/svg">
  <rect width="1000" height="1500" fill="${bg}"/>
  <rect x="80" y="120" width="840" height="8" fill="${band}"/>
  <rect x="80" y="220" width="840" height="240" fill="${band}"/>
  <circle cx="500" cy="920" r="160" fill="${accent}"/>
  <rect x="80" y="1340" width="840" height="8" fill="${band}"/>
</svg>`;
  await fs.mkdir(path.dirname(outAbsolutePath), { recursive: true });
  await sharp(Buffer.from(svg)).webp({ quality: 85 }).toFile(outAbsolutePath);
}

/** Inside page of a book (fake justified text lines), 3:4 ratio, WebP. */
export async function generatePreviewImage(
  outAbsolutePath: string,
  pageNumber: number
): Promise<void> {
  const lines: string[] = [];
  const top = 200;
  const lineHeight = 46;
  const count = 24;
  for (let i = 0; i < count; i++) {
    // Deterministic pseudo-random line widths (paragraph endings every ~6 lines)
    const isParagraphEnd = (i + pageNumber) % 6 === 5;
    const width = isParagraphEnd ? 380 + ((i * 53 + pageNumber * 37) % 280) : 840;
    const y = top + i * lineHeight + (isParagraphEnd ? 0 : 0);
    lines.push(`<rect x="180" y="${y}" width="${width}" height="14" rx="7" fill="#d8d3c8"/>`);
  }
  const svg = `<svg width="1200" height="1600" viewBox="0 0 1200 1600" xmlns="http://www.w3.org/2000/svg">
  <rect width="1200" height="1600" fill="#faf7f0"/>
  <rect x="180" y="140" width="320" height="18" rx="9" fill="#b9b2a4"/>
  ${lines.join("\n  ")}
  <rect x="570" y="1480" width="60" height="12" rx="6" fill="#b9b2a4"/>
</svg>`;
  await fs.mkdir(path.dirname(outAbsolutePath), { recursive: true });
  await sharp(Buffer.from(svg)).webp({ quality: 82 }).toFile(outAbsolutePath);
}
