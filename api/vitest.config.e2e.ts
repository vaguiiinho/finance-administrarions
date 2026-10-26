import { defineConfig } from 'vitest/config';

process.env.TZ = 'America/Sao_Paulo';

// e2e: app Nest real (configureApp compartilhado) + supertest + Postgres em container.
export default defineConfig({
  resolve: { tsconfigPaths: true },
  test: {
    globals: true,
    root: './',
    include: ['test/**/*.e2e-spec.ts'],
    globalSetup: ['./test/support/global-setup-db.ts'],
    fileParallelism: false,
    testTimeout: 60_000,
    hookTimeout: 180_000,
  },
});
