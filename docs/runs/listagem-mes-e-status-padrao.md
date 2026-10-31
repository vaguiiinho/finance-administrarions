# Execução: listagem com mês e status padrão

Data: 2026-10-30. Branch: `feat/listies`. Base: `cad1728`. Alterações na árvore de trabalho, sem commit.

## Subagentes acionados, em ordem

| # | Subagente | Etapa | Arquivos gerados ou alterados |
|---|---|---|---|
| 1 | `planner` | Spec, depois duas revisões com as decisões do usuário | `docs/specs/listagem-mes-e-status-padrao.md` |
| 2 | `architect` | ADR, depois registro das decisões | `docs/adr/0007-listagem-mes-e-status-padrao.md` |
| 3 | `ui-designer` | Design, depois registro das decisões | `docs/design/listagem-mes-e-status-padrao.md` |
| - | Usuário | Aprovação da etapa 4, com as recomendações | - |
| 4 | `tester` (RED) | Testes que falham e stubs mínimos | Testes e stubs listados em "Arquivos por área" |
| 5 | `backend-dev` | Tarefas [api] e [db] | `api/` e `docs/api/finance.md` |
| 6 | `frontend-dev` | Tarefas [web] | `web/` |
| 7 | `tester` (verificação, ciclo 1) | Suítes, cobertura e baseline | `api/test/e2e/initial-month.e2e-spec.ts` (teste do CA05) |
| 8 | `code-reviewer` (ciclo 1) | 2 itens 🔴 e 2 itens 🟡 tratados | Nenhum |
| 9 | `frontend-dev` (ciclo 2) | Correções da revisão | `web/.gitignore` e `web/next.config.ts` (voltaram ao original), `web/eslint.config.mjs` (voltou ao original), `expense-filters.tsx`, `invoice-status-filter.tsx`, `expenses-list.tsx`, `entry-drawer-context.tsx` e testes |
| 10 | `tester` (verificação, ciclo 2) | Suítes, cobertura e Playwright completo | Nenhum |
| 11 | `code-reviewer` (ciclo 2) | Aprovado, sem 🔴, com 3 itens 🟡 | Nenhum |
| 12 | `frontend-dev` (ciclo 3) | Itens 🟡 de foco | `web/app/globals.css`, `expenses-list.tsx`, `expenses-list.spec.tsx`, `web/e2e/status-filter.pw.ts` |
| 13 | `doc-writer` | Documentação | `README.md`, `web/README.md`, `CHANGELOG.md`, `docs/api/finance.md`, ADRs 0005 e 0007, spec e design de origem e da feature |

O relatório do `frontend-dev` no ciclo 2 não chegou à sessão principal. As correções foram conferidas direto no código.

## Arquivos por área

Caminhos curtos são relativos a `api/src/modules/finance/` ou `web/`.

**API, produção**
- Novos: `domain/initial-month/resolve-initial-month.ts`, `application/ports/pending-overview-read-model.ts`, `application/use-cases/entries/get-initial-entries-month.ts`, `infrastructure/read-models/pending-overview-read-model.prisma.ts`.
- Alterados: `domain/billing/reference-month.ts`, `application/ports/invoice-read-model.ts`, `application/queries/query-params.ts`, `application/use-cases/invoices/list-invoices.ts`, `infrastructure/read-models/invoice-read-model.prisma.ts`, `infrastructure/finance-infrastructure.providers.ts`, `finance.module.ts`, `presentation/http/` (`demo.controller.ts`, `entries.controller.ts`, `invoices.controller.ts`, `finance-read-handlers.ts`, `schemas/query.schemas.ts`).

**API, testes**
- Novos: `domain/initial-month/resolve-initial-month.spec.ts`, `get-initial-entries-month.spec.ts`, `api/src/shared/infrastructure/sao-paulo-business-calendar.spec.ts`, `api/test/e2e/initial-month.e2e-spec.ts`, `api/test/fixtures/initial-month.cases.json`.
- Alterados: `invoices-queries.spec.ts`, `reference-month.spec.ts`, `read-models.int-spec.ts`, `owner-isolation.int-spec.ts`, `api/test/e2e/` (`access-control`, `demo`, `queries`), `api/test/perf/rnf06.perf-spec.ts`, `api/test/support/infra.ts`.

