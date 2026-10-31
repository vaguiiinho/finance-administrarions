import { defineConfig, devices } from "@playwright/test";

// Portas sobrescreviveis por ambiente (PW_WEB_PORT, PW_STUB_PORT) para rodar ao lado de servidores ja ativos
const WEB_PORT = Number(process.env.PW_WEB_PORT ?? 3100);
const STUB_PORT = Number(process.env.PW_STUB_PORT ?? 4010);

// O web sobe em PRODUCAO (`next build && next start`), nao em `next dev`: o dev (a) bloqueia recursos de dev para a origem
// 127.0.0.1 (allowedDevOrigins) e a pagina nao hidrata, (b) injeta o overlay "N" (<nextjs-portal>) que intercepta cliques
// no canto inferior esquerdo e vira "partially obscured" no axe. `reuseExistingServer` permite apontar para um `next dev`
// com `allowedDevOrigins` quando se quiser iterar. O baseURL usa `localhost` para funcionar nos dois modos.
// ATENCAO: `next build` e `next dev` compartilham o mesmo `.next`; nao rode a suite enquanto outro `next dev` (ou build)
// estiver ativo neste diretorio, ou os dois corrompem o cache um do outro.
// Playwright + axe (ADR 9.5 camada 2 / 11.5). O Next roda contra o stub da API (e2e/stub-api), nunca contra a API real.
export default defineConfig({
  testDir: "./e2e",
  testMatch: "**/*.pw.ts",
  fullyParallel: false,
  workers: 1,
  retries: process.env.CI ? 1 : 0,
  reporter: [["list"]],
  use: {
    baseURL: `http://localhost:${WEB_PORT}`,
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
      command: `npx next build && npx next start -p ${WEB_PORT}`,
      port: WEB_PORT,
      env: { API_URL: `http://127.0.0.1:${STUB_PORT}` },
      reuseExistingServer: !process.env.CI,
      timeout: 300_000,
    },
  ],
});
