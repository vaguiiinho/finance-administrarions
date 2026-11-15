# Remoção da demo pública, login com dica e rotina da conta demo

Feature: remover as rotas `/demo` (API e web) e os dados do usuário demo público. Sem sessão, o usuário vai para
`/login`, que mostra a dica "use o usuário demo / senha demo". Criar a rotina de exclusão (redefinição) dos dados da conta demo.

Documentos: `docs/specs/remover-demo-publica-login.md` (rev. 3), `docs/adr/0013-remocao-demo-publica-login-rotina-conta-demo.md`
(Aceito) e `docs/design/remover-demo-publica-login.md` (Aprovado).

Pergunta do usuário: "os dados do demo são do banco ou gerados no repositório?" Resposta: os dois. O conteúdo é gerado
por código puro e determinístico (antes `demo-dataset.ts`, agora `sample-dataset.ts`) e o seed/rotina o grava no Postgres.

## Decisões do usuário

| # | Decisão |
|---|---|
| B1 | Alias `demo` aceito pela API no login (equivale a `demo@showcase.invalid`); vale também no app |
| B2 | A conta demo tem os dados de exemplo como estado inicial, restaurados a cada execução da rotina |
| B3 | A conta demo continua com escrita (`MANAGE_EXPENSES`) |
| B4 | A dica só aparece quando a conta demo está habilitada (`DEMO_ACCOUNT_HINT`) |
| B5 | Rotina diária às 03:00 America/Sao_Paulo, sem revogar sessões, mais execução manual (`npm run demo:reset`) |
| PA1–PA5 | Pontos do design aprovados como propostos (rótulo condicional "E-mail ou usuário" / "E-mail", sem botão "Preencher", "horário de Brasília") |

## Subagentes acionados, em ordem

1. **`planner`** (rev. 1, com o requisito adicional da rotina de exclusão) → criou `docs/specs/remover-demo-publica-login.md`.
2. **`architect`** → criou `docs/adr/0013-remocao-demo-publica-login-rotina-conta-demo.md`.
3. **`planner`** (rev. 2 e rev. 3, em paralelo com o architect) → alterou a spec: B1–B5 decididos, sem condicionais.
4. **`ui-designer`** → criou `docs/design/remover-demo-publica-login.md`.
5. *Aprovação do usuário (spec, ADR, design).*
6. **`tester`** (modo RED) → criou e alterou testes em api, web e mobile e removeu os testes da demo antiga (lista abaixo).
7. **`backend-dev`** e **`frontend-dev`** em paralelo (interrompidos pelo limite de uso e retomados) → implementação.
8. **`tester`** (modo verificação) → todas as suítes passaram; cobertura de domain/application em 96%.
9. **`code-reviewer`** → 0 🔴, 2 🟡, 13 🔵. Não houve ciclo de retorno obrigatório.
10. **`frontend-dev`** e **`backend-dev`** (ajustes da revisão), em paralelo com o **`doc-writer`** → 🟡1 e os 🔵 aplicáveis corrigidos.
11. **`doc-writer`** → documentação atualizada.

## Arquivos por subagente

### tester (RED)
- **Criados (api):**
  - `login-identifier.spec.ts`, `get-showcase-account-state.spec.ts`
  - `sample-dataset/sample-dataset.spec.ts`, `reset-owner-data.spec.ts`
  - `bootstrap/demo-account/demo-account-reset.routine.spec.ts`, `bootstrap/maintenance.scheduler.trigger.spec.ts`
  - `finance/infrastructure/maintenance/prisma-owner-data-reset-store.int-spec.ts`
  - `test/migration-remove-public-demo.int-spec.ts`, `test/seed.int-spec.ts`, `test/reset-demo-account-script.int-spec.ts`
  - `test/architecture-demo-removal.spec.ts`
  - `test/e2e/demo-routes-removed.e2e-spec.ts`, `test/e2e/demo-account-maintenance.e2e-spec.ts`
