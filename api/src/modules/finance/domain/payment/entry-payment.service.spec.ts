import { NOW, cardExpense, income, newCard, pixExpense, pullEvents, eventNames, thrown } from '@test/support/builders.js';
import { EntryPaymentService } from './entry-payment.service.js';

const LATER = new Date('2026-10-06T09:30:00.000Z');
const service = new EntryPaymentService();
const ids = (entries: { id: { value: string } }[]) => entries.map((e) => e.id.value);

describe('EntryPaymentService.payAll', () => {
  it('CA29: paga todas as pendentes com o mesmo paidAt', () => {
    const card = newCard(1);
    const a = cardExpense(1, card, { amount: '100.00' });
    const b = pixExpense(2, { amount: '50.25', paid: false });
    const outcome = service.payAll([a, b], LATER);
    expect(ids(outcome.paid)).toEqual(ids([a, b]));
    expect(outcome.alreadyPaid).toEqual([]);
    expect(a.toSnapshot().paidAt).toEqual(LATER);
    expect(b.toSnapshot().paidAt).toEqual(LATER);
  });

  it('CA30: mistas - a paga, b (ja paga) fica intacta e vai para alreadyPaid', () => {
    const a = pixExpense(1, { paid: false });
    const b = pixExpense(2); // nasce paga em NOW
    const outcome = service.payAll([a, b], LATER);
    expect(ids(outcome.paid)).toEqual(ids([a]));
    expect(ids(outcome.alreadyPaid)).toEqual(ids([b]));
    expect(b.toSnapshot().paidAt).toEqual(NOW);
    expect(a.status).toBe('PAID');
  });

  it('lote so de pagas: nada muda', () => {
    const a = pixExpense(1);
    const b = pixExpense(2);
    const outcome = service.payAll([a, b], LATER);
    expect(outcome.paid).toEqual([]);
    expect(ids(outcome.alreadyPaid)).toEqual(ids([a, b]));
  });

  it('lista vazia devolve resultado vazio', () => {
    expect(service.payAll([], LATER)).toEqual({ paid: [], alreadyPaid: [] });
  });

  it('emite EntryPaid so para quem mudou', () => {
    const a = pixExpense(1, { paid: false });
    const b = pixExpense(2);
    pullEvents(a);
    pullEvents(b);
    service.payAll([a, b], LATER);
    expect(eventNames(pullEvents(a))).toEqual(['EntryPaid']);
    expect(pullEvents(b)).toEqual([]);
  });

  it('CA32: com receitas lanca IncomesNotPayableError listando TODAS e nao altera nenhuma despesa', () => {
    const a = pixExpense(1, { paid: false });
    const r1 = income(2);
    const r2 = income(3);
    const error = thrown(() => service.payAll([a, r1, r2], LATER));
    expect(error.code).toBe('ENTRIES_NOT_PAYABLE');
    expect(error.kind).toBe('business_rule');
    expect(error.details.incomeIds).toEqual(ids([r1, r2]));
    expect(a.status).toBe('PENDING');
    expect(a.toSnapshot().paidAt).toBeNull();
    expect(eventNames(pullEvents(a))).not.toContain('EntryPaid');
  });

  it('P07: receita + despesa ja paga ainda e 422', () => {
    const error = thrown(() => service.payAll([pixExpense(1), income(2)], LATER));
    expect(error.code).toBe('ENTRIES_NOT_PAYABLE');
  });
});
