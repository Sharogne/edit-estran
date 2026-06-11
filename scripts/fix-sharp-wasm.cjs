/**
 * Makes `sharp` work on machines where Windows application control policy
 * blocks loading the unsigned native DLL (ERR_DLOPEN_FAILED).
 *
 * sharp's loader tries, in order:
 *   1. sharp/src/build/Release/sharp-<platform>-<version>.node   (local build)
 *   2. sharp/src/build/Release/sharp-wasm32-<version>.node       (local wasm)  <- we fill this
 *   3. @img/sharp-<platform>/sharp.node                          (prebuilt native)
 *
 * The @img/sharp-wasm32 package ships `sharp-wasm32-<v>.node.js` (+ .wasm):
 * require() resolves the ".node" id to that ".node.js" file, so it loads as
 * plain JS + WebAssembly — no native DLL, no policy block, same sharp API.
 *
 * Run from postinstall. No-op when native sharp loads (e.g. on the Linux VPS).
 */
const fs = require("node:fs");
const path = require("node:path");
const { execSync } = require("node:child_process");

const rootDir = path.join(__dirname, "..");
const sharpDir = path.join(rootDir, "node_modules", "sharp");
const wasmDir = path.join(rootDir, "node_modules", "@img", "sharp-wasm32");

function sharpLoads() {
  try {
    require("sharp");
    return true;
  } catch {
    return false;
  }
}

if (!fs.existsSync(sharpDir)) {
  console.log("[fix-sharp-wasm] sharp not installed, nothing to do.");
  process.exit(0);
}

if (sharpLoads()) {
  process.exit(0);
}

console.log("[fix-sharp-wasm] native sharp failed to load, installing WASM fallback shim...");

const sharpVersion = JSON.parse(
  fs.readFileSync(path.join(sharpDir, "package.json"), "utf8")
).version;

if (!fs.existsSync(wasmDir)) {
  const wasmPkgId = `@img/sharp-wasm32@${sharpVersion}`;
  console.log(`[fix-sharp-wasm] installing ${wasmPkgId} (forced, not saved to package.json)...`);
  execSync(`npm install ${wasmPkgId} --force --no-save --no-audit --no-fund`, {
    stdio: "inherit",
    cwd: rootDir,
  });
}

const wasmLibDir = path.join(wasmDir, "lib");
const releaseDir = path.join(sharpDir, "src", "build", "Release");
fs.mkdirSync(releaseDir, { recursive: true });
for (const file of fs.readdirSync(wasmLibDir)) {
  fs.copyFileSync(path.join(wasmLibDir, file), path.join(releaseDir, file));
}

if (sharpLoads()) {
  console.log("[fix-sharp-wasm] OK — sharp now runs via WebAssembly on this machine.");
} else {
  console.error("[fix-sharp-wasm] FAILED — sharp still cannot load. See skill run-e2e / AGENTS.md.");
  process.exit(1);
}
