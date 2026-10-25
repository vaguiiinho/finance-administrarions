import { buildHarness } from '@test/support/finance-harness.js';
import { NOW, cardExpense, cardUuid, entryId, entryUuid, newCard, pixExpense, rejected } from '@test/support/builders.js';

const LATER = new Date('2026-10-06T09:30:00.000Z');

/** Cenario do CA38: cartao C (fecha 25, vence 5). Compra em 10/10 => ref 2026-11; em 10/11 => ref 2026-12. */
function scenario() {
  const h = buildHarness(LATER);
  const c = newCard(1, { name: 'C' });
  const other = newCard(2, { name: 'Outro' });
  h.cards.seed(c);
  h.cards.seed(other);
  h.entries.seed(cardExpense(1, c, { amount: '100.00', date: '2026-10-10' })); // E1 pendente 2026-11
  h.entries.seed(cardExpense(2, c, { amount: '50.00', date: '2026-10-10' })); // E2 pendente 2026-11
  const e3 = cardExpense(3, c, { amount: '30.00', date: '2026-10-10' });
  e3.markAsPaid(NOW);
  h.entries.seed(e3); // E3 ja paga
  h.entries.seed(cardExpense(4, c, { amount: '70.00', date: '2026-11-10' })); // E4 ref 2026-12
  h.entries.seed(cardExpense(5, other, { amount: '10.00', date: '2026-10-10' })); // E5 outro cartao
  h.entries.seed(pixExpense(6, { amount: '20.00', date: '2026-11-20', paid: false })); // E6 PIX 2026-11
  return { h, c };
}
const status = (h: ReturnType<typeof buildHarness>, n: number) => h.entries.get(entryId(n))!.status;

describe('PayInvoice', () => {
  it('CA38: paga so as PENDING do cartao no mes; 2 lancamentos e R$ 150,00; os demais ficam inalterados', async () => {
    const { h, c } = scenario();
    const result = await h.payInvoice.execute({ cardId: c.id.value, referenceMonth: '2026-11' });
    expect(result.cardId).toBe(c.id.value);
    expect(result.referenceMonth).toBe('2026-11');
    expect([...result.paidIds].sort()).toEqual([entryUuid(1), entryUuid(2)]);
    expect(result.paidCount).toBe(2);
    expect(result.paidAmount.toString()).toBe('150.00');
    expect(status(h, 1)).toBe('PAID');
    expect(status(h, 2)).toBe('PAID');
    expect(h.entries.get(entryId(3))!.toSnapshot().paidAt).toEqual(NOW); // E3 intacta
    expect(status(h, 4)).toBe('PENDING');
    expect(status(h, 5)).toBe('PENDING');
    expect(status(h, 6)).toBe('PENDING');
    expect(h.publisher.names()).toEqual(['EntryPaid', 'EntryPaid']);
  });

  it('paidAt unico e igual ao clock', async () => {
    const { h, c } = scenario();
    await h.payInvoice.execute({ cardId: c.id.value, referenceMonth: '2026-11' });
    expect(h.entries.get(entryId(1))!.toSnapshot().paidAt).toEqual(LATER);
    expect(h.entries.get(entryId(2))!.toSnapshot().paidAt).toEqual(LATER);
  });

  it('CA39: usa o mes do vencimento - pagar 2026-10 nao toca a compra de 10/10; pagar 2026-11 paga', async () => {
    const h = buildHarness(LATER);
    const c = newCard(1);
    h.cards.seed(c);
    h.entries.seed(cardExpense(1, c, { date: '2026-10-10' }));
    const october = await h.payInvoice.execute({ cardId: c.id.value, referenceMonth: '2026-10' });
    expect(october.paidCount).toBe(0);
    expect(status(h, 1)).toBe('PENDING');
    const november = await h.payInvoice.execute({ cardId: c.id.value, referenceMonth: '2026-11' });
    expect(november.paidCount).toBe(1);
    expect(status(h, 1)).toBe('PAID');
  });

  it('CA40: sem pendencias (vazia ou toda paga) -> sucesso, [], 0, "0.00"; nada muda nem publica', async () => {
    const { h, c } = scenario();
    const empty = await h.payInvoice.execute({ cardId: c.id.value, referenceMonth: '2027-05' });
    expect(empty.paidIds).toEqual([]);
    expect(empty.paidCount).toBe(0);
    expect(empty.paidAmount.toString()).toBe('0.00');
    await h.payInvoice.execute({ cardId: c.id.value, referenceMonth: '2026-11' });
    h.publisher.published.length = 0;
    const again = await h.payInvoice.execute({ cardId: c.id.value, referenceMonth: '2026-11' });
    expect(again.paidCount).toBe(0);
    expect(again.paidAmount.toString()).toBe('0.00');
    expect(h.publisher.published).toEqual([]);
  });

  it('CA41: cartao inexistente -> 404 CARD_NOT_FOUND', async () => {
    const { h } = scenario();
    const error = await rejected(h.payInvoice.execute({ cardId: cardUuid(99), referenceMonth: '2026-11' }));
    expect(error).toMatchObject({ code: 'CARD_NOT_FOUND', kind: 'not_found' });
    expect(status(h, 1)).toBe('PENDING');
  });

  it.each([['2026-13'], ['2026-1'], ['abc'], ['']])('CA41: mes %j -> 400, mesmo com cartao inexistente (400 > 404)', async (month) => {
    const { h } = scenario();
    const error = await rejected(h.payInvoice.execute({ cardId: cardUuid(99), referenceMonth: month }));
    expect(error).toMatchObject({ code: 'VALIDATION_ERROR', kind: 'validation' });
    expect(error.details.fields).toContainEqual(expect.objectContaining({ field: 'referenceMonth' }));
  });

  it('cardId mal formado -> 400', async () => {
    const { h } = scenario();
    const error = await rejected(h.payInvoice.execute({ cardId: 'abc', referenceMonth: '2026-11' }));
    expect(error.code).toBe('VALIDATION_ERROR');
    expect(error.details.fields).toContainEqual(expect.objectContaining({ field: 'cardId' }));
  });

  it('CA42: falha no meio da gravacao -> nenhuma das despesas e alterada e nada e publicado', async () => {
    const h = buildHarness(LATER);
    const c = newCard(1);
    h.cards.seed(c);
    for (const n of [1, 2, 3]) h.entries.seed(cardExpense(n, c, { date: '2026-10-10' }));
    h.entries.failAfter = 1;
    await expect(h.payInvoice.execute({ cardId: c.id.value, referenceMonth: '2026-11' })).rejects.toThrow();
    for (const n of [1, 2, 3]) expect(status(h, n)).toBe('PENDING');
    expect(h.publisher.published).toEqual([]);
  });

  it('seleciona e paga numa unica transacao', async () => {
    const { h, c } = scenario();
    await h.payInvoice.execute({ cardId: c.id.value, referenceMonth: '2026-11' });
    expect(h.uow.runs).toBe(1);
  });
});
