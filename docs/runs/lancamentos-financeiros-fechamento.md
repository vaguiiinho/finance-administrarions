# Execução da feature: fechamento de lançamentos financeiros

- Data: 2026-10-25
- Branch: `feature/finance`
- Pedido: "verifique o que falte e conclua a feature finance"
- Fluxo: `/feature` (planner → architect → ui-designer → aprovação → tester red → backend-dev / frontend-dev → tester verificação → code-reviewer → doc-writer)
- Execução anterior: [lancamentos-financeiros.md](lancamentos-financeiros.md). As pendências listadas nela foram tratadas aqui.
- Resultado final: code-reviewer sem itens 🔴. Os 7 🟡 da 1ª revisão foram corrigidos; a re-revisão apontou 1 🟡 restante, corrigido em seguida (sem 3ª revisão). Smoke com API real ok.

## Subagentes acionados (em ordem)

| # | Subagente | Etapa | Arquivos gerados ou alterados |
|---|---|---|---|
| 1 | planner | Spec de fechamento (gaps G1-G11, CAF01-CAF13, B1/B2, 21 tarefas) | `docs/specs/lancamentos-financeiros-fechamento.md` (criado) |
| 2 | architect | ADR 0002 (T1-T5, propostas B1/B2) | `docs/adr/0002-lancamentos-financeiros-fechamento.md` (criado) |
| 3 | ui-designer | Design rev. 4 (em paralelo com o 2): follow-ups de UX alinhados ao código, desvio 2 (§12), §13 com divergências F1-F6 e matriz CA82/CA83/CA86 | `docs/design/lancamentos-financeiros.md` |
| — | *aprovação* | O usuário aprovou spec, ADR e design com as respostas padrão de B1 e B2. O orquestrador marcou o ADR como Aceito, B1/B2 como aprovados e removeu o botão "perigo" do CAF07 | `docs/adr/0002-…`, `docs/design/lancamentos-financeiros.md`, `docs/specs/lancamentos-financeiros-fechamento.md` |
| 4 | tester (RED) | Testes que falham e infra de e2e. Playwright executado pela 1ª vez (libs via `dpkg -x`); `playwright.config.ts` passou a usar build de produção. Corrigiu 3 testes antigos errados | api: `test/fixtures/invoice-dates.cases.json`, `calculate-invoice-dates.spec.ts`, `vitest.config.perf.ts`, `test/perf/{p95,seed-volume}.spec.ts`, `test/perf/rnf06.perf-spec.ts`, `package.json`, `.gitignore`. web: `vitest.config.mts`, `playwright.config.ts`, `e2e/{contrast,pseudo-state,tokens,support}.ts`, `e2e/contrast.spec.ts`, `e2e/stub-api/invoice-dates.spec.ts`, `scripts/pw-deps.spec.ts`, `e2e/{buttons,dark-theme,theme-charts,cards,charts-keyboard,combobox}.pw.ts`, `e2e/{a11y,entries}.pw.ts`, `components/ui/combobox.spec.tsx`, `entries/_components/{category-focus,recent-highlight,recent-highlight-scope}.spec.tsx`, `dashboard/_components/monthly-chart-a11y.spec.tsx` |
| 5 | backend-dev | Seed de volume e p95 (sem Docker naquele momento) | `api/test/perf/p95.ts`, `api/test/perf/seed-volume.ts` |
| 6 | frontend-dev | F1-F6, eixo Y fixo vazio, literais de cor, contraste `:active` terciário, botão carregando, `pw-deps.sh`, stub (em paralelo com o 5) | `components/ui/combobox.tsx`, `entries/_components/{entry-drawer-context,new-entry-drawer}.tsx`, `dashboard/_components/monthly-chart.tsx`, `app/globals.css`, `app/styles/tokens.css`, `lib/theme/{contrast-pairs.ts,tokens.spec.ts}`, `scripts/pw-deps.sh`, `package.json`, `e2e/stub-api/{invoice-dates.mjs,server.mjs}`, `e2e/{theme,charts-keyboard,cards}.pw.ts` |
| 7 | tester (verificação) | Todas as suítes, incluindo `perf:rnf06` com Docker; CAF01-CAF13 conferidos | — (não alterou arquivos) |
| 8 | code-reviewer | 0 🔴, 7 🟡, sugestões | — (não altera código) |
| 9 | frontend-dev | Correções 🟡 do web: `audit()` restrito, matriz de botões completa, `pw-deps.sh` robusto, destaque respeitando filtros, gate `holdQueries`, sugestões | `e2e/{support,contrast}.ts`, `e2e/contrast.spec.ts`, `e2e/{a11y,dark-theme,buttons,cards,entries}.pw.ts`, `e2e/stub-api/server.mjs`, `playwright.config.ts`, `scripts/pw-deps.{sh,spec.ts}`, `components/navigation.tsx`, `components/ui/combobox.{tsx,spec.tsx}`, `app/globals.css`, `lib/entries/feedback.ts`, `entries/_components/{entry-drawer-context,new-entry-drawer}.tsx`, `recent-highlight{,-scope}.spec.tsx`, `docs/adr/0002-…` (nota em T2) |
| 10 | backend-dev | Sugestões da api (em paralelo com o 9): caminho do fixture, lint, EXPLAIN por cenário no perf | `api/src/modules/finance/domain/billing/calculate-invoice-dates.spec.ts`, `api/test/e2e/queries.e2e-spec.ts`, `api/test/perf/rnf06.perf-spec.ts` |
| 11 | doc-writer | Documentação | `docs/specs/lancamentos-financeiros.md`, `docs/adr/0001-lancamentos-financeiros.md` (§15), `docs/adr/0002-…` (§7), `docs/design/lancamentos-financeiros.md` (§1.2, §1.8, §1.9), `docs/design/design-system.md`, `README.md`, `api/README.md`, `web/README.md`, `CHANGELOG.md` |
| — | orquestrador | Este registro | `docs/runs/lancamentos-financeiros-fechamento.md` |
| 12 | code-reviewer | Re-revisão da rodada 🟡: 6 dos 7 resolvidos, 1 🟡 restante (`pw-deps.sh` gravava o marcador após falha) | — |
| 13 | tester (verificação final, em paralelo com o 12) | `test:int`, cobertura, CAF06 estado a estado, CAF11 e smoke com API real (Postgres temporário, api e web em produção): tudo ok | — (script descartável no scratchpad) |
| 14 | frontend-dev | Último 🟡 e sugestões | `web/scripts/pw-deps.{sh,spec.ts}`, `web/e2e/a11y.pw.ts`, `web/app/globals.css`, `recent-highlight-scope.spec.tsx`, `docs/adr/0002-…` (anotações "substituído pela §7") |

