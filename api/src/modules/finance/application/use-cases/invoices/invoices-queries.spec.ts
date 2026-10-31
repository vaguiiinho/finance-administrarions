import { cardUuid, date, money, newCard, rejected, ownedUseCase } from '@test/support/builders.js';
import { unwrap } from '@test/support/result.js';
import { ReferenceMonth } from '@finance/domain/billing/reference-month.js';
import { InMemoryCardReadModel } from '@test/fakes/in-memory-read-models.js';
import { InMemoryCardRepository } from '@test/fakes/in-memory-repositories.js';
import { ListInvoices } from './list-invoices.js';
import { ListInvoiceEntries } from './list-invoice-entries.js';

const rm = (v: string) => unwrap<ReferenceMonth>(ReferenceMonth.parse(v));
const row = (over: Record<string, unknown> = {}) => ({
  card: { id: cardUuid(1), name: 'A' },
  referenceMonth: rm('2026-11'),
  closingDate: date('2026-10-25'),
  dueDate: date('2026-11-05'),
  entryCount: 2,
  pendingCount: 1,
  paid: money('40.00'),
  pending: money('100.00'),
  ...over,
});

describe('ListInvoices', () => {
  it('CA43: mapeia cada fatura com datas, contagens e ExpenseTotals', async () => {
    const invoices = { listByMonth: vi.fn(async (_owner: unknown, _month: unknown) => [row(), row({ card: { id: cardUuid(2), name: 'B' }, entryCount: 1, pendingCount: 1, paid: money('0'), pending: money('60.00'), closingDate: date('2026-11-03'), dueDate: date('2026-11-10') })]), listEntries: vi.fn() };
    const result = await ownedUseCase(ListInvoices, invoices as never).execute({ month: '2026-11' });
    expect(result.month.toString()).toBe('2026-11');
    expect(result.items).toHaveLength(2);
    const [a, b] = result.items;
    expect(a.card).toEqual({ id: cardUuid(1), name: 'A' });
    expect(a.closingDate.toString()).toBe('2026-10-25');
    expect(a.dueDate.toString()).toBe('2026-11-05');
    expect(a.entryCount).toBe(2);
    expect(a.pendingCount).toBe(1);
    expect(a.totals.total.toString()).toBe('140.00');
    expect(a.totals.paid.toString()).toBe('40.00');
    expect(a.totals.pending.toString()).toBe('100.00');
    expect(b.totals.total.toString()).toBe('60.00');
    expect(b.card.name).toBe('B'); // ordem do read model preservada
    expect(String((invoices.listByMonth.mock.calls[0][1] as { month: unknown }).month)).toBe('2026-11');
  });

  it('CA45: fatura paga mantem pendingCount 0 e pendente 0.00', async () => {
    const invoices = { listByMonth: vi.fn(async () => [row({ pendingCount: 0, pending: money('0'), paid: money('140.00') })]), listEntries: vi.fn() };
    const [item] = (await ownedUseCase(ListInvoices, invoices as never).execute({ month: '2026-11' })).items;
    expect(item.pendingCount).toBe(0);
    expect(item.totals.pending.toString()).toBe('0.00');
  });

  it('CA44: nenhuma fatura -> lista vazia', async () => {
    const invoices = { listByMonth: vi.fn(async () => []), listEntries: vi.fn() };
    expect((await ownedUseCase(ListInvoices, invoices as never).execute({ month: '2026-11' })).items).toEqual([]);
  });

  it('mes obrigatorio/valido -> 400', async () => {
    const invoices = { listByMonth: vi.fn(), listEntries: vi.fn() };
    for (const month of [undefined, '2026-13']) {
      const error = await rejected(ownedUseCase(ListInvoices, invoices as never).execute({ month } as never));
      expect(error).toMatchObject({ code: 'VALIDATION_ERROR' });
    }
    expect(invoices.listByMonth).not.toHaveBeenCalled();
  });
});