- **Criados (web):**
  - `lib/auth/demo-hint.spec.ts`, `app/(auth)/login/page.spec.tsx`, `app/page.spec.tsx`
  - `test/no-demo-references.spec.ts`, `e2e/demo-removed-login.pw.ts`
- **Alterados (api):**
  - `login-showcase.spec`, `showcase-account.spec`, `owner-isolation.int-spec`, `get-initial-entries-month.spec`
  - e2e: `showcase-account`, `access-control`, `mobile-client`, `initial-month`, `admin-users`, `identity-auth`
  - `test/fakes/maintenance-fakes.ts`, `test/support/owned-db.ts`
- **Alterados (web):**
  - `route-policy`, `proxy`, `(auth)/actions`, `login-form`, `privacy`, `deploy-api-not-exposed`
  - componentes de shell e navegação (`main-nav`, `nav-drawer`, `app-sidebar`, `app-footer`, `app-header`)
  - filtros, `finance-reader`, `redirect-to-initial-month`, `dashboard-screen`, `invoice-block`, `invoice-status-filter`, `(protected)/entries/page`
  - `e2e/stub-api/auth.spec.ts`, vários `.pw.ts`, `playwright.config.ts`
- **Alterados (mobile):** `src/core/messages.spec.ts`, `__tests__/screens/auth.test.tsx`, `e2e/maestro/demo-account-actions.yaml`.
- **Removidos (api):**
  - `test/e2e/demo.e2e-spec.ts`, `test/fakes/demo-fakes.ts`
  - `refresh-demo-dataset.spec.ts`, `purge-showcase-data.spec.ts`
  - `prisma-demo-dataset-store.int-spec.ts`, `prisma-showcase-data-purger.int-spec.ts`
- **Removidos (web):**
  - `demo-banner.spec`, `read-only.spec`, `sign-in-button.spec`, `sign-in-href.spec`
  - `demo-mode.spec`, `(public)/demo/actions.spec`, `entries-href-basepath.spec`
  - `e2e/demo-shell.pw.ts`

### backend-dev
- **Criados:**
  - `finance/application/ports/owner-data-reset-store.ts`
  - `finance/application/use-cases/maintenance/reset-owner-data.ts`
  - `finance/infrastructure/maintenance/prisma-owner-data-reset-store.ts`
  - `identity/domain/user/value-objects/login-identifier.ts`
  - `identity/application/use-cases/bootstrap/get-showcase-account-state.ts`
  - `bootstrap/demo-account/demo-account-reset.routine.ts`, `bootstrap/demo-account/describe-error.spec.ts`
  - `bootstrap/scripts/reset-demo-account.ts`
  - migrations `20261114000001_remove_public_demo_user` e `20261114000002_owner_data_resets`
- **Movido:** `finance/application/demo/demo-dataset.ts` → `finance/application/sample-dataset/sample-dataset.ts`.
- **Removidos:**
  - `demo.controller.ts`, `demo-dataset-store.ts`, `refresh-demo-dataset.ts`
  - `showcase-data-purger.ts`, `purge-showcase-data.ts`
  - `prisma-demo-dataset-store.ts`, `prisma-showcase-data-purger.ts`
  - `ensure-demo-user.ts`
- **Alterados (produção):**
  - `prisma/schema.prisma`
  - `finance.module.ts`, `finance-infrastructure.providers.ts`, `finance-read-handlers.ts`
  - `entry.repository.ts`, `prisma-entry.repository.ts`
  - `identity.module.ts`, `login-with-password.ts`
  - `user.ts`, `user-status.ts`, `session-principal-lookup.ts`, `user.mapper.ts`, `showcase-account.ts`
  - `well-known-ids.ts`, `access-metadata.ts`, `business-calendar.ts`, `user-admin-support.ts`
  - `app.module.ts`, `maintenance-task.ts`, `maintenance.scheduler.ts`, `run-seed.ts`
  - `package.json`, `vitest.config.ts`, `.env.example`
