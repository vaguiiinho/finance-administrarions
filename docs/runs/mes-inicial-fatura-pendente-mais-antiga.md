# Execução: mês inicial pela fatura pendente mais antiga

Data: 2026-11-01. Implementação sem commit.

## Aprovação

O usuário aprovou a regra: faturas de cartão pendentes anteriores a M contam; PIX antigo continua ignorado. O mês explícito e o fallback atual permanecem.

## Subagentes e etapas

| Ordem | Agente/etapa | Resultado | Arquivos gerados ou alterados |
|---|---|---|---|
| 1 | `planner` | Tentativa de inicialização falhou: modelo configurado indisponível. Spec preparada diretamente. | `docs/specs/mes-inicial-fatura-pendente-mais-antiga.md` |
| 2 | `architect` | ADR preparado diretamente após a falha do planner. | `docs/adr/0009-mes-inicial-fatura-pendente-mais-antiga.md` |
| 3 | `ui-designer` | Sem agente; design restrito ao comportamento, sem novos componentes ou estilos. | `docs/design/mes-inicial-fatura-pendente-mais-antiga.md` |
| 4 | Usuário | Aprovou spec, ADR e design. | — |
| 5 | `tester` (RED) | Tentativa de inicialização falhou: modelo configurado indisponível. Testes RED foram escritos diretamente e falharam antes da implementação. | Testes e fixture abaixo |
| 6 | Implementação | Alterações API, stub e e2e realizadas diretamente. | Arquivos abaixo |
| 7 | Tester (verificação) | Verificação focada realizada diretamente; sem subagente. | — |
| 8 | `code-reviewer` | Não iniciado; revisão feita diretamente devido à indisponibilidade dos modelos de subagentes. | — |
| 9 | `doc-writer` | Documentação atualizada diretamente. | Arquivos abaixo |

## Arquivos alterados

**API**
- `api/src/modules/finance/domain/initial-month/resolve-initial-month.ts`
- `api/src/modules/finance/domain/initial-month/resolve-initial-month.spec.ts`
- `api/src/modules/finance/application/ports/pending-overview-read-model.ts`
- `api/src/modules/finance/application/use-cases/entries/get-initial-entries-month.ts`
- `api/src/modules/finance/application/use-cases/entries/get-initial-entries-month.spec.ts`
- `api/src/modules/finance/infrastructure/read-models/pending-overview-read-model.prisma.ts`
- `api/src/modules/finance/infrastructure/read-models.int-spec.ts`
- `api/test/e2e/initial-month.e2e-spec.ts`
- `api/test/fixtures/initial-month.cases.json`
- `api/test/perf/rnf06.perf-spec.ts`

**Web**
- `web/e2e/initial-month.pw.ts`
- `web/e2e/stub-api/initial-month.mjs`
- `web/e2e/stub-api/initial-month.spec.ts`
- `web/e2e/stub-api/server.mjs`
- `web/features/entries/redirect-to-initial-month.spec.ts`
- `web/README.md`

**Documentação**
- `docs/specs/mes-inicial-fatura-pendente-mais-antiga.md`
- `docs/adr/0009-mes-inicial-fatura-pendente-mais-antiga.md`
- `docs/design/mes-inicial-fatura-pendente-mais-antiga.md`
- `docs/specs/listagem-mes-e-status-padrao.md`
- `docs/adr/0007-listagem-mes-e-status-padrao.md`
- `docs/api/finance.md`
- `CHANGELOG.md`
- `docs/runs/mes-inicial-fatura-pendente-mais-antiga.md`

## Verificação

| Comando | Resultado |
|---|---|
| API unit tests de domínio e caso de uso | 46 passaram |
| API integration test `read-models.int-spec.ts` | 60 passaram |
| API e2e `initial-month.e2e-spec.ts` | 26 passaram |
| Web Vitest de redirect e paridade do stub | 48 passaram |
| Playwright completo `initial-month.pw.ts` | 47 passaram |
| API `npm run typecheck` | Passou |
| Web `npx tsc --noEmit` | Passou |
| Oxlint e ESLint nos arquivos de teste alterados | Passaram |
| `git diff --check` nos arquivos alterados | Passou |
| RNF06 focado (`IM1`, `IM2`, `IM3`; 100 mil lançamentos; 50 amostras) | Passou; p95 de 22 ms, 7 ms e 7 ms, respectivamente; os planos usaram índice em `entries` e não fizeram Seq Scan nessa tabela |
