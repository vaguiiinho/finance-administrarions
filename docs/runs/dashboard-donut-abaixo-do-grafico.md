# Registro de execução — "Despesas por categoria" abaixo do gráfico de barras

Pedido: a legenda da rosca de "Despesas por categoria" saía do card e da tela; colocar o card abaixo do gráfico de barras.
Causa: em `lg`+ o card ficava numa coluna 4/12 ao lado da evolução mensal e, em `xl`, rosca (220px) + legenda ficavam lado a lado; valor (`Money`) e percentual (`w-14`) não encolhiam, então a linha passava da borda.
Branch: `bugfix/dashboard`. Escopo: só `web/` (sem api/db — backend-dev não acionado).
Aprovação do usuário (2026-11-02): spec, ADR e design aprovados com as recomendações — ponto de troca `@3xl` (no lugar do `@2xl` do ADR), escala de fonte do total no centro da rosca incluída, `break-words` no tooltip.

## Subagentes acionados, em ordem

| # | Subagente | Etapa | Arquivos gerados / alterados |
|---|---|---|---|
| 1 | planner | Spec | `docs/specs/dashboard-donut-abaixo-do-grafico.md` (Impacto em UI: sim) |
| 2 | architect | ADR | `docs/adr/0012-dashboard-donut-abaixo-do-grafico.md` |
| 3 | ui-designer | Design | `docs/design/dashboard-donut-abaixo-do-grafico.md` |
| — | — | **Aprovação do usuário** (`@3xl`; escala do total; `break-words`) | — |
| 4 | tester (RED) | Testes que falham | criados: `web/features/dashboard/_components/dashboard-layout.spec.tsx`, `web/features/dashboard/dashboard-loading.spec.tsx`, `web/features/dashboard/dashboard-screen.spec.tsx`, `web/features/dashboard/_components/category-donut-layout.spec.tsx`, `web/e2e/dashboard-worst-case.ts`, `web/e2e/dashboard-layout.pw.ts`. Resultado: Vitest 19 falhas (todas nos specs novos, pelo motivo certo), 1862 passando; Playwright não executado |
| 5 | frontend-dev (ciclo 1) | Implementação [web] | criados: `web/features/dashboard/_components/dashboard-layout.tsx`, `web/features/dashboard/_components/donut-layout.ts`; alterados: `web/features/dashboard/dashboard-screen.tsx`, `web/features/dashboard/dashboard-loading.tsx`, `web/features/dashboard/_components/category-donut.tsx`, `web/features/dashboard/_components/dashboard-skeletons.tsx`, `web/features/dashboard/_components/monthly-chart.tsx`, `web/e2e/stub-api/server.mjs` |
| 6 | tester (verificação, ciclo 1) | Suíte e cobertura | — (Vitest 1886/1886; tsc e lint limpos; Playwright não abriu o Chromium) |
| 7 | code-reviewer (ciclo 1) | Revisão | — (🔴 `ChartSkeleton` sem altura em produção: constante importada de módulo `"use client"` virava client reference; 🟡 total de 16 caracteres passava do furo; 🟡 cabeçalho dos skeletons diferente do `figcaption`; 🟢 `h-full` residual, `@container` literal, gap do `li`) |
| 8 | frontend-dev (ciclo 2) | Correções da revisão | `donut-layout.ts` → `web/features/dashboard/_components/chart-layout.ts` (sem `"use client"`); alterados: `dashboard-skeletons.tsx`, `category-donut.tsx`, `monthly-chart.tsx`, `category-donut-layout.spec.tsx`, `web/features/dashboard/dashboard-screen.tsx`, `web/e2e/dashboard-layout.pw.ts` |
| 9 | tester (verificação, ciclo 2) | Suíte e cobertura | — (Vitest 1890/1890; cobertura global 91,08% stmts / 86,84% branches) |
| 10 | code-reviewer (ciclo 2) | Re-revisão | — (**APROVADO**, sem 🔴; 🟡A placeholder do cabeçalho 4px mais alto que o real) |
| — | orquestrador | Correção do 🟡A | `web/features/dashboard/_components/dashboard-skeletons.tsx` (título + subtítulo sem gap = 48px; alternador `h-[46px]`), `web/features/dashboard/_components/category-donut-layout.spec.tsx` |
| 11 | doc-writer | Documentação | `docs/adr/0012-dashboard-donut-abaixo-do-grafico.md` (Aceito; §13 divergências; §14 diagrama), `docs/design/dashboard-donut-abaixo-do-grafico.md`, `docs/specs/dashboard-donut-abaixo-do-grafico.md` (Implementada), `docs/design/design-system.md` (container queries), `CHANGELOG.md` |
| — | orquestrador | Execução do e2e (via `npm run test:e2e:local`, que fornece as libs do Chromium sem root) e ajuste de 2 defeitos do próprio teste | `web/e2e/dashboard-layout.pw.ts`: (1) CA15 — localizador casava também a descrição sr-only (strict mode); (2) CA08 — a checagem de rolagem da página inteira foi restrita aos cards de gráfico, porque o transbordo vinha do resumo do mês (fora do escopo, ver Pendências), e a rolagem horizontal intencional da evolução mensal deixou de contar como transbordo |

## Verificação final

- `npx vitest run`: 113 arquivos, 1890/1890. `npx tsc --noEmit` e lint: limpos.
- Cobertura: `chart-layout.ts`, `dashboard-layout.tsx`, `dashboard-loading.tsx`, `dashboard-skeletons.tsx` 100%; `category-donut.tsx` 96,29% linhas; `dashboard-screen.tsx` 100% linhas / 70% branches; `monthly-chart.tsx` 72,16% linhas (lacuna anterior à feature).
- `next build`: o chunk SSR do `ChartSkeleton` traz `h-[260px] md:h-[280px] lg:h-[320px]` (sem client reference).
- `npm run test:e2e:local -- e2e/dashboard-layout.pw.ts`: 68/68.
- Suíte e2e completa: ver resultado abaixo.

## Pendências

- **Resumo do mês transborda com valores muito grandes (pré-existente, fora do escopo):** em 320/768/1024px, `MonthSummary` (`dd.display-num` > `span.money`) passa da viewport com totais como "R$ 45.000.000.000,00" (e, em 320px, já com "R$ 9.999.999.999,99", o limite de Decimal(12,2)), gerando rolagem horizontal da página. Merece um bugfix próprio.
- 🟢 do code-reviewer (não bloqueantes): o teste de "fronteiras" da escala do total em `category-donut-layout.spec.tsx` replica a regra (extrair `totalFontClass(len)` para `chart-layout.ts` e testar a função real); `data-testid` do cabeçalho do skeleton em código de produção.
