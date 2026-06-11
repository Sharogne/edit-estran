/**
 * Launches Cypress with a clean Electron environment.
 *
 * When the shell is spawned from VS Code (tasks, integrated terminal, Claude
 * Code…), ELECTRON_RUN_AS_NODE=1 is inherited from the extension host. With it,
 * Cypress.exe (an Electron app) boots as plain Node and rejects its own flags
 * ("bad option: --smoke-test"). Stripping the variable fixes the launch.
 *
 * Usage: node scripts/run-cypress.cjs <run|open|verify> [cypress args...]
 */
const { spawnSync } = require("node:child_process");

delete process.env.ELECTRON_RUN_AS_NODE;
delete process.env.ELECTRON_EXTRA_LAUNCH_ARGS;

const result = spawnSync("npx", ["cypress", ...process.argv.slice(2)], {
  stdio: "inherit",
  env: process.env,
  shell: process.platform === "win32", // npx is npx.cmd on Windows
});

process.exit(result.status ?? 1);
