# Execução da feature: lançamentos financeiros

- Data: 2026-10-24
- Branch: `feature/finance`
- Fluxo: `/feature` (planner → architect → ui-designer → aprovação → tester red → backend-dev / frontend-dev → tester verificação → code-reviewer → doc-writer)
- Resultado final: aprovado pelo code-reviewer, sem itens 🔴. Os itens 🟡 foram corrigidos numa rodada extra.

## Subagentes acionados (em ordem)

| # | Subagente | Etapa | Arquivos gerados ou alterados |
|---|---|---|---|
| 1 | planner | Spec rev. 1 | `docs/specs/lancamentos-financeiros.md` (criado) |
| 2 | architect | ADR rev. 1 | `docs/adr/0001-lancamentos-financeiros.md` (criado) |
| 3 | ui-designer | Design rev. 1 | `docs/design/lancamentos-financeiros.md` (criado) |
| — | *aprovação* | O usuário respondeu B1–B5 e D1–D5: receitas/despesas, cartões, tema claro/escuro | — |
| 4 | planner | Spec rev. 2 | `docs/specs/lancamentos-financeiros.md` |
| 5 | architect | ADR rev. 2 | `docs/adr/0001-lancamentos-financeiros.md` |
| 6 | ui-designer | Design rev. 2 | `docs/design/lancamentos-financeiros.md` |
| — | *aprovação* | O usuário respondeu B6/B7: só seletor de mês, mês pelo vencimento, PIX e Cartão, abas | — |
| 7 | planner | Spec rev. 3 | `docs/specs/lancamentos-financeiros.md` |
| 8 | architect | ADR rev. 3 (parou no limite de uso e foi retomado) | `docs/adr/0001-lancamentos-financeiros.md` |
| 9 | ui-designer | Design rev. 3 (em paralelo com o 8) | `docs/design/lancamentos-financeiros.md` |
| — | *aprovação* | O usuário aprovou B8/B9 e a rev. 3. O orquestrador marcou o ADR como Aceito | `docs/adr/0001-lancamentos-financeiros.md` (status) |
| 10 | tester (RED) | Testes que falham e infraestrutura de testes | api: `package.json`, `tsconfig.json`, `vitest.config.ts`, `vitest.config.e2e.ts`, `vitest.config.int.ts`, `test/support/*`, `test/fakes/*`, `test/architecture.spec.ts`, `test/infra-smoke.int-spec.ts`, `test/e2e/*.e2e-spec.ts`, specs `src/**/*.spec.ts` e `src/modules/finance/infrastructure/*.int-spec.ts`. web: `package.json`, `.gitignore`, `vitest.config.mts`, `vitest.setup.ts`, `playwright.config.ts`, `lib/**/*.spec.ts`, `test/no-literal-colors.spec.ts`, `e2e/*.pw.ts`, `e2e/support.ts`, `e2e/stub-api/server.mjs` |
| 11 | backend-dev | Tarefas [api] e [db] | `api/src/shared/**`, `api/src/modules/finance/**` (domain, application, infrastructure, presentation), `api/src/bootstrap/configure-app.ts`, `api/src/app.module.ts`, `api/src/main.ts`, `api/prisma/schema.prisma`, `api/prisma.config.ts`, `api/prisma/migrations/20261024000001_create_cards`, `…000002_create_entries`, `api/.env.example`, `api/.gitignore`, `api/package.json`. Removidos: `app.controller.ts`, `app.service.ts`, `app.controller.spec.ts`, `test/app.e2e-spec.ts` |
| 12 | frontend-dev | Tarefas [web] (em paralelo com o 11; parou no limite de uso e foi retomado) | `web/app/layout.tsx`, `page.tsx`, `global-error.tsx`, `globals.css`, `styles/tokens.css`, `app/(app)/**` (entries, cards, dashboard e `_components`), `web/components/**`, `web/lib/**` (money, dates, filters, theme, entries, dashboard, api), specs de componente, `test/helpers/*`, `next.config.ts`, `tsconfig.json`, `package.json` |
| 13 | tester (verificação) | Rodou as suítes, corrigiu 6 erros de tipo nos testes da api e alinhou com o design os testes que divergiam (17 falhas novas no web) | `api/.../create-entry.spec.ts`, `invoices-queries.spec.ts`, `entries.int-spec.ts`; `web/e2e/entries.pw.ts`, `new-entry-drawer.spec.tsx`, `expenses-list.spec.tsx`, `invoice-block.spec.tsx` |
| 14 | frontend-dev | Correções do tester e cobertura dos componentes | `new-entry-drawer.tsx`, `components/ui/{dialogs,modal-dialog,toast}.tsx`, `expenses-list.tsx`, `invoice-block.tsx`, `monthly-chart.tsx`, `vitest.config.mts`, specs novos (`dashboard*.spec.tsx`, `ui-misc.spec.tsx`, `panels.spec.tsx`, `cards.spec.tsx`), `test/helpers/recharts-mock.tsx` |
| 15 | code-reviewer | Revisão: APROVADO, 0 🔴, 6 🟡 e sugestões | — (não altera código) |
| 16 | backend-dev | Correções 🟡 da api | `query-params.ts`, `reference-month.ts`, `new-entry-input.ts`, `update-card.ts`, `prisma-card.repository.ts`, `prisma.service.ts`, `http-error.filter.ts`, migration `20261024000003_entries_checks_date_cast`, `test/e2e/hardening.e2e-spec.ts`, `infrastructure/hardening.int-spec.ts`, `test/architecture-presentation.spec.ts` e casos novos em specs |
| 17 | frontend-dev | Correções 🟡 do web (em paralelo com o 16) | `lib/api/validate.ts`, `lib/api/safe-action.ts`, `lib/api/endpoints.ts`, `app/(app)/entries/actions.ts`, `app/(app)/cards/actions.ts`, os 5 componentes com ação, `web/.env.example`, `web/.gitignore`, specs novos (`validate.spec.ts`, `endpoints.spec.ts`, `actions.spec.ts`) |
| 18 | doc-writer | Documentação | `README.md` (criado), `CHANGELOG.md` (criado), `docs/api/finance.md` (criado), `api/README.md`, `web/README.md`, `docs/design/design-system.md`, `docs/adr/0001-lancamentos-financeiros.md` (§15 Notas de implementação), `docs/design/lancamentos-financeiros.md` (§12 Desvios aceitos) |
| — | orquestrador | Este registro e o ajuste do motivo do ES2022 no ADR | `docs/runs/lancamentos-financeiros.md`, `docs/adr/0001-lancamentos-financeiros.md` |

