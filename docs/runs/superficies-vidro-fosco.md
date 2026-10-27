# Registro de execução — Superfícies em vidro fosco e resumo do mês sem card externo

Feature: navbar, cards, campos e demais superfícies sobre a página em vidro fosco (translúcido + `backdrop-filter`), com fallback opaco; resumo do mês sem o card externo.
Branch: `feat/ui-vidro`. Escopo: só `web/` (sem api/db — backend-dev não acionado).
Aprovação do usuário (2026-10-27): spec, ADR e design aprovados; **B1 = opção (a)** (vidro de barra 0,91 claro / 0,90 escuro, nenhuma cor de texto muda); B2–B5 nas respostas padrão.

## Subagentes acionados, em ordem

| # | Subagente | Etapa | Arquivos gerados / alterados |
|---|---|---|---|
| 1 | planner | Spec (sessão anterior) | `docs/specs/superficies-vidro-fosco.md` (Impacto em UI: sim) |
| 2 | architect | ADR (sessão anterior) | `docs/adr/0004-superficies-vidro-fosco.md` |
| 3 | ui-designer | Design (sessão anterior) | `docs/design/superficies-vidro-fosco.md` |
| — | — | **Aprovação do usuário** (B1 = a; B2–B5 padrão) | — |
| 4 | tester (RED) | Testes que falham + status "Aprovado" nos docs | criados: `web/lib/theme/glass.spec.ts`, `web/lib/theme/glass-css.spec.ts`, `web/e2e/glass.pw.ts`, `web/e2e/month-summary.pw.ts`, `web/e2e/glass-support.ts` (removido no ciclo 2); alterados: `web/lib/theme/tokens.spec.ts`, `web/lib/theme/contrast-pairs.ts`, `web/components/month-summary.spec.tsx`, `web/app/(app)/dashboard/_components/dashboard-blocks.spec.tsx`, `web/e2e/support.ts`, `web/e2e/dark-theme.pw.ts`, `web/e2e/page-background.pw.ts`, `web/e2e/theme-charts.pw.ts`, spec/ADR/design (status). Resultado: Vitest 183 falhas, Playwright 60 falhas, todas por asserção |
| 5 | frontend-dev | Implementação [web] | criados: `web/app/styles/glass.css`, `web/lib/theme/glass.ts`; alterados: `web/app/styles/tokens.css`, `web/app/globals.css`, `web/components/month-summary.tsx`, `web/components/app-header.tsx`, `web/components/month-picker.tsx` (z-[35], CA12), `web/components/ui/states.tsx`, `web/app/(app)/entries/_components/{expenses-list,income-panel,invoice-block,tab-subtotal}.tsx`, `web/app/(app)/dashboard/_components/{monthly-chart,category-donut}.tsx`, `web/e2e/contrast.ts`; testes ajustados: `web/app/(app)/entries/_components/recent-highlight.spec.tsx`, `web/e2e/glass.pw.ts` (subtotal com `--card-bg-2`) |
| 6 | tester (verificação, ciclo 1) | Suíte e cobertura | — (Vitest 951/951; 1 timeout sob coverage em `tokens.spec.ts:471`; Playwright 290/290) |
| 7 | code-reviewer (ciclo 1) | Revisão | — (🔴 anel de foco duplo no checkbox; 🔴 `test:cov` vermelho por timeout; 🟡 auditoria duplicada, CLS do skeleton, spread em `glass.ts`, adendo do ADR) |
| 8 | frontend-dev (ciclo 2) | Correções da revisão | alterados: `web/app/globals.css`, `web/components/month-summary.tsx`, `web/components/month-picker.tsx`, `web/components/ui/toast.tsx`, `web/lib/theme/{glass,glass.spec,glass-css.spec,tokens.spec}.ts`, `web/e2e/{support,contrast,glass.pw,month-summary.pw,theme-charts.pw,a11y.pw}.ts`, `web/e2e/stub-api/server.mjs`; removido: `web/e2e/glass-support.ts` |
| 9 | tester (verificação, ciclo 2) | Suíte e cobertura | — (test:cov 955/955; e2e 300/300; mudança do CA02 julgada legítima) |
| 10 | code-reviewer (ciclo 2) | Re-revisão | — (**APROVADO**, sem 🔴/🟡; 🟢 sugestões abaixo) |
| 11 | doc-writer | Documentação | `docs/adr/0004-superficies-vidro-fosco.md` (Aceito, adendo A1–A7), `docs/design/superficies-vidro-fosco.md` (rev. 2), `docs/design/design-system.md` (rev. 7), `docs/specs/superficies-vidro-fosco.md` (Implementada), `docs/adr/0003-fundo-gradiente-temas.md` e `docs/specs/fundo-gradiente-temas.md` (nota de revogação do B1), `CHANGELOG.md`, `web/README.md` |

## Verificação final (ciclo 2)

- `npm run test:cov`: 40 arquivos, 955/955. Cobertura global 92,94% statements / 88,15% branches; `lib/theme` 100% statements / 98,33% branches / 100% linhas.
- `npm run lint` e `npx tsc --noEmit`: limpos.
- `npm run test:e2e:local` (Playwright completo, build de produção com stub): 300/300 em 12 min. Observação: `npx playwright test` direto não abre o Chromium neste ambiente (falta `libnspr4.so`); usar o wrapper.

## Pendências

- **CA14 / T10 (desempenho)**: medição manual não executada — Lighthouse mobile em `/entries?month=2026-11` (3 execuções, mediana, queda ≤ 5, ΔCLS ≤ 0,01 contra a rev. 6) e trace do Chrome rolando o cenário `many` com CPU 4x. Registrar o resultado nesta seção.
- 🟢 do code-reviewer (não bloqueantes): critério `rowsUnder` do CA02 frouxo (`web/e2e/glass.pw.ts:505-509`, usar `b.top < head.bottom && b.bottom > head.top`); comentário sobre a premissa de convexidade em `web/e2e/support.ts:168-186`; ui-designer confirmar o card do Saldo mais alto no mobile (~116 px).
- `web/AGENTS.md` (gerado pelo `next dev`) não pertence à feature: commit separado ou fora do PR.
