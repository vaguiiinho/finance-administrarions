import { InvariantViolationError } from '@shared/domain/app-error.js';
import { Money } from '@shared/domain/value-objects/money.js';
import { buildOwnedHarness } from '@test/support/owned-harness.js';
import { ANA, BRUNO, ana, bruno, ownedCard, ownedCardExpense, ownedEntry, ownerOf, owner } from '@test/support/owned-builders.js';
import { cardUuid, entryUuid, rawEntry, rejected } from '@test/support/builders.js';
import { ListExpenses } from './entries/list-expenses.js';
import { ListIncomes } from './entries/list-incomes.js';
import { ListCategories } from './entries/list-categories.js';
import { ListInvoices } from './invoices/list-invoices.js';
import { GetMonthlySummary } from './summary/get-monthly-summary.js';
import { GetMonthlySeries } from './dashboard/get-monthly-series.js';
import { GetCategoryDistribution } from './dashboard/get-category-distribution.js';

/**
 * Isolamento por dono nos use cases (ADR 0005 5.5, RF23-RF26, CA28-CA33). Os fakes (owned-finance-fakes) so devolvem
 * dados do dono informado e FALHAM ALTO se o use case nao o informar.
 */
const asOwner = (id: unknown) => String((id as { value?: string } | string).hasOwnProperty('value') ? (id as { value: string }).value : id);

describe('CreateCard com dono', () => {
  it('CA28: o dono vem do input e fica no aggregate; a view nao expoe dono', async () => {
    const h = buildOwnedHarness();
    const view = await h.createCard.execute({ ownerId: ANA, name: 'Nubank', closingDay: 25, dueDay: 5 } as never);
    expect(ownerOf(h.cards.get({ value: view.id })! as never)).toBe(ANA);
    expect(JSON.stringify(view)).not.toMatch(/owner|userId/i);
  });

  it('CardCreated leva o dono no payload', async () => {
    const h = buildOwnedHarness();
    await h.createCard.execute({ ownerId: ANA, name: 'Nubank', closingDay: 25, dueDay: 5 } as never);
    expect(String((h.publisher.published[0] as { ownerId?: unknown }).ownerId)).toBe(ANA);
  });

  it('CA32: Bruno tem "Nubank"; Ana cria "nubank" (ok) e "NUBANK" de novo -> 409 CARD_NAME_TAKEN', async () => {
    const h = buildOwnedHarness();
    await h.createCard.execute({ ownerId: BRUNO, name: 'Nubank', closingDay: 25, dueDay: 5 } as never);
    const first = await h.createCard.execute({ ownerId: ANA, name: 'nubank', closingDay: 25, dueDay: 5 } as never);
    expect(first.name).toBe('nubank');
    const error = await rejected(h.createCard.execute({ ownerId: ANA, name: 'NUBANK', closingDay: 1, dueDay: 2 } as never));
    expect(error).toMatchObject({ code: 'CARD_NAME_TAKEN', kind: 'conflict' });
    expect(h.cards.store.size).toBe(2);
  });

  it('ownerId malformado e erro de programacao (500), nao 400: o valor vem do principal, nunca do corpo', async () => {
    const h = buildOwnedHarness();
    const error = await rejected(h.createCard.execute({ ownerId: 'abc', name: 'X', closingDay: 1, dueDay: 2 } as never));
    expect(error).toBeInstanceOf(InvariantViolationError);
    expect(h.cards.store.size).toBe(0);
  });
});