describe('ListInvoices - filtro por status (ADR 0007 5.3/6.2, CA45, CA47, CA59)', () => {
  const criteriaOf = (invoices: { listByMonth: ReturnType<typeof vi.fn> }) => invoices.listByMonth.mock.calls[0][1] as { month: { toString(): string }; status?: string };

  it('sem status: o read model recebe so o mes (resposta igual a anterior)', async () => {
    const invoices = { listByMonth: vi.fn(async () => [row()]), listEntries: vi.fn() };
    const result = await ownedUseCase(ListInvoices, invoices as never).execute({ month: '2026-11' });
    expect(result.items).toHaveLength(1);
    expect(criteriaOf(invoices).month.toString()).toBe('2026-11');
    expect(criteriaOf(invoices).status).toBeUndefined();
  });

  it.each(['PENDING', 'PAID'] as const)('status=%s e repassado ao read model junto do mes', async (status) => {
    const invoices = { listByMonth: vi.fn(async () => []), listEntries: vi.fn() };
    await ownedUseCase(ListInvoices, invoices as never).execute({ month: '2026-11', status } as never);
    expect(criteriaOf(invoices)).toMatchObject({ status });
    expect(criteriaOf(invoices).month.toString()).toBe('2026-11');
  });

  it('RF18/DR7: o filtro seleciona a fatura inteira - totais e contagens da fatura parcial seguem completos', async () => {
    const invoices = { listByMonth: vi.fn(async () => [row({ entryCount: 2, pendingCount: 1, paid: money('40.00'), pending: money('100.00') })]), listEntries: vi.fn() };
    const [item] = (await ownedUseCase(ListInvoices, invoices as never).execute({ month: '2026-11', status: 'PENDING' } as never)).items;
    expect(item.entryCount).toBe(2);
    expect(item.pendingCount).toBe(1);
    expect(item.totals.total.toString()).toBe('140.00');
    expect(item.totals.paid.toString()).toBe('40.00');
  });

  it.each([['ALL'], ['pending'], ['paid'], ['RECEIVED'], ['']])('status invalido %j -> 400 VALIDATION_ERROR no campo status, sem consultar o read model', async (status) => {
    const invoices = { listByMonth: vi.fn(), listEntries: vi.fn() };
    const error = await rejected(ownedUseCase(ListInvoices, invoices as never).execute({ month: '2026-11', status } as never));
    expect(error).toMatchObject({ code: 'VALIDATION_ERROR', kind: 'validation' });
    expect(error.details.fields).toEqual([expect.objectContaining({ field: 'status', code: 'INVALID_VALUE' })]);
    expect(invoices.listByMonth).not.toHaveBeenCalled();
  });

  it('mes invalido e status invalido: as duas violacoes voltam juntas', async () => {
    const invoices = { listByMonth: vi.fn(), listEntries: vi.fn() };
    const error = await rejected(ownedUseCase(ListInvoices, invoices as never).execute({ month: '2026-13', status: 'ALL' } as never));
    expect((error.details.fields as { field: string }[]).map((f) => f.field).sort()).toEqual(['month', 'status']);
  });
});

describe('ListInvoiceEntries (pedido (b) do design)', () => {
  function setup(items: unknown[] = []) {
    const cards = new InMemoryCardRepository();
    cards.seed(newCard(1, { name: 'Nubank' }));
    const invoices = { listByMonth: vi.fn(), listEntries: vi.fn(async (_owner: unknown, _key: unknown) => items) };
    return { cards, invoices, useCase: ownedUseCase(ListInvoiceEntries, new InMemoryCardReadModel(cards), invoices as never) };
  }

  it('busca por (cartao, mes) e devolve card, referenceMonth e itens', async () => {
    const items = [{ id: 'x' }, { id: 'y' }];
    const { invoices, useCase } = setup(items);
    const result = await useCase.execute({ cardId: cardUuid(1), referenceMonth: '2026-11' });
    const key = invoices.listEntries.mock.calls[0][1] as any;
    expect(key.cardId.value).toBe(cardUuid(1));
    expect(key.referenceMonth.toString()).toBe('2026-11');
    expect(result.card).toEqual({ id: cardUuid(1), name: 'Nubank' });
    expect(result.referenceMonth.toString()).toBe('2026-11');
    expect(result.items).toEqual(items);
  });

  it('cartao existente sem despesas no mes -> items [] (nao 404)', async () => {
    const { useCase } = setup([]);
    await expect(useCase.execute({ cardId: cardUuid(1), referenceMonth: '2027-01' })).resolves.toMatchObject({ items: [] });
  });

  it('cartao inexistente -> 404 CARD_NOT_FOUND', async () => {
    const { useCase, invoices } = setup();
    const error = await rejected(useCase.execute({ cardId: cardUuid(9), referenceMonth: '2026-11' }));
    expect(error).toMatchObject({ code: 'CARD_NOT_FOUND', kind: 'not_found' });
    expect(invoices.listEntries).not.toHaveBeenCalled();
  });

  it('400 vence 404: mes invalido com cartao inexistente; cardId mal formado', async () => {
    const { useCase } = setup();
    expect((await rejected(useCase.execute({ cardId: cardUuid(9), referenceMonth: '2026-13' }))).code).toBe('VALIDATION_ERROR');
    expect((await rejected(useCase.execute({ cardId: 'abc', referenceMonth: '2026-11' }))).code).toBe('VALIDATION_ERROR');
  });
});
