import { DEFAULT_OWNER, rawEntry, rejected } from '@test/support/builders.js';
import { buildHarness } from '@test/support/finance-harness.js';

describe('DeleteExpense', () => {
  it('remove despesa e publica evento depois da exclusao', async () => {
    const h = buildHarness();
    const expense = await h.createEntry.execute(rawEntry({ paid: false }));

    await h.deleteExpense.execute({ ownerId: DEFAULT_OWNER.value, id: expense.id });

    expect(h.entries.get({ value: expense.id })).toBeUndefined();
    expect(h.entries.calls.delete).toBe(1);
    expect(h.publisher.names()).toEqual(['EntryCreated', 'EntryDeleted']);
  });

  it('retorna 404 para id inexistente e nao publica evento', async () => {
    const h = buildHarness();
    const error = await rejected(h.deleteExpense.execute({ ownerId: DEFAULT_OWNER.value, id: '0192f1e2-0000-7000-8000-000000000999' }));

    expect(error).toMatchObject({ code: 'ENTRY_NOT_FOUND', kind: 'not_found' });
    expect(h.entries.calls.delete).toBe(0);
    expect(h.publisher.names()).toEqual([]);
  });

  it('rejeita receita e preserva o lancamento', async () => {
    const h = buildHarness();
    const income = await h.createEntry.execute(rawEntry({ type: 'INCOME' }));
    const error = await rejected(h.deleteExpense.execute({ ownerId: DEFAULT_OWNER.value, id: income.id }));

    expect(error).toMatchObject({ code: 'ENTRY_NOT_DELETABLE', kind: 'business_rule' });
    expect(h.entries.get({ value: income.id })).toBeDefined();
    expect(h.entries.calls.delete).toBe(0);
  });

  it('valida o id antes de abrir transacao', async () => {
    const h = buildHarness();
    const error = await rejected(h.deleteExpense.execute({ ownerId: DEFAULT_OWNER.value, id: 'invalid' }));

    expect(error).toMatchObject({ code: 'VALIDATION_ERROR', kind: 'validation' });
    expect(h.uow.runs).toBe(0);
  });
});
