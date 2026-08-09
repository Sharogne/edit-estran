import path from "node:path";
import { mkdir } from "node:fs/promises";
import {
  generateCoverImage,
  generatePreviewImage,
  type CoverPalette,
} from "./lib/placeholder-images";

// Generates the artwork of the static demo into public/uploads/books/<id>/,
// mirroring the paths the real app serves from UPLOADS_DIR. Run by
// scripts/build-static-demo.mjs — see demo/README.md.
//
// Ids and preview counts MUST stay in sync with demo/overlay/src/lib/demo-data.ts.

type DemoArtwork = { id: string; palette: CoverPalette; previewCount: number };

const artwork: DemoArtwork[] = [
  {
    id: "demo-les-jardins-suspendus",
    palette: { bg: "#1f3a2d", band: "#e9e2d0", accent: "#c47a4a" },
    previewCount: 3,
  },
  {
    id: "demo-cartographie-du-silence",
    palette: { bg: "#2c3e50", band: "#ecf0f1", accent: "#e2b04a" },
    previewCount: 3,
  },
  {
    id: "demo-manuscrit-inacheve",
    palette: { bg: "#8a8276", band: "#f4f1ea", accent: "#42594e" },
    previewCount: 1,
  },
  {
    id: "demo-l-heure-bleue",
    palette: { bg: "#3b3a5d", band: "#efe9e1", accent: "#b85c6e" },
    previewCount: 2,
  },
];

async function main() {
  const root = path.join(process.cwd(), "public", "uploads", "books");

  for (const book of artwork) {
    const dir = path.join(root, book.id);
    await mkdir(dir, { recursive: true });

    await generateCoverImage(path.join(dir, "cover.webp"), book.palette);
    for (let i = 1; i <= book.previewCount; i++) {
      await generatePreviewImage(path.join(dir, `preview-${i}.webp`), i);
    }
    console.log(`Demo artwork: ${book.id} (cover + ${book.previewCount} preview)`);
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
