import { buildHarness } from '@test/support/finance-harness.js';
import { NOW, cardExpense, entryId, entryUuid, income, newCard, pixExpense, rejected } from '@test/support/builders.js';

const LATER = new Date('2026-10-06T09:30:00.000Z');
const id = entryUuid;

describe('PayEntriesInBatch', () => {
  it('CA29: todas pendentes -> pagas, resposta lista ambas', async () => {
    const h = buildHarness(LATER);
    h.entries.seed(pixExpense(1, { amount: '100.00', paid: false }));
    h.entries.seed(pixExpense(2, { amount: '50.25', paid: false }));
    const result = await h.payBatch.execute({ ids: [id(1), id(2)] });
    expect(result).toEqual({ paidIds: [id(1), id(2)], alreadyPaidIds: [] });
    expect(h.entries.get(entryId(1))!.status).toBe('PAID');
    expect(h.entries.get(entryId(2))!.status).toBe('PAID');
    expect(h.publisher.names()).toEqual(['EntryPaid', 'EntryPaid']);
  });

  it('paidAt unico no lote (uma leitura de clock)', async () => {
    const h = buildHarness(LATER);
    h.entries.seed(pixExpense(1, { paid: false }));
    h.entries.seed(pixExpense(2, { paid: false }));
    await h.payBatch.execute({ ids: [id(1), id(2)] });
    expect(h.entries.get(entryId(1))!.toSnapshot().paidAt).toEqual(LATER);
    expect(h.entries.get(entryId(2))!.toSnapshot().paidAt).toEqual(LATER);
    expect(h.clock.reads).toBe(1);
  });

  it('CA30: mista - B ja paga fica intacta (paidAt) e vai para alreadyPaidIds; so A gera evento', async () => {
    const h = buildHarness(LATER);
    h.entries.seed(pixExpense(1, { paid: false }));
    h.entries.seed(pixExpense(2)); // paga em NOW
    const result = await h.payBatch.execute({ ids: [id(1), id(2)] });
    expect(result).toEqual({ paidIds: [id(1)], alreadyPaidIds: [id(2)] });
    expect(h.entries.get(entryId(2))!.toSnapshot().paidAt).toEqual(NOW);
    expect(h.publisher.names()).toEqual(['EntryPaid']);
  });

  it('respeita a ordem do request (deduplicado) na saida', async () => {
    const h = buildHarness(LATER);
    for (const n of [1, 2, 3]) h.entries.seed(pixExpense(n, { paid: false }));
    const result = await h.payBatch.execute({ ids: [id(3), id(1), id(2)] });
    expect(result.paidIds).toEqual([id(3), id(1), id(2)]);
  });

  it('CA31: ids inexistentes -> 404 ENTRIES_NOT_FOUND com TODOS os ausentes; A segue PENDING', async () => {
    const h = buildHarness(LATER);
    h.entries.seed(pixExpense(1, { paid: false }));
    const error = await rejected(h.payBatch.execute({ ids: [id(1), id(8), id(9)] }));
    expect(error).toMatchObject({ code: 'ENTRIES_NOT_FOUND', kind: 'not_found' });
    expect(error.details.missingIds).toEqual([id(8), id(9)]);
    expect(h.entries.get(entryId(1))!.status).toBe('PENDING');
    expect(h.publisher.published).toEqual([]);
  });

  it('CA32: receita no lote -> 422 ENTRIES_NOT_PAYABLE listando as receitas; despesa segue PENDING', async () => {
    const h = buildHarness(LATER);
    h.entries.seed(pixExpense(1, { paid: false }));
    h.entries.seed(income(2));
    h.entries.seed(income(3));
    const error = await rejected(h.payBatch.execute({ ids: [id(1), id(2), id(3)] }));
    expect(error).toMatchObject({ code: 'ENTRIES_NOT_PAYABLE', kind: 'business_rule' });
    expect(error.details.incomeIds).toEqual([id(2), id(3)]);
    expect(h.entries.get(entryId(1))!.status).toBe('PENDING');
    expect(h.entries.calls.saveAll).toBe(0);
  });

  it('CA33: 404 tem precedencia sobre 422 (receita + inexistente)', async () => {
    const h = buildHarness(LATER);
    h.entries.seed(income(1));
    const error = await rejected(h.payBatch.execute({ ids: [id(1), id(9)] }));
    expect(error.code).toBe('ENTRIES_NOT_FOUND');
    expect(error.details.missingIds).toEqual([id(9)]);
  });

  it('P07: receita + despesa ja paga -> 422', async () => {
    const h = buildHarness(LATER);
    h.entries.seed(pixExpense(1));
    h.entries.seed(income(2));
    const error = await rejected(h.payBatch.execute({ ids: [id(1), id(2)] }));
    expect(error.code).toBe('ENTRIES_NOT_PAYABLE');
  });

  it('CA34: falha no meio da gravacao -> rollback total e nada publicado', async () => {
    const h = buildHarness(LATER);
    for (const n of [1, 2, 3]) h.entries.seed(pixExpense(n, { paid: false }));
    h.entries.failAfter = 1;
    await expect(h.payBatch.execute({ ids: [id(1), id(2), id(3)] })).rejects.toThrow();
    for (const n of [1, 2, 3]) expect(h.entries.get(entryId(n))!.status).toBe('PENDING');
    expect(h.publisher.published).toEqual([]);
    expect(h.uow.rollbacks).toBe(1);
  });

  it('CA35: ids duplicados -> paga uma unica vez, sucesso', async () => {
    const h = buildHarness(LATER);
    h.entries.seed(pixExpense(1, { paid: false }));
    const result = await h.payBatch.execute({ ids: [id(1), id(1)] });
    expect(result).toEqual({ paidIds: [id(1)], alreadyPaidIds: [] });
    expect(h.publisher.names()).toEqual(['EntryPaid']);
  });

  it('despesas de cartoes diferentes e PIX no mesmo lote (CA70)', async () => {
    const h = buildHarness(LATER);
    const c1 = newCard(1);
    const c2 = newCard(2);
    h.entries.seed(cardExpense(1, c1));
    h.entries.seed(cardExpense(2, c2));
    h.entries.seed(pixExpense(3, { paid: false }));
    const result = await h.payBatch.execute({ ids: [id(1), id(2), id(3)] });
    expect(result.paidIds).toHaveLength(3);
  });

  describe('CA36: lote invalido -> 400 e nada alterado', () => {
    it('lista vazia', async () => {
      const h = buildHarness(LATER);
      const error = await rejected(h.payBatch.execute({ ids: [] }));
      expect(error).toMatchObject({ code: 'VALIDATION_ERROR', kind: 'validation' });
      expect(error.details.fields).toContainEqual(expect.objectContaining({ field: 'ids', code: 'EMPTY' }));
    });

    it('id mal formado aponta o indice', async () => {
      const h = buildHarness(LATER);
      const error = await rejected(h.payBatch.execute({ ids: [id(1), 'abc'] }));
      expect(error.code).toBe('VALIDATION_ERROR');
      expect(error.details.fields).toContainEqual(expect.objectContaining({ field: 'ids[1]', code: 'INVALID_FORMAT' }));
    });

    it('101 itens na lista bruta (mesmo repetidos) -> TOO_MANY_ITEMS; 100 e aceito', async () => {
      const h = buildHarness(LATER);
      h.entries.seed(pixExpense(1, { paid: false }));
      const error = await rejected(h.payBatch.execute({ ids: Array(101).fill(id(1)) }));
      expect(error.details.fields).toContainEqual(expect.objectContaining({ field: 'ids', code: 'TOO_MANY_ITEMS' }));
      await expect(h.payBatch.execute({ ids: Array(100).fill(id(1)) })).resolves.toBeDefined();
    });

    it('400 vence 404: id mal formado junto de inexistente', async () => {
      const h = buildHarness(LATER);
      const error = await rejected(h.payBatch.execute({ ids: [id(9), 'abc'] }));
      expect(error.code).toBe('VALIDATION_ERROR');
    });
  });
});
