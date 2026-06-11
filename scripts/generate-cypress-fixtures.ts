import path from "node:path";
import fs from "node:fs/promises";
import sharp from "sharp";

// One-off generator for the committed Cypress upload fixtures
// (JPEG on purpose: exercises the WebP conversion pipeline).
// Re-run with: npx tsx scripts/generate-cypress-fixtures.ts

const outDir = path.join(__dirname, "..", "cypress", "fixtures");

async function jpeg(name: string, width: number, height: number, rgb: [number, number, number]) {
  await sharp({
    create: { width, height, channels: 3, background: { r: rgb[0], g: rgb[1], b: rgb[2] } },
  })
    .jpeg({ quality: 80 })
    .toFile(path.join(outDir, name));
  console.log(`wrote ${name}`);
}

async function main() {
  await fs.mkdir(outDir, { recursive: true });
  await jpeg("cover-upload.jpg", 800, 1200, [31, 58, 45]);
  await jpeg("preview-upload-1.jpg", 900, 1200, [236, 240, 241]);
  await jpeg("preview-upload-2.jpg", 900, 1200, [226, 176, 74]);
}

main();