- **Alterados (testes):**
  - specs de identity (`user`, `bootstrap`, `account-capabilities`, `login-with-password`, `create-user`, `user-admin-common`, `queries`, `session-use-cases`, `session-showcase`)
  - `identity-repositories.int-spec`, `showcase-account.int-spec`
  - suportes `identity-builders`, `identity-harness`, `identity-e2e`, fakes `in-memory-repositories`, `owned-finance-fakes`
  - ajustes de revisão em `mobile-client.e2e-spec` (CA30), `showcase-account.e2e-spec` (CA15, CA17), `architecture-demo-removal.spec`

### frontend-dev
- **Criados:** `web/lib/auth/demo-hint.ts`, `web/app/(auth)/login/demo-account-hint.tsx`, `mobile/e2e/maestro/demo-account-canonical-login.yaml`.
- **Alterados (web):**
  - login, raiz e auth: `app/(auth)/login/page.tsx`, `login-form.tsx`, `app/(auth)/actions.ts` (+ spec), `app/page.tsx`, `lib/auth/route-policy.ts`, `lib/auth/field-messages.ts`
  - privacidade: `app/(public)/privacy/page.tsx`
  - shell e navegação: `app-shell`, `app-header`, `app-sidebar`, `main-nav`, `nav-drawer`, `app-footer`
  - páginas protegidas: `(protected)/layout.tsx`, páginas entries/dashboard/cards
  - leitor e filtros: `lib/api/finance-reader.ts`, `lib/filters/*`, `redirect-to-initial-month.ts`
  - componentes de `features/entries`, `features/dashboard`, `features/cards`
  - configuração e stub: `.env.example`, `e2e/stub-api/server.mjs`
  - ajustes de lint em `.pw.ts` e `finance-reader.spec.ts`
- **Removidos (web):**
  - `app/(public)/demo/*`
  - `components/app-mode.tsx`, `read-only.tsx`, `demo-banner.tsx`, `demo-banner-action.tsx`, `demo-chip.tsx`, `sign-in-button.tsx`
  - `lib/app-mode.ts`, `lib/auth/sign-in-href.ts`
- **Alterados (mobile):** `mobile/src/core/messages.ts`, `mobile/e2e/maestro/demo-account-actions.yaml`.
- **Testes do tester ajustados:** `web/test/no-demo-references.spec.ts` (regex), `web/lib/filters/entries-search-params.spec.ts` (cast).

### doc-writer
- ADRs: `docs/adr/0013-...md` (Aceito, §17 divergências), `docs/adr/0005-autenticacao-autorizacao-demo.md`, `docs/adr/0011-app-mobile-ios.md` (notas de substituição).
- Design: `docs/design/remover-demo-publica-login.md` (Aprovado), `docs/design/autenticacao-autorizacao.md` (notas).
- API: `docs/api/finance.md`, `docs/api/identity.md` (alias, conta demo, diagrama).
- READMEs e changelog: `README.md`, `api/README.md`, `web/README.md`, `mobile/README.md`, `CHANGELOG.md` (entrada acrescentada; as alterações já existentes preservadas).

## Estado final

| Suíte | Resultado |
|---|---|
| api unit | 1254 testes (81 arquivos) |
| api integração | 296 testes (16 arquivos) |
| api e2e | 449 testes (16 arquivos) |
| web vitest | 1913 testes (110 arquivos); lint e tsc limpos |
| mobile | check:all; vitest 264, jest 94 |
| Cobertura domain/application (api) | 96% statements / 93% branches |
| `prisma migrate diff` | sem diferenças |

**Não verificado neste ambiente:**
- **Playwright** (falta `libnspr4.so`; rode `npm run pw:deps`), incluindo axe e contraste do CA16 e a regressão visual (R9).
- **Fluxos Maestro** (sem simulador iOS).
- **CA30**, a regressão manual do app publicado.

**Itens 🔵 da revisão não aplicados:**
- `inputMode="email"` com a dica desligada (conflita com o DR1 do design).
- Isenção de rate limit para a conta SHOWCASE inativa (já existia, fora de escopo).