## Estado final dos testes

| Projeto | Suíte | Resultado |
|---|---|---|
| api | unit (`npm test`) | 450 passam |
| api | cobertura domain + application | 95,46% statements, 94,68% branches, 96,74% lines |
| api | integração (`test:int`, Postgres 17 via testcontainers) | 130 passam |
| api | e2e (`test:e2e`, supertest) | 182 passam |
| api | lint, typecheck (incluindo testes), build | ok (6 warnings de lint em specs) |
| web | unit e componente (`npm test`) | 542 passam |
| web | cobertura (`lib`, `components`, `app/**/_components`) | 93,63% statements, 95,7% lines |
| web | lint, tsc, build | ok |
| web | Playwright + axe (63 testes) | **não executado**: faltam bibliotecas de sistema (`npx playwright install-deps` exige root) |

## Pendências conhecidas
- Rodar os 63 testes Playwright num ambiente com as bibliotecas de sistema do Chromium instaladas.
- CA83 (botões em todos os estados), CA85 e parte do CA86 só têm cobertura indireta (pares de contraste e ausência de cor literal).
- O CA84 emula a mídia em vez de clicar no botão de tema; o tester recomenda reescrever.
- Follow-ups de UX concluídos: eixo Y fixo no gráfico estreito, destaque de ~2s da linha/card novo, combobox ARIA de categoria com `Usar "<texto>"` e animações dos gráficos condicionadas a `prefers-reduced-motion` com destaque do donut pela legenda.

> Atualização 2026-10-25: as pendências acima foram tratadas no fechamento, ver [lancamentos-financeiros-fechamento.md](lancamentos-financeiros-fechamento.md).
