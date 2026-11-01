# Exclusão administrativa de despesas

## Subagentes

1. `planner`: tentativa sem sucesso; o modelo configurado `opus` não estava disponível.
2. `architect`, `ui-designer`, `tester`, `backend-dev`, `frontend-dev` e `doc-writer`: não foram acionados; a implementação e a documentação foram concluídas diretamente nesta sessão.
3. `code-reviewer`: tentativa sem sucesso pelo mesmo motivo de disponibilidade do modelo. Revisão final e verificações executadas diretamente.

## Decisões

- Exclusão definitiva de despesas pendentes e pagas, somente por ADMIN; não há recuperação.
- O escopo continua sendo o proprietário autenticado. Receitas não podem ser excluídas.
- `DELETE /api/entries/:id` responde `204`; id de outro dono ou inexistente retorna `404`.
- A interface pede confirmação irreversível e revalida os valores agregados.

## Arquivos alterados

### API

- `api/src/modules/finance/application/use-cases/entries/delete-expense.ts`
- `api/src/modules/finance/application/use-cases/entries/delete-expense.spec.ts`
- `api/src/modules/finance/domain/entry/entry.ts`
- `api/src/modules/finance/domain/entry/entry.spec.ts`
- `api/src/modules/finance/domain/entry/entry.repository.ts`
- `api/src/modules/finance/domain/entry/errors/entry-errors.ts`
- `api/src/modules/finance/domain/entry/events/entry-events.ts`
- `api/src/modules/finance/finance.module.ts`
- `api/src/modules/finance/infrastructure/repositories/prisma-entry.repository.ts`
- `api/src/modules/finance/presentation/http/entries.controller.ts`
- `api/test/e2e/access-control.e2e-spec.ts`
- `api/test/e2e/initial-month.e2e-spec.ts`
- `api/test/e2e/owner-isolation.e2e-spec.ts`
- `api/test/e2e/payments.e2e-spec.ts`
- `api/test/fakes/in-memory-repositories.ts`
- `api/test/fakes/owned-finance-fakes.ts`
- `api/test/support/finance-harness.ts`

### Web

- `web/app/(protected)/entries/actions.ts`
- `web/app/(protected)/entries/page.tsx`
- `web/features/entries/_components/expenses-list.tsx`
- `web/features/entries/_components/expenses-list.spec.tsx`
- `web/features/entries/_components/expenses-panel.tsx`
- `web/features/entries/entries-screen.tsx`
- `web/lib/api/endpoints.ts`
- `web/lib/api/http.ts`

### Documentação

- `docs/adr/0001-lancamentos-financeiros.md`
- `docs/api/finance.md`
- `docs/design/lancamentos-financeiros.md`
- `docs/specs/autenticacao-autorizacao.md`
- `docs/specs/categorias-inativacao.md`
- `docs/specs/lancamentos-financeiros.md`
- `docs/specs/listagem-mes-e-status-padrao.md`
- `docs/runs/expense-deletion.md`

## Verificação

- Unitários focados de domínio e caso de uso: 54 testes passaram.
- E2E de pagamentos/exclusão, isolamento e controle de acesso: 63 testes passaram; regressão de rotas do mês inicial: 26 testes passaram.
- UI da lista de despesas: 29 testes passaram.
- Typecheck da API e web passaram.
- Lint da API e ESLint dos arquivos web focados passaram; o lint da API reportou 10 warnings existentes.
