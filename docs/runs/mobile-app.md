# App mobile iOS (React Native / Expo)

Feature: versão mobile para iPhone, publicada pela App Store, com login, dashboard,
visualização de finanças, criação de despesas (inclusive parceladas) e de receitas.

Documentos: `docs/specs/mobile-app.md` (rev. 3), `docs/adr/0011-app-mobile-ios.md` (rev. 3, Aceito)
e `docs/design/mobile-app.md` (rev. 3).

## Decisões do usuário (aprovação, etapa 4)

| # | Decisão |
|---|---|
| B1 | API exposta por HTTPS atrás do nginx; `TRUST_PROXY` confia só nele; o web chama a API por um listener interno |
| B2 | Sessão mobile com o mesmo prazo do web (24 h), sem refresh token |
| B3 | Finanças com pagar, pagar em lote, pagar fatura, editar e excluir (não é só leitura) |
| B4 | Troca de senha opcional em Ajustes; troca obrigatória pendente → logout + "Abrir o site" |
| B5 | Conta demo real `demo@showcase.invalid` / senha `demo`, sem dados, sem gestão de usuários; distribuição TestFlight → App Store |
| B6 | Qualquer usuário edita e exclui os próprios lançamentos (`MANAGE_EXPENSES`), no app e no web |
| B7/B9 | Lançamentos e cartões da conta demo apagados diariamente às 03:00 America/Sao_Paulo |
| B8 | Conta demo não troca a própria senha (403; no app, item visível e desabilitado) |
| DM1–DM16 | Divergências do design aceitas (terminologia do web, `decimal-pad`, fatura na pilha de Finanças etc.) |
| — | CLAUDE.md: exceção de gráficos para o mobile (react-native-gifted-charts) |
| — | `SUPPORT_EMAIL` via variável de ambiente (sem e-mail fixo no código) |

## Subagentes acionados, em ordem

1. **`planner`** (rev. 1) → criou `docs/specs/mobile-app.md`.
2. **`architect`** (rev. 1) → criou `docs/adr/0011-app-mobile-ios.md`.
3. **`ui-designer`** (rev. 1) → criou `docs/design/mobile-app.md`.
4. *Aprovação do usuário (B1–B5, DM1–DM10).*
5. **`planner`**, **`architect`** e **`ui-designer`** em paralelo (rev. 2) → alteraram os três documentos acima.
6. *Novas decisões do usuário (B5 login, B6, B7, B8).*
7. **`planner`**, **`architect`** e **`ui-designer`** em paralelo (rev. 3) → alteraram os três documentos acima.
   O `architect` recebeu complementos (B9, P-ADR1, P-ADR5, endpoints de lote e Desfazer).
8. Edição direta (sessão principal, com autorização do usuário) → `CLAUDE.md`.
9. **`tester`** (modo RED; interrompido por limite de uso e retomado) → testes que falham em api, web e mobile,
   além da configuração mínima de `mobile/` (`package.json`, `vitest.config.ts`, `jest.config.js`, `babel.config.js`, `tsconfig.json`).
10. **`backend-dev`** → implementação [api]/[db] (domain, application, infrastructure, presentation, migrations, seed, scheduler).
11. **`frontend-dev`** (web), em paralelo → capabilities, páginas `/privacy` e `/support`, teste de deploy; depois, `SUPPORT_EMAIL`.
12. **`frontend-dev`** (mobile), em paralelo → app Expo completo em `mobile/`.
13. **`tester`** (verificação) → corrigiu testes desatualizados (api e mobile) e o fluxo Maestro da conta demo.
14. **`code-reviewer`** (revisão 1) → 1 bloqueante, 8 importantes, 9 sugestões: **MUDANÇAS NECESSÁRIAS**.
15. Ciclo 1 de correções, em paralelo:
    - **`backend-dev`**: I2, I3, I4/D5, I5, S3, S4, S6;
    - **`frontend-dev`** (web): B1 (código compartilhado), S5, `web.yml`, S1, S9;
    - **`frontend-dev`** (mobile): I1, I8, `mobile.yml`, S2, S7, S9 (deps), `test:coverage`.
16. **`tester`** (verificação) → cobertura do mobile de 76% para 94%, limiar de 80% no Vitest e testes compartilhados escritos no web e sincronizados.
    Edição direta: o `mobile.yml` passou a rodar `test:coverage`.
17. **`code-reviewer`** (revisão 2) → 0 bloqueantes, 4 importantes, 6 sugestões: **APROVADO**.
18. Correções pós-aprovação, em paralelo:
    - **`backend-dev`**: I-A (`TRUST_PROXY` recusa IPv4-mapped), S-3;
    - **`frontend-dev`** (mobile/CI): I-B (parser do login e `initialMonth`), S-4 (erros no boot), I-C (permissões, environment `production`, tag em `main`, bloqueio de placeholders), S-2.
19. **`doc-writer`**, em paralelo com o item 18 → README, `mobile/README.md`, docs de API, spec de autenticação, ADR (Aceito, seção 12.3) e CHANGELOG.