describe('UpdateCard com dono', () => {
  it('CA30: cartao de outro dono -> 404 CARD_NOT_FOUND igual ao inexistente; nada muda', async () => {
    const h = buildOwnedHarness();
    h.cards.seed(ownedCard(bruno, 1, { name: 'Nubank', closingDay: 10, dueDay: 17 }));
    const other = await rejected(
      h.updateCard.execute({ ownerId: ANA, id: cardUuid(1), name: 'Hack', closingDay: 1, dueDay: 2 } as never),
    );
    const missing = await rejected(
      h.updateCard.execute({ ownerId: ANA, id: cardUuid(99), name: 'Hack', closingDay: 1, dueDay: 2 } as never),
    );
    expect(other).toMatchObject({ code: 'CARD_NOT_FOUND', kind: 'not_found', details: { id: cardUuid(1) } });
    expect(missing).toMatchObject({ code: 'CARD_NOT_FOUND', kind: 'not_found' });
    expect(other.message).toBe(missing.message);
    expect(h.cards.get({ value: cardUuid(1) })!.name.value).toBe('Nubank');
  });

  it('CA32: Ana pode renomear o cartao dela para o nome que Bruno usa', async () => {
    const h = buildOwnedHarness();
    h.cards.seed(ownedCard(bruno, 1, { name: 'Nubank' }));
    h.cards.seed(ownedCard(ana, 2, { name: 'Itau' }));
    const view = await h.updateCard.execute({ ownerId: ANA, id: cardUuid(2), name: 'Nubank', closingDay: 25, dueDay: 5 } as never);
    expect(view.name).toBe('Nubank');
  });
});

describe('ListCards com dono', () => {
  it('CA29: cada um lista so os proprios cartoes', async () => {
    const h = buildOwnedHarness();
    h.cards.seed(ownedCard(ana, 1, { name: 'Nubank' }));
    h.cards.seed(ownedCard(bruno, 2, { name: 'Itau' }));
    const a = await h.listCards.execute({ ownerId: ANA } as never);
    const b = await h.listCards.execute({ ownerId: BRUNO } as never);
    expect(a.items.map((c) => c.name)).toEqual(['Nubank']);
    expect(b.items.map((c) => c.name)).toEqual(['Itau']);
  });
});

describe('CreateEntry com dono', () => {
  it('CA28: lancamento criado pertence ao usuario autenticado', async () => {
    const h = buildOwnedHarness();
    const view = await h.createEntry.execute({ ownerId: ANA, ...rawEntry() } as never);
    expect(ownerOf(h.entries.get({ value: view.id })! as never)).toBe(ANA);
    expect(JSON.stringify(view)).not.toMatch(/owner|userId/i);
    expect(String((h.publisher.published[0] as { ownerId?: unknown }).ownerId)).toBe(ANA);
  });

  it('CA30: cardId de outro dono -> 404 CARD_NOT_FOUND e nada e gravado', async () => {
    const h = buildOwnedHarness();
    h.cards.seed(ownedCard(bruno, 1));
    const error = await rejected(
      h.createEntry.execute({ ownerId: ANA, ...rawEntry({ paymentMethod: 'CARD', cardId: cardUuid(1) }) } as never),
    );
    expect(error).toMatchObject({ code: 'CARD_NOT_FOUND', kind: 'not_found', details: { id: cardUuid(1) } });
    expect(h.entries.store.size).toBe(0);
  });

  it('despesa no cartao do proprio dono funciona', async () => {
    const h = buildOwnedHarness();
    h.cards.seed(ownedCard(ana, 1));
    const view = await h.createEntry.execute({
      ownerId: ANA,
      ...rawEntry({ paymentMethod: 'CARD', cardId: cardUuid(1), date: '2026-10-10' }),
    } as never);
    expect(view.card).toMatchObject({ id: cardUuid(1) });
  });

  it('CA33: grafia canonica da categoria e por dono', async () => {
    const h = buildOwnedHarness();
    await h.createEntry.execute({ ownerId: BRUNO, ...rawEntry({ category: 'alimentação' }) } as never);
    const first = await h.createEntry.execute({ ownerId: ANA, ...rawEntry({ category: 'Alimentação' }) } as never);
    const second = await h.createEntry.execute({ ownerId: ANA, ...rawEntry({ category: 'ALIMENTAÇÃO' }) } as never);
    expect(first.category).toBe('Alimentação');
    expect(second.category).toBe('Alimentação');
    const bruno1 = h.entries.all().find((e) => ownerOf(e as never) === BRUNO)!;
    expect(bruno1.toSnapshot().category.value).toBe('alimentação');
  });
});