## Estado final dos testes

| Projeto | Suíte | Resultado |
|---|---|---|
| api | unit (`npm test`) | 489 passam |
| api | cobertura | 95,46% statements, 94,68% branches |
| api | integração (`test:int`) | 130 passam |
| api | e2e (`test:e2e`) | 182 passam |
| api | `perf:rnf06` (100 mil lançamentos, 20 cartões) | 18 passam; p95 máximo 47 ms (E6 categorias), limite 300 ms |
| api | lint, typecheck | ok, 0 warnings |
| api | cobertura por camada | application 96,21% lines, domain 97,12% lines |
| web | unit e componente (`npm test`) | 652 passam |
| web | cobertura | 92,36% statements, 87,55% branches, 94,19% lines |
| web | tsc, lint, build | ok |
| web | Playwright + axe (`test:e2e:local`, build de produção) | 194 passam |

## Pendências conhecidas
- Não há CI (G11): o RNF11 não roda de forma recorrente. Os comandos estão no `web/README.md`.
- D2 (série mensal) faz Seq Scan em `entries` (p95 26 ms). Avaliar índice em `reference_month` ou filtro de janela se o volume crescer.
- `web/AGENTS.md`: o usuário excluiu o arquivo e trata à parte; a remoção não entra no commit da feature. O `next dev` o recria enquanto `experimental.agentFeedback` estiver em `web/next.config.ts`.
- Texto do 409 de cartão diverge: web/stub usam "esse nome", a API devolve "este nome" (o web exibe a mensagem da API quando há).
- 404 e 500 do drawer de cartão só têm teste unitário (sem e2e/axe). Não há estado "toast de erro" na auditoria axe.
- Cobertura baixa em `monthly-chart.tsx` (72,8%), `app-header.tsx`, `entries-header.tsx` e `drawer-host` (0% em unit; cobertos só por e2e).

## Smoke com API real (2026-10-25)
Cartão criado e editado, 409 inline no duplicado, despesa no cartão após o fechamento caiu na fatura nov/26 (vence 28/11/2026), receita PIX, fatura paga e totais do dashboard de out e nov conferidos. Nenhum defeito.
