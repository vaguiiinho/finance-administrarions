# Edição administrativa de despesas

## Subagentes

- `planner`: tentativa de acionamento sem sucesso; o modelo configurado não estava disponível.
- `code-reviewer`: tentativa de acionamento sem sucesso pelo mesmo motivo. A revisão foi feita diretamente e os fluxos críticos foram cobertos pelos testes.
- `architect`, `ui-designer`, `tester`, `backend-dev`, `frontend-dev` e `doc-writer`: não foram acionados; implementação, revisão e documentação foram concluídas nesta sessão principal.

## Arquivos alterados

### API

- `api/src/modules/finance/domain/entry/entry.repository.ts`
- `api/src/modules/finance/domain/entry/entry.spec.ts`
- `api/src/modules/finance/domain/entry/entry.ts`
- `api/src/modules/finance/domain/entry/errors/entry-errors.ts`
- `api/src/modules/finance/domain/entry/events/entry-events.ts`
- `api/src/modules/finance/application/use-cases/entries/update-expense.ts`
- `api/src/modules/finance/application/use-cases/entries/update-expense.spec.ts`
- `api/src/modules/finance/finance.module.ts`
- `api/src/modules/finance/infrastructure/repositories/prisma-entry.repository.ts`
- `api/src/modules/finance/presentation/http/entries.controller.ts`
- `api/src/modules/finance/presentation/http/schemas/entry.schemas.ts`
- `api/test/e2e/access-control.e2e-spec.ts`
- `api/test/e2e/owner-isolation.e2e-spec.ts`
- `api/test/e2e/payments.e2e-spec.ts`
- `api/test/fakes/in-memory-repositories.ts`
- `api/test/support/finance-harness.ts`

### Web

- `web/app/(protected)/entries/actions.ts`
- `web/app/(protected)/entries/page.tsx`
- `web/features/entries/_components/edit-expense-drawer.tsx`
- `web/features/entries/_components/expenses-list.spec.tsx`
- `web/features/entries/_components/expenses-list.tsx`
- `web/features/entries/_components/expenses-panel.tsx`
- `web/features/entries/entries-screen.tsx`
- `web/lib/api/endpoints.ts`
- `web/lib/api/types.ts`

### Documentação

- `docs/adr/0001-lancamentos-financeiros.md`
- `docs/api/finance.md`
- `docs/design/lancamentos-financeiros.md`
- `docs/specs/autenticacao-autorizacao.md`
- `docs/specs/categorias-inativacao.md`
- `docs/specs/lancamentos-financeiros.md`
- `docs/specs/listagem-mes-e-status-padrao.md`

## Verificação

- Testes e2e de isolamento, pagamentos/edição e controle de acesso: 60 testes passaram.
- Testes unitários da API, lint/typecheck da API, testes da lista de despesas, typecheck e lint focados da web foram executados durante a implementação.