describe('Pagamentos com dono', () => {
  it('CA30: MarkEntryAsPaid de lancamento de outro dono -> 404 ENTRY_NOT_FOUND; o de Bruno continua PENDING', async () => {
    const h = buildOwnedHarness();
    h.entries.seed(ownedEntry(bruno, 1, { paid: false }));
    const error = await rejected(h.markEntryAsPaid.execute({ ownerId: ANA, id: entryUuid(1) } as never));
    expect(error).toMatchObject({ code: 'ENTRY_NOT_FOUND', kind: 'not_found', details: { id: entryUuid(1) } });
    expect(h.entries.get({ value: entryUuid(1) })!.toSnapshot().status).toBe('PENDING');
  });

  it('o dono paga o proprio lancamento', async () => {
    const h = buildOwnedHarness();
    h.entries.seed(ownedEntry(ana, 1, { paid: false }));
    const view = await h.markEntryAsPaid.execute({ ownerId: ANA, id: entryUuid(1) } as never);
    expect(view.status).toBe('PAID');
  });

  it('CA31: lote [A1, B1] -> 404 ENTRIES_NOT_FOUND com missingIds [B1]; nem A1 nem B1 sao pagas', async () => {
    const h = buildOwnedHarness();
    h.entries.seed(ownedEntry(ana, 1, { paid: false }));
    h.entries.seed(ownedEntry(bruno, 2, { paid: false }));
    const error = await rejected(h.payBatch.execute({ ownerId: ANA, ids: [entryUuid(1), entryUuid(2)] } as never));
    expect(error).toMatchObject({ code: 'ENTRIES_NOT_FOUND', kind: 'not_found', details: { missingIds: [entryUuid(2)] } });
    expect(h.entries.get({ value: entryUuid(1) })!.toSnapshot().status).toBe('PENDING');
    expect(h.entries.get({ value: entryUuid(2) })!.toSnapshot().status).toBe('PENDING');
  });

  it('CA30: PayInvoice de cartao de outro dono -> 404 CARD_NOT_FOUND e as despesas do outro continuam PENDING', async () => {
    const h = buildOwnedHarness();
    const card = ownedCard(bruno, 1, { closingDay: 25, dueDay: 5 });
    h.cards.seed(card);
    h.entries.seed(ownedCardExpense(bruno, 1, card));
    const error = await rejected(
      h.payInvoice.execute({ ownerId: ANA, cardId: cardUuid(1), referenceMonth: '2026-11' } as never),
    );
    expect(error).toMatchObject({ code: 'CARD_NOT_FOUND', kind: 'not_found' });
    expect(h.entries.get({ value: entryUuid(1) })!.toSnapshot().status).toBe('PENDING');
  });

  it('PayInvoice do dono paga so as despesas dele', async () => {
    const h = buildOwnedHarness();
    const card = ownedCard(ana, 1, { closingDay: 25, dueDay: 5 });
    h.cards.seed(card);
    h.entries.seed(ownedCardExpense(ana, 1, card));
    const result = await h.payInvoice.execute({ ownerId: ANA, cardId: cardUuid(1), referenceMonth: '2026-11' } as never);
    expect(result.paidCount).toBe(1);
  });
});

describe('Faturas de cartao de outro dono', () => {
  it('CA30/CA25: ListInvoiceEntries com cartao de outro dono -> 404 CARD_NOT_FOUND (invoices read model nem e consultado)', async () => {
    const h = buildOwnedHarness();
    h.cards.seed(ownedCard(bruno, 1));
    const listEntries = vi.fn(async () => []);
    const useCase = h.listInvoiceEntries({ listByMonth: vi.fn(), listEntries });
    const error = await rejected(useCase.execute({ ownerId: ANA, cardId: cardUuid(1), referenceMonth: '2026-11' } as never));
    expect(error).toMatchObject({ code: 'CARD_NOT_FOUND', kind: 'not_found' });
    expect(listEntries).not.toHaveBeenCalled();
  });

  it('cartao do proprio dono: consulta as despesas passando o dono', async () => {
    const h = buildOwnedHarness();
    h.cards.seed(ownedCard(ana, 1));
    const listEntries = vi.fn(async () => []);
    const useCase = h.listInvoiceEntries({ listByMonth: vi.fn(), listEntries });
    await useCase.execute({ ownerId: ANA, cardId: cardUuid(1), referenceMonth: '2026-11' } as never);
    expect(listEntries).toHaveBeenCalledTimes(1);
    expect(asOwner((listEntries.mock.calls[0] as unknown[])[0])).toBe(ANA);
  });
});