**Web, produção**
- Novos: `lib/filters/initial-month.ts`, `lib/entries/focus-target.ts`, `features/entries/redirect-to-initial-month.ts` e, em `features/entries/_components/`: `month-advance-notice.tsx`, `invoice-status-filter.tsx`, `status-filter-field.tsx`, `use-focus-after-close.ts`, `panel-ids.ts`.
- Alterados: `app/(protected)/entries/page.tsx`, `app/(public)/demo/entries/page.tsx`, `app/globals.css`, `components/ui/states.tsx`, `lib/api/` (`endpoints.ts`, `finance-reader.ts`, `http.ts`), `lib/entries/feedback.ts`, `lib/filters/entries-search-params.ts`, `features/entries/entries-screen.tsx` e, em `features/entries/_components/`: `entry-drawer-context.tsx`, `expense-filters.tsx`, `expenses-list.tsx`, `expenses-panel.tsx`, `income-panel.tsx`, `invoice-block.tsx`, `invoices-panel.tsx`, `panel-skeletons.tsx`.

**Web, testes e suporte**
- Novos: `lib/filters/initial-month.spec.ts`, `lib/entries/focus-target.spec.ts`, `features/entries/redirect-to-initial-month.spec.ts`, `invoice-status-filter.spec.tsx`, `month-advance-notice.spec.tsx`, `e2e/initial-month.pw.ts`, `e2e/status-filter.pw.ts`, `e2e/entries-data.ts`, `e2e/stub-api/initial-month.mjs`, `e2e/stub-api/initial-month.spec.ts`.
- Alterados: `playwright.config.ts`, `e2e/support.ts`, `e2e/stub-api/server.mjs`, `e2e/` (`a11y`, `auth-login`, `buttons`, `demo-shell`, `entries`), specs de `feedback`, `entries-search-params`, `finance-reader`, `panels`, `invoice-block`, `expenses-list`, `new-entry-drawer`, `recent-highlight` e `recent-highlight-scope`.

## Resultados

**Última verificação completa (ciclo 2)**

| Comando | Resultado |
|---|---|
| API `npm test` | 915 testes passando |
| Web `vitest` | 1753 testes passando |
| Web `tsc`, eslint | Limpos |
| Web `next build` | Passou, dentro do `webServer` do Playwright |
| Web Playwright completo | 572 testes: 562 passaram, 10 falharam |

**Ciclo 1 (API, sem mudança depois)**

| Comando | Resultado |
|---|---|
| `npm run test:int` | 222 testes passando |
| `npm run test:e2e` | 309 testes passando; depois, com o teste do CA05, `initial-month.e2e-spec.ts` passou 24/24 |
| `tsc --noEmit`, `npm run lint` | Sem erros |
| Cobertura total | 96,4% statements, 94,87% branches |

Arquivos novos de domain/application têm 100% de linhas. `list-invoices.ts` tem 75% de branches, por um guard anterior à feature; o limite de 80% é global.

**Ciclo 3 (recorte, depois das últimas correções)**

| Comando | Resultado |
|---|---|
| Web `vitest` | 1754 testes passando |
| Web `tsc`, eslint | Limpos |
| Playwright `status-filter.pw.ts` | 45 passaram, 0 falharam |
| Playwright `a11y.pw.ts` | Sem falhas próprias; o filtro também incluiu `auth-a11y.pw.ts`, com as 4 falhas já conhecidas |

O Playwright completo não foi repetido depois do ciclo 3.

**Falhas anteriores à feature**

As 10 falhas também ocorrem em `cad1728`, com a mesma causa: `auth-a11y` CA46 (4), `auth-account` CA09 e CA10, `auth-login` CA04, CA05 e CA42, `demo-shell` CA38 de `/demo/cards`.

**Desempenho (RNF01): 100 mil lançamentos, 50 amostras, limite de 300 ms**

| Cenário | p50 | p95 | Máx. | `EXPLAIN` (execução) |
|---|---|---|---|---|
| IM1 | 4 ms | 6 ms | 6 ms | 0,11 ms |
| IM2 (pior caso) | 5 ms | 6 ms | 7 ms | 0,33 ms |
| I1 `status=PENDING` | 7 ms | 10 ms | 11 ms | 4,39 ms |
| I1 `status=PAID` | 7 ms | 9 ms | 10 ms | 2,56 ms |
| I1 sem `status` | 7 ms | 12 ms | 19 ms | 2,92 ms |

Todos usam `entries_owner_month_type_status_idx`, sem Seq Scan em `entries`. O mês inicial faz uma única consulta. Nenhuma migração foi criada.

Carregamento (R9), contra o stub: p95 de 456 ms com `month` e 381 ms com redirecionamento. Não há medição com a API real.

## Pendências

- Conferência manual com leitor de tela: anúncio do aviso na carga e sequência do h2 e do toast depois de pagar.
- As 10 falhas anteriores do Playwright, em tarefa própria.
- Itens 🔵 da revisão do ciclo 1, não tratados.
