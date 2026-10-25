import { buildHarness } from '@test/support/finance-harness.js';
import { NOW, cardExpense, entryId, entryUuid, income, newCard, pixExpense, rejected } from '@test/support/builders.js';

const LATER = new Date('2026-10-06T09:30:00.000Z');

describe('MarkEntryAsPaid', () => {
  it('CA24: PENDING no cartao -> PAID com paidAt do clock, view com card/invoice, evento EntryPaid', async () => {
    const h = buildHarness(LATER);
    const card = newCard(1, { name: 'Nubank' });
    h.cards.seed(card);
    h.entries.seed(cardExpense(1, card, {}, NOW));
    const view = await h.markEntryAsPaid.execute({ id: entryUuid(1) });
    expect(view).toMatchObject({ id: entryUuid(1), status: 'PAID', paidAt: LATER });
    expect(view.card).toEqual({ id: card.id.value, name: 'Nubank' });
    expect(view.invoice?.dueDate.toString()).toBe('2026-11-05');
    expect(h.entries.get(entryId(1))!.status).toBe('PAID');
    expect(h.publisher.names()).toEqual(['EntryPaid']);
  });

  it('CA24: PIX "Ainda nao paguei" tambem pode ser paga', async () => {
    const h = buildHarness(LATER);
    h.entries.seed(pixExpense(1, { paid: false }));
    const view = await h.markEntryAsPaid.execute({ id: entryUuid(1) });
    expect(view.status).toBe('PAID');
    expect(view.paidAt).toEqual(LATER);
  });

  it('CA25: idempotente - ja PAID (inclusive PIX nascida paga): sucesso, paidAt intacto, sem saveAll nem evento', async () => {
    const h = buildHarness(LATER);
    h.entries.seed(pixExpense(1)); // nasce paga em NOW
    const view = await h.markEntryAsPaid.execute({ id: entryUuid(1) });
    expect(view).toMatchObject({ status: 'PAID', paidAt: NOW });
    expect(h.entries.calls.saveAll).toBe(0);
    expect(h.publisher.published).toEqual([]);
  });

  it('executa dentro de uma transacao (UnitOfWork)', async () => {
    const h = buildHarness(LATER);
    h.entries.seed(pixExpense(1, { paid: false }));
    await h.markEntryAsPaid.execute({ id: entryUuid(1) });
    expect(h.uow.runs).toBe(1);
  });

  it('CA26: id inexistente -> 404 ENTRY_NOT_FOUND com details.id', async () => {
    const h = buildHarness(LATER);
    const error = await rejected(h.markEntryAsPaid.execute({ id: entryUuid(9) }));
    expect(error).toMatchObject({ code: 'ENTRY_NOT_FOUND', kind: 'not_found' });
    expect(error.details).toEqual({ id: entryUuid(9) });
  });

  it('id mal formado -> 400 (nao 404)', async () => {
    const h = buildHarness(LATER);
    const error = await rejected(h.markEntryAsPaid.execute({ id: 'abc' }));
    expect(error).toMatchObject({ code: 'VALIDATION_ERROR', kind: 'validation' });
  });

  it('CA27: receita -> 422 ENTRY_NOT_PAYABLE com incomeIds; nada salvo, nada publicado', async () => {
    const h = buildHarness(LATER);
    h.entries.seed(income(1));
    const error = await rejected(h.markEntryAsPaid.execute({ id: entryUuid(1) }));
    expect(error).toMatchObject({ code: 'ENTRY_NOT_PAYABLE', kind: 'business_rule' });
    expect(error.details).toEqual({ incomeIds: [entryUuid(1)] });
    expect(h.entries.get(entryId(1))!.status).toBe('RECEIVED');
    expect(h.entries.calls.saveAll).toBe(0);
    expect(h.publisher.published).toEqual([]);
  });

  it('nao publica evento se a gravacao falhar (rollback)', async () => {
    const h = buildHarness(LATER);
    h.entries.seed(pixExpense(1, { paid: false }));
    h.entries.failAfter = 0;
    await rejected(h.markEntryAsPaid.execute({ id: entryUuid(1) }));
    expect(h.entries.get(entryId(1))!.status).toBe('PENDING');
    expect(h.publisher.published).toEqual([]);
  });
});
