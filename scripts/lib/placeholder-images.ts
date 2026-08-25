// Deterministic placeholder artwork for the seeds (dev + e2e).
// Pure geometric SVG (no <text>) so rendering never depends on system fonts,
// which keeps output identical on Windows (dev) and Linux (prod/CI).
//
// These return SVG buffers rather than writing files: the seed hands them
// straight to src/lib/images.ts, so seeded books go through exactly the same
// encoder as a real upload.

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

/** Front cover, 2:3 ratio (1000x1500). */
export function coverArtwork(palette: CoverPalette): Buffer {
  const { bg, band, accent } = palette;
  return Buffer.from(`<svg width="1000" height="1500" viewBox="0 0 1000 1500" xmlns="http://www.w3.org/2000/svg">
  <rect width="1000" height="1500" fill="${bg}"/>
  <rect x="80" y="120" width="840" height="8" fill="${band}"/>
  <rect x="80" y="220" width="840" height="240" fill="${band}"/>
  <circle cx="500" cy="920" r="160" fill="${accent}"/>
  <rect x="80" y="1340" width="840" height="8" fill="${band}"/>
</svg>`);
}

/** Back cover, same 2:3 ratio: blurb block, publisher mark and a barcode. */
export function backCoverArtwork(palette: CoverPalette): Buffer {
  const { bg, band, accent } = palette;

  const blurb: string[] = [];
  for (let i = 0; i < 13; i++) {
    // Deterministic line widths, with a shorter one ending each paragraph.
    const isParagraphEnd = i % 5 === 4;
    const width = isParagraphEnd ? 300 + ((i * 67) % 300) : 700;
    blurb.push(
      `<rect x="150" y="${260 + i * 52}" width="${width}" height="16" rx="8" fill="${band}" opacity="0.72"/>`
    );
  }

  const bars: string[] = [];
  for (let i = 0; i < 22; i++) {
    const barWidth = (i * 31) % 3 === 0 ? 8 : 4;
    bars.push(
      `<rect x="${648 + i * 9}" y="${1300}" width="${barWidth}" height="70" fill="${bg}"/>`
    );
  }

  return Buffer.from(`<svg width="1000" height="1500" viewBox="0 0 1000 1500" xmlns="http://www.w3.org/2000/svg">
  <rect width="1000" height="1500" fill="${bg}"/>
  <rect x="150" y="150" width="360" height="20" rx="10" fill="${accent}"/>
  ${blurb.join("\n  ")}
  <circle cx="200" cy="1340" r="46" fill="${accent}"/>
  <rect x="630" y="1280" width="230" height="110" rx="6" fill="${band}"/>
  ${bars.join("\n  ")}
</svg>`);
}
