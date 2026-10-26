import { defineConfig } from 'vitest/config';

process.env.TZ = 'America/Sao_Paulo';

// Desempenho (RNF06, ADR 0002 T4): opt-in via `npm run perf:rnf06`. O sufixo `.perf-spec.ts` nao casa com o `include`
// das outras configs, entao esta suite nunca roda em test, test:int, test:e2e nem test:all.
export default defineConfig({
  resolve: { tsconfigPaths: true },
  test: {
    globals: true,
    root: './',
    include: ['test/perf/**/*.perf-spec.ts'],
    globalSetup: ['./test/support/global-setup-db.ts'],
    fileParallelism: false,
    testTimeout: 600_000,
    hookTimeout: 900_000,
  },
});