## Arquivos gerados ou alterados

### Documentação e configuração (planner, architect, ui-designer, doc-writer, sessão principal)

- `docs/specs/mobile-app.md` (novo; planner)
- `docs/adr/0011-app-mobile-ios.md` (novo; architect; doc-writer)
- `docs/design/mobile-app.md` (novo; ui-designer)
- `docs/api/identity.md` (novo; doc-writer)
- `docs/api/finance.md` (doc-writer)
- `docs/specs/autenticacao-autorizacao.md` (doc-writer)
- `README.md`, `CHANGELOG.md`, `mobile/README.md` (doc-writer)
- `CLAUDE.md` (sessão principal)
- `docs/runs/mobile-app.md` (este arquivo; sessão principal)

### CI

- `.github/workflows/web.yml` (novo; frontend-dev web, endurecido pelo frontend-dev mobile)
- `.github/workflows/mobile.yml` (novo; frontend-dev mobile; uma linha alterada pela sessão principal)

### API (backend-dev; testes: tester)

- Banco: `api/prisma/schema.prisma`, `api/prisma/migrations/20261103000001_user_kind_showcase/`, `api/prisma/migrations/20261103000002_users_showcase_check/`
- Bootstrap: `api/.env.example`, `api/src/main.ts`, `api/src/app.module.ts`, `api/src/bootstrap/{env,maintenance-task,maintenance.scheduler}.ts`, `api/src/bootstrap/seed/run-seed.ts`
- Shared: `api/src/shared/shared.module.ts`, `api/src/shared/domain/{app-error,well-known-ids}.ts`, `api/src/shared/domain/time/local-time-of-day.ts`, `api/src/shared/application/ports/daily-time-calculator.ts`, `api/src/shared/infrastructure/sao-paulo-daily-time-calculator.ts`, `api/src/shared/presentation/auth/{access-metadata,principal}.ts`, `api/src/shared/presentation/filters/http-error.filter.ts`
- Identity, domain: `api/src/modules/identity/domain/client/{client-kind,app-version,client-descriptor,app-update-required.error,minimum-app-version.policy}.ts`, `api/src/modules/identity/domain/user/{user,account-capabilities,showcase-account,authentication-eligibility,parse-new-user,parse-user-details,parse-support}.ts`, `api/src/modules/identity/domain/user/errors/user-errors.ts`, `api/src/modules/identity/domain/user/events/user-events.ts`, `api/src/modules/identity/domain/user/value-objects/{plain-password,user-status}.ts`, `api/src/modules/identity/domain/session/events/session-events.ts`
- Identity, application: `api/src/modules/identity/application/{views.ts,mappers/user-view.mapper.ts}`, `api/src/modules/identity/application/ports/{client-compatibility-config,identity-audit-log,session-principal-lookup}.ts`, `api/src/modules/identity/application/use-cases/auth/{login-with-password,authenticate-session,check-client-compatibility}.ts`, `api/src/modules/identity/application/use-cases/account/{change-own-password,update-own-profile}.ts`, `api/src/modules/identity/application/use-cases/bootstrap/ensure-showcase-account.ts`
- Identity, infrastructure e presentation: `api/src/modules/identity/identity.module.ts`, `api/src/modules/identity/infrastructure/{client-compatibility-config,identity-infrastructure.providers,logger-identity-audit-log}.ts`, `api/src/modules/identity/presentation/guards/{access-control.guard,access-policy,capability.policy,client-context.policy}.ts`, `api/src/modules/identity/presentation/http/{auth,account,admin-users}.controller.ts`, `api/src/modules/identity/presentation/http/current-client.decorator.ts`, `api/src/modules/identity/presentation/http/presenters/user.presenter.ts`
- Removido: `api/src/modules/identity/presentation/guards/role.policy.ts`
- Finance: `api/src/modules/finance/finance.module.ts`, `api/src/modules/finance/application/ports/showcase-data-purger.ts`, `api/src/modules/finance/application/use-cases/maintenance/purge-showcase-data.ts`, `api/src/modules/finance/infrastructure/finance-infrastructure.providers.ts`, `api/src/modules/finance/infrastructure/maintenance/prisma-showcase-data-purger.ts`, `api/src/modules/finance/presentation/http/entries.controller.ts`
- Testes novos (tester): os `*.spec.ts` e `*.int-spec.ts` ao lado dos arquivos acima, `api/test/architecture-showcase.spec.ts`, `api/test/e2e/{mobile-client,showcase-account,entries-manage-authz,trust-proxy}.e2e-spec.ts`, `api/test/support/{showcase-builders,showcase-harness,showcase-e2e}.ts`, `api/test/fakes/maintenance-fakes.ts`
- Testes alterados (tester e backend-dev): `api/test/e2e/{access-control,admin-users,identity-auth,initial-month,payments}.e2e-spec.ts`, `api/test/fakes/owned-finance-fakes.ts`, `api/test/support/{e2e-app,identity-e2e,identity-harness}.ts`, `login-with-password.spec.ts`, `session-use-cases.spec.ts`, `create-user.spec.ts`, `update-user.spec.ts`, `user-admin-common.spec.ts`, `parsers.spec.ts`

