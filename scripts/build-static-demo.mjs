#!/usr/bin/env node
// Builds the static GitHub Pages demo into out/.
//
// The repository is never left modified: the overlay in demo/overlay/ is copied
// on top of the working tree, the build runs, then everything is restored with
// git (tracked files) and explicit deletes (files the overlay adds).
//
// Usage: npm run demo:build
// Env:   NEXT_PUBLIC_BASE_PATH  (default "/edit-estran")
//        NEXT_PUBLIC_SITE_URL   (default "https://sharogne.github.io<basePath>")

import { execFileSync } from "node:child_process";
import { cpSync, existsSync, mkdirSync, rmSync, writeFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const overlayRoot = path.join(repoRoot, "demo", "overlay");

const basePath = process.env.NEXT_PUBLIC_BASE_PATH ?? "/edit-estran";
const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? `https://sharogne.github.io${basePath}`;

// Server-only routes that a static export cannot compile.
const REMOVE = [
  "src/app/uploads", // route handler serving UPLOADS_DIR
  "src/proxy.ts", // next-intl middleware (unsupported by output: export)
  "src/app/admin/(protected)/livres/[id]", // dynamic id -> replaced by ?id=
];

// Paths the overlay creates that git cannot restore (they are untracked).
const ADDED = [
  "src/lib/demo-data.ts",
  "src/lib/demo-hooks.ts",
  "src/app/admin/(protected)/livres/editer",
  "public/uploads",
];

// Working-tree paths the build touches; must be clean before we start.
const GUARDED = ["src", "next.config.ts", "public"];

function git(args, options = {}) {
  return execFileSync("git", args, { cwd: repoRoot, encoding: "utf8", ...options });
}

function run(command, args, extraEnv = {}) {
  execFileSync(command, args, {
    cwd: repoRoot,
    stdio: "inherit",
    shell: process.platform === "win32",
    env: { ...process.env, ...extraEnv },
  });
}

function assertCleanTree() {
  const dirty = git(["status", "--porcelain", "--", ...GUARDED]).trim();
  if (dirty) {
    console.error(
      "Working tree has uncommitted changes in src/, public/ or next.config.ts:\n" +
        dirty +
        "\n\nCommit or stash them first — this script restores those paths with git."
    );
    process.exit(1);
  }
}

function overlayFiles(dir = overlayRoot) {
  const entries = [];
  for (const name of readdirSync(dir)) {
    const full = path.join(dir, name);
    if (statSync(full).isDirectory()) entries.push(...overlayFiles(full));
    else entries.push(full);
  }
  return entries;
}

function applyOverlay() {
  for (const source of overlayFiles()) {
    const relative = path.relative(overlayRoot, source);
    const destination = path.join(repoRoot, relative);
    mkdirSync(path.dirname(destination), { recursive: true });
    cpSync(source, destination);
    console.log(`overlay  ${relative.replace(/\\/g, "/")}`);
  }
  for (const target of REMOVE) {
    rmSync(path.join(repoRoot, target), { recursive: true, force: true });
    console.log(`remove   ${target}`);
  }
}

function restore() {
  for (const added of ADDED) {
    rmSync(path.join(repoRoot, added), { recursive: true, force: true });
  }
  git(["checkout", "--", ...GUARDED]);
  console.log("Working tree restored.");
}

function writePagesExtras() {
  const out = path.join(repoRoot, "out");
  // Without this, GitHub Pages runs Jekyll and drops the _next/ directory.
  writeFileSync(path.join(out, ".nojekyll"), "");

  // The locale middleware cannot run on a static host: redirect / to /fr/.
  const target = `${basePath}/fr/`;
  writeFileSync(
    path.join(out, "index.html"),
    `<!doctype html>
<html lang="fr">
  <head>
    <meta charset="utf-8" />
    <title>Éditions de l'Estran</title>
    <meta http-equiv="refresh" content="0; url=${target}" />
    <link rel="canonical" href="${target}" />
    <script>window.location.replace(${JSON.stringify(target)});</script>
  </head>
  <body>
    <p>Redirection vers <a href="${target}">le site</a>…</p>
  </body>
</html>
`
  );
  console.log(`Wrote out/.nojekyll and out/index.html (-> ${target})`);
}

// --- main -------------------------------------------------------------------

assertCleanTree();
rmSync(path.join(repoRoot, "out"), { recursive: true, force: true });
// Route type validators cached by `next dev` still reference the routes the
// overlay removes, which fails the type check. Start from a clean cache.
rmSync(path.join(repoRoot, ".next"), { recursive: true, force: true });

try {
  applyOverlay();

  run("npx", ["tsx", "scripts/gen-demo-images.ts"]);

  run("npx", ["next", "build"], {
    NEXT_PUBLIC_BASE_PATH: basePath,
    NEXT_PUBLIC_SITE_URL: siteUrl,
    // The demo never queries Prisma, but @prisma/client is still resolved at
    // build time and refuses to load without a URL.
    DATABASE_URL: process.env.DATABASE_URL ?? "file:./unused-demo.db",
  });

  if (!existsSync(path.join(repoRoot, "out"))) {
    throw new Error("next build did not produce out/ — is output: 'export' set?");
  }
  writePagesExtras();
} finally {
  restore();
}

console.log(`\nStatic demo ready in out/  (basePath ${basePath})`);
