import { defineConfig } from 'vitest/config';

process.env.TZ = 'America/Sao_Paulo';

// Suite unitária: domain + application (sem I/O). Integração e e2e têm configs próprias.
export default defineConfig({
  resolve: { tsconfigPaths: true },
  test: {
    globals: true,
    root: './',
    include: ['src/**/*.spec.ts', 'test/**/*.spec.ts'],
    coverage: {
      provider: 'v8',
      include: ['src/**/domain/**/*.ts', 'src/**/application/**/*.ts', 'src/bootstrap/demo-account/**/*.ts'],
      exclude: ['**/*.spec.ts', '**/*.int-spec.ts', '**/*.e2e-spec.ts', '**/index.ts'],
      reporter: ['text', 'text-summary', 'lcov'],
      thresholds: { lines: 80, functions: 80, branches: 80, statements: 80 },
    },
  },
});
