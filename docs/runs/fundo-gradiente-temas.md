# Registro de execução — Fundo em gradiente nos temas

Feature: fundo da página em gradiente "futurista" nos temas claro e escuro, com página temporária de sugestões (Fase A) e aplicação do preset escolhido (Fase B).
Branch: `feat/ui`. Escopo: só `web/` (sem api/db).
Escolha do usuário: **dark-5** (Grafite com brilho ciano) e **light-2** (Lavanda → azul-gelo).

## Subagentes acionados, em ordem

| # | Subagente | Etapa | Arquivos gerados / alterados |
|---|---|---|---|
| 1 | planner | Spec | `docs/specs/fundo-gradiente-temas.md` (Impacto em UI: sim) |
| 2 | architect | ADR | `docs/adr/0003-fundo-gradiente-temas.md` |
| 3 | ui-designer | Design (10 presets + página de pré-visualização) | `docs/design/fundo-gradiente-temas.md` |
| — | — | **Aprovação do usuário** (respostas padrão B1–B5) | — |
| 4 | tester (RED, Fase A) | Testes da pré-visualização | criados: `web/app/(app)/background-preview/page.spec.tsx`, `_preview/{presets,enabled,gradient-samples,evaluate,model,isolation}.spec.ts`, `web/e2e/background-preview.pw.ts`; alterados: `web/test/no-literal-colors.spec.ts`, `web/e2e/contrast.spec.ts`, `web/playwright.config.ts` |
| 5 | frontend-dev (Fase A) | Página `/background-preview` | criados: `page.tsx`, `_preview/{model,presets,enabled,gradient-samples,evaluate,theme-scope}.ts`, `_preview/{preset-frame,sample-ui,contrast-badge}.tsx`; alterados: `web/e2e/contrast.ts`, `web/e2e/support.ts`. Orquestrador corrigiu fixture errada em `_preview/evaluate.spec.ts` (#959595 → #949494) |
| — | — | **Escolha do usuário**: dark-5 + light-2 | — |
| 6 | tester (RED, Fase B) | Testes de tokens, fundo e remoção | criados: `web/lib/theme/{gradient,page-background}.spec.ts`, `web/test/background-preview-removed.spec.ts`, `web/e2e/page-background.pw.ts`; alterados: `web/lib/theme/tokens.spec.ts`, `web/test/no-literal-colors.spec.ts`, `web/e2e/{contrast,support,a11y.pw,dark-theme.pw}.ts` |
| 7 | frontend-dev (Fase B, T9–T11) | Tokens, CSS, componentes, remoção da Fase A | criado: `web/lib/theme/gradient.ts`; alterados: `web/app/styles/tokens.css`, `web/app/globals.css`, `web/app/(app)/entries/_components/entries-tabs-bar.tsx`, `web/components/app-header.tsx`, `web/lib/theme/contrast-pairs.ts`; removidos: `web/app/(app)/background-preview/` inteira, `web/e2e/background-preview.pw.ts`, linha `BACKGROUND_PREVIEW` em `web/playwright.config.ts` |
| 8 | tester (verificação) | Correção de testes/helpers com defeito | `web/test/background-preview-removed.spec.ts`, `web/e2e/{page-background.pw,theme.pw,dark-theme.pw,contrast}.ts` (relatório final veio vazio; suíte verificada pelo orquestrador: vitest 728/728, Playwright 215/215) |
| 9 | code-reviewer (ciclo 1) | Revisão | — (1 🔴 CA22 ids residuais; 🟡 veredito na região de gradiente, scroll, resíduos, ADR, DRY) |
| 10 | frontend-dev (ciclo 2) | Correções da revisão | `web/e2e/{contrast,contrast.spec,support,page-background.pw,dark-theme.pw,a11y.pw,theme.pw}.ts`, `web/lib/theme/{gradient,gradient.spec,tokens.spec}.ts`, `web/test/background-preview-removed.spec.ts` |
| 11 | code-reviewer (ciclo 2) | Re-revisão | — (sem 🔴; 🟡 comentário falso sobre não sobreposição dos brilhos) |
| 12 | frontend-dev (ciclo 3) | Composição dupla dos brilhos, falha fechada, ordenação | `web/lib/theme/{gradient,gradient.spec,tokens.spec}.ts`, `web/e2e/{contrast,contrast.spec,support,dark-theme.pw,page-background.pw}.ts` |
| 13 | doc-writer | Documentação | `docs/adr/0003-fundo-gradiente-temas.md` (Aceito, adendo §5.8, §13), `docs/design/design-system.md` (rev. 6), `docs/design/fundo-gradiente-temas.md`, `docs/specs/fundo-gradiente-temas.md`, `CHANGELOG.md`, `README.md`. Orquestrador removeu arquivo acidental `docs/adr/0003-fundo-gradiente-temas.md.tail` e atualizou §13.4 do ADR após o ciclo 3 |

## Verificação final

- `npx vitest run`: 38 arquivos, 738/738 testes.
- Cobertura `lib/theme`: 96,7% statements, 100% linhas (medida no ciclo 2).
- `npx tsc --noEmit` e `npx eslint .`: limpos.
- Playwright completo: 215/215 (ciclo 3, reportado pelo frontend-dev; ciclo 1 confirmado pelo orquestrador).
- `rg` de resíduos (`background-preview`, ids de preset) em `web/`: só a guarda de `background-preview-removed.spec.ts`.