/** Leituras: o use case entrega o dono (OwnerId) como PRIMEIRO argumento do read model (ADR 0005 4.2/5.5). */
describe('Leituras entregam o dono ao read model', () => {
  const zeroTotals = { income: Money.ZERO, paidExpenses: Money.ZERO, pendingExpenses: Money.ZERO };
  const ownerArg = (fn: ReturnType<typeof vi.fn>) => asOwner((fn.mock.calls[0] as unknown[])[0]);

  it('ListExpenses', async () => {
    const listExpenses = vi.fn(async () => ({ items: [], totalItems: 0, subtotal: { paid: Money.ZERO, pending: Money.ZERO } }));
    await new ListExpenses({ listExpenses } as never).execute({ ownerId: BRUNO, month: '2026-11' } as never);
    expect(ownerArg(listExpenses)).toBe(BRUNO);
  });

  it('ListIncomes', async () => {
    const listIncomes = vi.fn(async () => ({ items: [], totalItems: 0, subtotal: Money.ZERO }));
    await new ListIncomes({ listIncomes } as never).execute({ ownerId: BRUNO, month: '2026-11' } as never);
    expect(ownerArg(listIncomes)).toBe(BRUNO);
  });

  it('ListCategories', async () => {
    const listDistinct = vi.fn(async () => []);
    await new ListCategories({ listDistinct }).execute({ ownerId: ANA } as never);
    expect(ownerArg(listDistinct)).toBe(ANA);
  });

  it('ListInvoices', async () => {
    const listByMonth = vi.fn(async () => []);
    await new ListInvoices({ listByMonth } as never).execute({ ownerId: ANA, month: '2026-11' } as never);
    expect(ownerArg(listByMonth)).toBe(ANA);
  });

  it('GetMonthlySummary', async () => {
    const summary = vi.fn(async () => zeroTotals);
    await new GetMonthlySummary({ summary } as never).execute({ ownerId: BRUNO, month: '2026-11' } as never);
    expect(ownerArg(summary)).toBe(BRUNO);
  });

  it('GetMonthlySeries', async () => {
    const monthlySeries = vi.fn(async (_o: unknown, from: { toString(): string }) => {
      const [y, m] = from.toString().split('-').map(Number);
      return Array.from({ length: 12 }, (_, i) => {
        const idx = y * 12 + (m - 1) + i;
        return { month: { toString: () => '' } as never, totals: zeroTotals, _idx: idx };
      });
    });
    await new GetMonthlySeries({ monthlySeries } as never).execute({ ownerId: ANA, month: '2026-11' } as never).catch(() => undefined);
    expect(ownerArg(monthlySeries)).toBe(ANA);
  });

  it('GetCategoryDistribution', async () => {
    const expenseDistribution = vi.fn(async () => []);
    await new GetCategoryDistribution({ expenseDistribution } as never).execute({ ownerId: BRUNO, month: '2026-11' } as never);
    expect(ownerArg(expenseDistribution)).toBe(BRUNO);
  });

  it('ownerId malformado e erro de programacao (500)', async () => {
    const error = await rejected(new GetMonthlySummary({ summary: vi.fn() } as never).execute({ ownerId: 'x', month: '2026-11' } as never));
    expect(error).toBeInstanceOf(InvariantViolationError);
    void owner;
  });
});
