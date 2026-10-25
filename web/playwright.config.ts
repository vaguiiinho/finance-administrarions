import { defineConfig, devices } from "@playwright/test";

const WEB_PORT = 3100;
const STUB_PORT = 4010;

// Playwright + axe (ADR 9.5 camada 2 / 11.5). O Next roda contra o stub da API (e2e/stub-api), nunca contra a API real.
export default defineConfig({
  testDir: "./e2e",
  testMatch: "**/*.pw.ts",
  fullyParallel: false,
  workers: 1,
  retries: process.env.CI ? 1 : 0,
  reporter: [["list"]],
  use: {
    baseURL: `http://127.0.0.1:${WEB_PORT}`,
    locale: "pt-BR",
    timezoneId: "America/Sao_Paulo",
    trace: "retain-on-failure",
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: [
    {
      command: "node e2e/stub-api/server.mjs",
      port: STUB_PORT,
      env: { STUB_API_PORT: String(STUB_PORT) },
      reuseExistingServer: !process.env.CI,
    },
    {
      command: `npx next dev -p ${WEB_PORT}`,
      port: WEB_PORT,
      env: { API_URL: `http://127.0.0.1:${STUB_PORT}` },
      reuseExistingServer: !process.env.CI,
      timeout: 180_000,
    },
  ],
});