### Web (frontend-dev web; testes: tester)

- Produção: `web/lib/api/types.ts`, `web/app/(protected)/entries/page.tsx`, `web/components/account-menu.tsx`, `web/app/(public)/privacy/page.tsx` (novo), `web/app/(public)/support/page.tsx` (novo), `web/lib/entries/{form,feedback,payment-feedback}.ts` (`payment-feedback` é novo), `web/features/entries/_components/edit-expense-drawer.tsx`, `web/next.config.ts`, `web/.env.example`, `web/vitest.config.mts`
- Testes: `web/app/(protected)/entries/page.spec.tsx`, `web/app/(public)/privacy/page.spec.tsx`, `web/app/(public)/support/{page,page-email}.spec.tsx`, `web/components/{account-menu,account-menu-capabilities,app-header,demo-banner}.spec.tsx`, `web/features/account/profile-form.spec.tsx`, `web/lib/auth/{route-policy,route-policy-public-pages}.spec.ts`, `web/lib/entries/{form,feedback,payment-feedback}.spec.ts`, `web/lib/dates/format.spec.ts`, `web/lib/money/decimal.spec.ts`, `web/test/deploy-api-not-exposed.spec.ts`

### Mobile (`mobile/`, pasta nova com 125 arquivos; frontend-dev mobile; testes: tester)

- Configuração: `package.json`, `package-lock.json`, `app.config.ts`, `eas.json`, `index.ts`, `tsconfig.json`, `tsconfig.rules.json`, `vitest.config.ts`, `jest.config.js`, `babel.config.js`, `eslint.config.js`, `.env.example`, `.gitignore`, `.prettierrc.json`, `.prettierignore`
- Scripts: `scripts/{check-shared-rules,sync-shared,shared-files}.mjs`
- Telas (`app/`):
  - `_layout`, `index`, `boot-offline`, `update-required`, `diagnostics`, `month-picker`, `filters`;
  - `(auth)/login` e `(auth)/password-change-required`;
  - `(tabs)/dashboard`, `(tabs)/finances`, `(tabs)/finances/invoice/[cardId]/[referenceMonth]`, `(tabs)/settings`, `(tabs)/settings/change-password`;
  - `new/{expense,installments,income}` e `edit/[id]`.
- Código:
  - `src/lib/` (cópias sincronizadas do web);
  - `src/core/` (sessão, erros, query keys, ações, Desfazer, mensagens);
  - `src/data/` (cliente HTTP, parsers estritos, hooks, query client);
  - `src/platform/` (Keychain, reinstalação, navegador externo, privacidade);
  - `src/features/` e `src/ui/`.
- Testes:
  - `src/**/*.spec.ts` (Vitest);
  - `__tests__/screens/{auth,create,actions,empty-states}.test.tsx`;
  - `__tests__/data/{http-client,platform,parsers,build-config}.test.ts`;
  - `__tests__/support/*`;
  - `e2e/maestro/*.yaml` (descritos, não executados).

## Resultado final

| Suíte | Resultado |
|---|---|
| api unit | 1153/1153 (rodada final) |
| api int | 253/253 (verificação do ciclo 1) |
| api e2e | 392/392 (verificação do ciclo 1) |
| api cobertura | 95,9% statements; domain/application ≥ 87,5% por diretório |
| web | 1807/1807; tsc e lint limpos |
| mobile Vitest | 263/263; cobertura 94,3% statements (limiar de 80%) |
| mobile Jest | 91/91 |
| mobile lint, typecheck e `check:shared` | OK (12 arquivos idênticos) |

Os testes de int e e2e da API não foram rodados de novo depois da última correção (I-A), que só alterou `env.ts`, coberto pelos testes unitários.

## Pendências (registradas no ADR 0011, seção 12.3)

- Fluxos Maestro não executados: falta simulador iOS e o stub do web não tem `X-Client`, 426 nem a conta showcase.
- Validação manual: gráficos, VoiceOver, Dynamic Type, Keychain real, `/diagnostics` com outro fuso.
- Antes da primeira tag `mobile-v*`:
  - ícone e splash;
  - `projectId` do EAS, `ascAppId`, `appleTeamId` e URLs reais em `app.config.ts`/`eas.json` (o CI barra placeholders);
  - environment `production` no GitHub, com `EXPO_TOKEN` e revisores obrigatórios;
  - conta Apple Developer.
- Deploy:
  - `TRUST_PROXY` obrigatório em produção (inclusive para o seed);
  - `SUPPORT_EMAIL` obrigatório no web;
  - `SHOWCASE_ACCOUNT_PASSWORD=demo`;
  - nginx conforme N1–N10 (bloquear `/api/admin/*` e `/api/demo/*` no acesso público).
- `eas-cli` fixado em 27.2.0; confirmar se é a versão recomendada para o Expo SDK 58.
