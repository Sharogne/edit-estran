import { defineConfig } from "cypress";
import dotenv from "dotenv";

// The suite always runs against the test environment (npm run e2e / e2e:open):
// dedicated SQLite db + uploads dir, deterministic seed (scripts/seed-e2e.ts).
const testEnv = dotenv.config({ path: ".env.test" }).parsed ?? {};

export default defineConfig({
  e2e: {
    baseUrl: "http://localhost:3000",
    specPattern: "cypress/e2e/**/*.cy.ts",
    supportFile: "cypress/support/e2e.ts",
    video: false,
    env: {
      ADMIN_EMAIL: testEnv.ADMIN_EMAIL ?? "admin@e2e.local",
      ADMIN_PASSWORD: testEnv.ADMIN_PASSWORD ?? "e2e-Password-123",
    },
  },
  retries: { runMode: 1, openMode: 0 },
});
