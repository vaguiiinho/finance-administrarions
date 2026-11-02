import { fileURLToPath } from "node:url";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";

// Testes unitarios e de componente (Vitest + Testing Library). Playwright fica em web/e2e (*.pw.ts); e2e/**/*.spec.ts
// (ex.: paridade do stub da API, ADR 0002 T5) roda aqui.
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: { "@": fileURLToPath(new URL("./", import.meta.url)) },
  },
  test: {
    globals: true,
    environment: "jsdom",
    include: ["**/*.spec.{ts,tsx}"],
    exclude: ["node_modules/**", ".next/**", "e2e/**/*.pw.ts"],
    setupFiles: ["./vitest.setup.ts"],
    env: { TZ: "America/Sao_Paulo", SUPPORT_EMAIL: "suporte@example.com" },
    coverage: {
      provider: "v8",
      include: ["lib/**/*.ts", "components/**/*.{ts,tsx}", "features/**/*.{ts,tsx}", "app/**/_components/**/*.{ts,tsx}", "app/**/actions.ts"],
      exclude: ["**/*.spec.{ts,tsx}", "**/test-support.tsx", "lib/api/**"],
      reporter: ["text", "text-summary"],
      thresholds: { lines: 80, functions: 80, branches: 80, statements: 80 },
    },
  },
});
