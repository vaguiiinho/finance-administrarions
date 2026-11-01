# Implementação de despesas parceladas

## Subagentes

1. `planner`: tentativa sem sucesso; o modelo configurado `opus` não estava disponível.
2. `architect`: tentativa sem sucesso pelo mesmo motivo.
3. `ui-designer`: tentativa sem sucesso pelo mesmo motivo.
4. `tester`, `backend-dev`, `frontend-dev`, `code-reviewer` e `doc-writer`: não foram acionados como subagentes; testes, implementação, revisão direta e documentação foram concluídos nesta sessão.

## Decisões entregues

- Criada uma ação separada para despesas parceladas, mantendo o formulário atual inalterado.
- O total é repartido em centavos exatos para 2 a 36 despesas independentes, com datas mensais e ajuste de fim de mês.
- PIX e cartão começam pendentes; cartão de outro proprietário é rejeitado.
- Toda a série é persistida em uma transação e os eventos são publicados depois do commit.
- Nenhuma migração foi necessária; edição, pagamento e exclusão continuam independentes por parcela.

## Arquivos gerados ou alterados

### API

- `api/src/modules/finance/domain/entry/installment-plan.ts`
- `api/src/modules/finance/domain/entry/installment-plan.spec.ts`
- `api/src/modules/finance/application/use-cases/entries/create-installment-expenses.ts`
- `api/src/modules/finance/application/use-cases/entries/create-installment-expenses.spec.ts`
- `api/src/modules/finance/finance.module.ts`
- `api/src/modules/finance/presentation/http/entries.controller.ts`
- `api/src/modules/finance/presentation/http/schemas/entry.schemas.ts`
- `api/test/e2e/payments.e2e-spec.ts`
- `api/test/e2e/access-control.e2e-spec.ts`
- `api/test/e2e/owner-isolation.e2e-spec.ts`
- `api/test/support/finance-harness.ts`

### Web

- `web/app/(protected)/entries/actions.ts`
- `web/app/(protected)/entries/actions.spec.ts`
- `web/features/entries/_components/entries-header.tsx`
- `web/features/entries/_components/entries-tabs-bar.tsx`
- `web/features/entries/_components/entry-drawer-context.tsx`
- `web/features/entries/_components/entry-drawer-host.tsx`
- `web/features/entries/_components/installment-expense-drawer.tsx`
- `web/features/entries/_components/installment-expense-drawer.spec.tsx`
- `web/lib/api/endpoints.ts`
- `web/lib/api/types.ts`
- `web/lib/entries/installments.ts`
- `web/lib/entries/installments.spec.ts`

### Documentação

- `docs/specs/despesas-parceladas.md`
- `docs/adr/0010-despesas-parceladas.md`
- `docs/design/despesas-parceladas.md`
- `docs/api/finance.md`
- `docs/runs/expense-installments.md`

## Verificação

- API: 12 testes unitários focados e 67 testes e2e passaram.
- Web: 11 testes de drawer, prévia e Server Actions passaram.
- Cobertura dos arquivos novos de domínio e aplicação: 92% statements e 82,69% branches.
- Typecheck da API e web passaram.
- ESLint dos arquivos web alterados passou.
- Lint da API passou com 10 warnings existentes em arquivos fora das alterações desta feature.
