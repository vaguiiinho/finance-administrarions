import { DEFAULT_OWNER, rawEntry, rejected } from '@test/support/builders.js';
import { buildHarness } from '@test/support/finance-harness.js';

const edit = (over: Partial<{ description: string; category: string; date: string; amount: string }> = {}) => ({
  description: 'Descrição corrigida',
  category: 'Mercado',
  date: '2026-10-10',
  amount: '45.90',
  ...over,
});

describe('UpdateExpense', () => {
  it('edita e persiste uma despesa PIX sem alterar seu status ou paidAt', async () => {
    const h = buildHarness();
    const original = await h.createEntry.execute(rawEntry({ paid: false }));
    const previousEventCount = h.publisher.published.length;

    const result = await h.updateExpense.execute({ ownerId: DEFAULT_OWNER.value, id: original.id, ...edit({ date: '2026-11-02' }) });

    expect(result).toMatchObject({
      id: original.id,
      description: 'Descrição corrigida',
      category: 'Mercado',
      date: expect.objectContaining({ toString: expect.any(Function) }),
      amount: expect.objectContaining({ toString: expect.any(Function) }),
      status: 'PENDING',
      paidAt: null,
      referenceMonth: expect.objectContaining({ toString: expect.any(Function) }),
    });
    expect(result.date.toString()).toBe('2026-11-02');
    expect(result.amount.toString()).toBe('45.90');
    expect(result.referenceMonth.toString()).toBe('2026-11');
    expect(h.entries.calls.update).toBe(1);
    expect(h.uow.runs).toBe(1);
    expect(h.publisher.names().slice(previousEventCount)).toEqual(['EntryUpdated']);
  });

  it('mantém a categoria canônica já usada, independentemente da caixa informada', async () => {
    const h = buildHarness();
    await h.createEntry.execute(rawEntry({ category: 'Alimentação' }));
    const entry = await h.createEntry.execute(rawEntry({ category: 'Moradia' }));

    const result = await h.updateExpense.execute({ ownerId: DEFAULT_OWNER.value, id: entry.id, ...edit({ category: 'alimentação' }) });

    expect(result.category).toBe('Alimentação');
  });

  it('recalcula a fatura ao mudar a data de cartão pendente e usa o fechamento vigente', async () => {
    const h = buildHarness();
    const card = await h.createCard.execute({ name: 'Cartão', closingDay: 25, dueDay: 5 });
    const entry = await h.createEntry.execute(rawEntry({ paymentMethod: 'CARD', cardId: card.id, paid: undefined }));
    await h.updateCard.execute({ id: card.id, name: 'Cartão', closingDay: 20, dueDay: 25 });

    const result = await h.updateExpense.execute({
      ownerId: DEFAULT_OWNER.value,
      id: entry.id,
      ...edit({ date: '2026-10-21' }),
    });

    expect(result.invoice?.closingDate.toString()).toBe('2026-11-20');
    expect(result.invoice?.dueDate.toString()).toBe('2026-11-25');
    expect(result.referenceMonth.toString()).toBe('2026-11');
    expect(result.status).toBe('PENDING');
  });

  it('retorna 422 para receita e não persiste', async () => {
    const h = buildHarness();
    const income = await h.createEntry.execute(rawEntry({ type: 'INCOME' }));

    const error = await rejected(h.updateExpense.execute({ ownerId: DEFAULT_OWNER.value, id: income.id, ...edit() }));

    expect(error).toMatchObject({ code: 'ENTRY_NOT_EDITABLE', kind: 'business_rule' });
    expect(h.entries.calls.update).toBe(0);
  });

  it('valida campos antes de acessar o banco', async () => {
    const h = buildHarness();

    const error = await rejected(h.updateExpense.execute({ ownerId: DEFAULT_OWNER.value, id: 'invalid', ...edit({ amount: '0' }) }));

    expect(error).toMatchObject({ code: 'VALIDATION_ERROR', kind: 'validation' });
    expect(h.uow.runs).toBe(0);
    expect(h.entries.calls.update).toBe(0);
  });
});
