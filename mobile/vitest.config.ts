import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

// Regras puras (src/lib sincronizado com o web + src/core). Node, sem React Native (ADR 0011 10.2, 11.3).
export default defineConfig({
  resolve: { alias: { '@/lib': fileURLToPath(new URL('./src/lib', import.meta.url)), '@/core': fileURLToPath(new URL('./src/core', import.meta.url)) } },
  test: { globals: true, environment: 'node', include: ['src/**/*.spec.ts'], env: { TZ: 'UTC' },
    coverage: { provider: 'v8', include: ['src/lib/**/*.ts', 'src/core/**/*.ts'], exclude: ['**/*.spec.ts'], reporter: ['text-summary', 'text'],
      // Barra regressoes no CI (CLAUDE.md: minimo 80%): total de lib+core e, separadamente, src/core.
      thresholds: { statements: 80, lines: 80, 'src/core/**': { statements: 80, lines: 80 } },
    },
  },
});
