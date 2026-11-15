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

### Autenticação, primeiro administrador e conta demo (ADR 0005, ADR 0013)

- `SESSION_TOKEN_SECRET` (>= 32 bytes) é obrigatória: a API não sobe sem ela.
- **Primeiro administrador:** com o banco sem usuários, `main.ts` lê `ADMIN_NAME`, `ADMIN_EMAIL` e `ADMIN_PASSWORD` **antes** de escutar a porta e cria o administrador (com troca de senha obrigatória no primeiro acesso). Variáveis ausentes ou inválidas abortam o boot e o log traz só os nomes e códigos, nunca os valores. Se já havia cartões ou lançamentos (banco anterior à autenticação), eles pertencem a esse administrador. Depois da primeira subida, `ADMIN_*` podem sair do ambiente; mudá-las não altera nada.
- **Conta demo:** `npx prisma db seed` (o `CMD` do Docker já o executa) cria/atualiza a conta `demo@showcase.invalid` conforme `SHOWCASE_ACCOUNT_PASSWORD` (vazia desliga; use `demo` onde o web mostrar a dica `DEMO_ACCOUNT_HINT`) e, com a conta ativa, grava o dataset de exemplo do mês corrente. Login com o alias `demo` ou com o e-mail. Em desenvolvimento: `npm run build && npm run seed`. Não existe mais demonstração pública (`/api/demo/*` responde 404).
- **Rotina da conta demo:** todo dia às 03:00 America/Sao_Paulo (com `MAINTENANCE_INTERVAL_MS` diferente de `0`) a tarefa `reset-demo-account` apaga os dados da conta e restaura o dataset de exemplo, sem revogar sessões. Na subida do processo ela só roda se ainda não houve redefinição desde o último 03:00. Manual (sem HTTP): `docker exec <container-da-api> npm run demo:reset`. No primeiro deploy a conta é redefinida uma vez.
- **Recuperar o acesso de administrador** (somente por linha de comando, dentro do container, nunca por HTTP):

```bash
docker exec -i <container-da-api> sh -c 'RECOVERY_PASSWORD="<senha temporária>" npm run admin:recover -- --email <email>'
```

  Promove o usuário a administrador, reativa, redefine a senha (com troca obrigatória) e encerra todas as sessões. A senha nunca vai como argumento (aparece em `ps`): use `RECOVERY_PASSWORD` ou a entrada padrão.
- A API **não deve ser exposta**: só o servidor do web a alcança, pela rede interna. O IP do cliente vem do `X-Forwarded-For` (`TRUST_PROXY`).

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
| `npm run seed` | Conta demo + dataset de exemplo (após `npm run build`) |
| `npm run demo:reset` | Redefine a conta demo agora (apaga tudo e restaura o dataset de exemplo; após `npm run build`; ver acima) |
| `npm run admin:recover -- --email <email>` | Recuperação de acesso de administrador (após `npm run build`; ver acima) |

## Desempenho (RNF06)

`npm run perf:rnf06` sobe um Postgres 17 descartável (testcontainers), semeia 100 mil lançamentos em 24 meses e 20 cartões (`test/perf/seed-volume.ts`, determinístico) e mede por HTTP real, por cenário, 5 aquecimentos e 50 amostras sequenciais (p50/p95/máx). Cada cenário exige p95 < 300 ms. O uso de índices é obtido por `EXPLAIN (ANALYZE)` de cada cenário. Os resultados são gravados em `test/perf/results/` (ignorado pelo git). Ver ADR 0002, T4 e seção 7.

## Estrutura

```
src/modules/finance/{domain,application,infrastructure,presentation}
src/shared/            # kernel (Money, CalendarDate, YearMonth, AppError), Prisma, filtro de erros, pipe zod
src/bootstrap/         # configureApp: prefixo /api e filtro de erros (usado por main.ts e pelos e2e)
```

Dependências apontam para dentro; `domain` não importa NestJS, Prisma nem bibliotecas externas.
