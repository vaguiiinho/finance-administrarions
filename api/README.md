# api

API NestJS 12 (ESM) com Prisma 7 (`@prisma/adapter-pg`) e PostgreSQL. Todas as rotas ficam sob `/api`. Visão geral, regras de negócio e como rodar o projeto: [`../README.md`](../README.md). Endpoints e erros: [`../docs/api/finance.md`](../docs/api/finance.md).

## Rodar

```bash
npm install
export DATABASE_URL="postgresql://postgres:postgres@localhost:5432/finance"   # obrigatória (ver .env.example)
npm run prisma:generate
npm run prisma:migrate:deploy
PORT=3001 npm run start:dev      # padrão do código: 3000; o web espera 3001
```

`DATABASE_URL` deve estar no ambiente do processo (a API não carrega `.env`). A sessão do banco é aberta com `timezone=UTC` e `datestyle=ISO`.

## Scripts

| Script | Descrição |
|---|---|
| `npm run build` / `start:prod` | Compila (`prebuild` gera o client Prisma) / executa `dist/main` |
| `npm test` | Unitários (domain/application) |
| `npm run test:cov` | Unitários com cobertura mínima de 80% |
| `npm run test:int` | Integração com Postgres via testcontainers (requer Docker) |
| `npm run test:e2e` | E2E com supertest |
| `npm run test:all` | `test:cov` + `test:int` + `test:e2e` |
| `npm run perf:rnf06` | Medição opt-in do RNF06 (p95 < 300 ms) com 100 mil lançamentos; requer Docker (testcontainers). Não roda em `test:all` nem no CI |
| `npm run lint` | oxlint (type-aware) |
| `npm run typecheck` | `tsc --noEmit -p tsconfig.build.json` |
| `npm run prisma:generate` | Gera o client em `src/shared/infrastructure/prisma/generated` |
| `npm run prisma:migrate:deploy` | Aplica as migrations de `prisma/migrations` |

## Desempenho (RNF06)

`npm run perf:rnf06` sobe um Postgres 17 descartável (testcontainers), semeia 100 mil lançamentos em 24 meses e 20 cartões (`test/perf/seed-volume.ts`, determinístico) e mede por HTTP real, por cenário, 5 aquecimentos e 50 amostras sequenciais (p50/p95/máx). Cada cenário exige p95 < 300 ms. O uso de índices é obtido por `EXPLAIN (ANALYZE)` de cada cenário. Os resultados são gravados em `test/perf/results/` (ignorado pelo git). Ver ADR 0002, T4 e seção 7.

## Estrutura

```
src/modules/finance/{domain,application,infrastructure,presentation}
src/shared/            # kernel (Money, CalendarDate, YearMonth, AppError), Prisma, filtro de erros, pipe zod
src/bootstrap/         # configureApp: prefixo /api e filtro de erros (usado por main.ts e pelos e2e)
```

Dependências apontam para dentro; `domain` não importa NestJS, Prisma nem bibliotecas externas.
