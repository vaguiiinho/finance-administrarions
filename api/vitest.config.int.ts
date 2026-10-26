import { defineConfig } from 'vitest/config';

process.env.TZ = 'America/Sao_Paulo';

// Integração: Postgres real (testcontainers) + migrations. Um container para toda a suíte.
export default defineConfig({
  resolve: { tsconfigPaths: true },
  test: {
    globals: true,
    root: './',
    include: ['src/**/*.int-spec.ts', 'test/**/*.int-spec.ts'],
    globalSetup: ['./test/support/global-setup-db.ts'],
    fileParallelism: false,
    testTimeout: 60_000,
    hookTimeout: 180_000,
  },
});
