import {
  DEFAULT_OWNER,
  NOW,
  cardExpense,
  cardId,
  date,
  entryId,
  eventNames,
  income,
  newCard,
  pixExpense,
  pullEvents,
  rawEntry,
  thrown,
} from '@test/support/builders.js';
import { unwrap } from '@test/support/result.js';
import { calculateInvoiceDates } from '../billing/calculate-invoice-dates.js';
import { ClosingDay, DueDay } from '../billing/day-of-month.js';
import { ReferenceMonth } from '../billing/reference-month.js';
import { Entry } from './entry.js';
import { NewEntryInput } from './new-entry-input.js';

const LATER = new Date('2026-10-06T09:30:00.000Z');
const rm = (v: string) => unwrap<ReferenceMonth>(ReferenceMonth.parse(v));
const isInvariantViolation = (e: Error) => e.constructor.name === 'InvariantViolationError';

describe('Entry.create - despesa PIX (CA07, CA08, B8)', () => {
  it('CA07: sem paid nasce PAID com paidAt = createdAt = now, sem fatura, referencia do mes da data', () => {
    const entry = pixExpense(1);
    const snap = entry.toSnapshot();
    expect(entry.status).toBe('PAID');
    expect(snap.paidAt).toEqual(NOW);
    expect(snap.createdAt).toEqual(NOW);
    expect(snap.updatedAt).toEqual(NOW);
    expect(entry.invoiceDates).toBeNull();
    expect(entry.cardId).toBeNull();
    expect(entry.referenceMonth.toString()).toBe('2026-10');
    expect(entry.amount.toString()).toBe('1500.00');
    expect(entry.type).toBe('EXPENSE');
    expect(entry.isIncome()).toBe(false);
  });

  it('CA08: paid=false nasce PENDING sem paidAt', () => {
    const entry = pixExpense(1, { paid: false });
    expect(entry.status).toBe('PENDING');
    expect(entry.toSnapshot().paidAt).toBeNull();
  });

  it('CA08: paid=true equivale a omitido', () => {
    const entry = pixExpense(1, { paid: true });
    expect(entry.status).toBe('PAID');
    expect(entry.toSnapshot().paidAt).toEqual(NOW);
  });

  it('B8: PIX com data futura sem paid nasce PAID com paidAt = now; referencia do mes da data', () => {
    const entry = pixExpense(1, { date: '2027-03-20' });
    expect(entry.status).toBe('PAID');
    expect(entry.toSnapshot().paidAt).toEqual(NOW);
    expect(entry.referenceMonth.toString()).toBe('2027-03');
  });

  it('B8: PIX com data futura e paid=false nasce PENDING', () => {
    const entry = pixExpense(1, { date: '2027-03-20', paid: false });
    expect(entry.status).toBe('PENDING');
    expect(entry.toSnapshot().paidAt).toBeNull();
  });

  it('CA21 linha 21: PIX em 2026-10-31 tem referencia 2026-10', () => {
    expect(pixExpense(1, { date: '2026-10-31' }).referenceMonth.toString()).toBe('2026-10');
  });

  it('status inicial nao depende do relogio: now muito anterior a data continua PAID (B8)', () => {
    const entry = pixExpense(1, { date: '2030-01-01' }, new Date('2020-01-01T00:00:00.000Z'));
    expect(entry.status).toBe('PAID');
  });
});

describe('Entry.create - despesa no cartao (CA09, CA21, CA22)', () => {
  it('CA09: nasce PENDING sem paidAt, com datas da fatura e referencia do vencimento', () => {
    const card = newCard(1, { closingDay: 25, dueDay: 5 });
    const entry = cardExpense(1, card);
    expect(entry.status).toBe('PENDING');
    expect(entry.toSnapshot().paidAt).toBeNull();
    expect(entry.cardId?.value).toBe(card.id.value);
    expect(entry.invoiceDates?.closingDate.toString()).toBe('2026-10-25');
    expect(entry.invoiceDates?.dueDate.toString()).toBe('2026-11-05');
    expect(entry.referenceMonth.toString()).toBe('2026-11');
  });

  it('CA09: paid=false tambem nasce PENDING', () => {
    expect(cardExpense(1, newCard(1), { paid: false }).status).toBe('PENDING');
  });

  it.each([
    [1, 25, 5, '2026-10-10', '2026-10-25', '2026-11-05', '2026-11'],
    [3, 25, 5, '2026-10-26', '2026-11-25', '2026-12-05', '2026-12'],
    [7, 10, 10, '2026-10-05', '2026-10-10', '2026-11-10', '2026-11'],
    [18, 31, 30, '2026-02-28', '2026-02-28', '2026-03-30', '2026-03'],
    [20, 28, 30, '2026-01-29', '2026-02-28', '2026-03-30', '2026-03'],
  ])('CA21 linha #%i via create', (_n, c, v, purchase, expClosing, expDue, expRef) => {
    const entry = cardExpense(1, newCard(1, { closingDay: c, dueDay: v }), { date: purchase });
    expect(entry.invoiceDates?.closingDate.toString()).toBe(expClosing);
    expect(entry.invoiceDates?.dueDate.toString()).toBe(expDue);
    expect(entry.referenceMonth.toString()).toBe(expRef);
  });

  it('CA05: usa os dias do cartao vigentes no snapshot, nao os de depois', () => {
    const card = newCard(1, { closingDay: 10, dueDay: 17 });
    const before = cardExpense(1, card, { date: '2026-10-15' });
    card.update({ name: 'Cartao 1', closingDay: 20, dueDay: 25 }, LATER);
    const after = cardExpense(2, card, { date: '2026-10-15' });
    expect(before.referenceMonth.toString()).toBe('2026-11');
    expect(before.invoiceDates?.dueDate.toString()).toBe('2026-11-17');
    expect(after.referenceMonth.toString()).toBe('2026-10');
    expect(after.invoiceDates?.closingDate.toString()).toBe('2026-10-20');
    expect(after.invoiceDates?.dueDate.toString()).toBe('2026-10-25');
  });

  it('CARD sem snapshot de cartao -> InvariantViolationError (erro de programacao)', () => {
    const input = NewEntryInput.parse(rawEntry({ paymentMethod: 'CARD', cardId: newCard(1).id.value }));
    const error = thrown(() => Entry.create({ id: entryId(1), ownerId: DEFAULT_OWNER, input, card: null, now: NOW }));
    expect(isInvariantViolation(error)).toBe(true);
  });

  it('CARD com snapshot de OUTRO cartao -> InvariantViolationError', () => {
    const input = NewEntryInput.parse(rawEntry({ paymentMethod: 'CARD', cardId: newCard(1).id.value }));
    const error = thrown(() => Entry.create({ id: entryId(1), ownerId: DEFAULT_OWNER, input, card: newCard(2).billingInfo(), now: NOW }));
    expect(isInvariantViolation(error)).toBe(true);
  });

  it('PIX com snapshot de cartao -> InvariantViolationError', () => {
    const input = NewEntryInput.parse(rawEntry());
    const error = thrown(() => Entry.create({ id: entryId(1), ownerId: DEFAULT_OWNER, input, card: newCard(1).billingInfo(), now: NOW }));
    expect(isInvariantViolation(error)).toBe(true);
  });
});

describe('Entry.create - receita (CA10)', () => {
  it('nasce RECEIVED, PIX, sem cartao nem paidAt, referencia do mes da data', () => {
    const entry = income(1, { date: '2026-10-30' });
    expect(entry.status).toBe('RECEIVED');
    expect(entry.type).toBe('INCOME');
    expect(entry.isIncome()).toBe(true);
    expect(entry.cardId).toBeNull();
    expect(entry.invoiceDates).toBeNull();
    expect(entry.toSnapshot().paidAt).toBeNull();
    expect(entry.toSnapshot().paymentMethod).toBe('PIX');
    expect(entry.referenceMonth.toString()).toBe('2026-10');
  });

  it('data futura nao muda nada (B7)', () => {
    const entry = income(1, { date: '2030-12-31' }, NOW);
    expect(entry.status).toBe('RECEIVED');
    expect(entry.referenceMonth.toString()).toBe('2030-12');
  });
});

describe('Entry - eventos', () => {
  it('create emite so EntryCreated (PIX pago nao emite EntryPaid)', () => {
    const entry = pixExpense(1);
    const events = pullEvents(entry);
    expect(eventNames(events)).toEqual(['EntryCreated']);
    expect(events[0]).toMatchObject({ status: 'PAID', paidAt: NOW });
  });

  it('EntryCreated de cartao leva status PENDING e paidAt nulo', () => {
    const events = pullEvents(cardExpense(1, newCard(1)));
    expect(events[0]).toMatchObject({ status: 'PENDING', paidAt: null });
  });

  it('pullEvents esvazia a fila', () => {
    const entry = pixExpense(1);
    pullEvents(entry);
    expect(pullEvents(entry)).toEqual([]);
  });

  it('markAsPaid com transicao emite EntryPaid', () => {
    const entry = pixExpense(1, { paid: false });
    pullEvents(entry);
    entry.markAsPaid(LATER);
    const events = pullEvents(entry);
    expect(eventNames(events)).toEqual(['EntryPaid']);
    expect(events[0]).toMatchObject({ paidAt: LATER });
  });
});

describe('Entry.markAsPaid (CA24, CA25, CA27, CA28)', () => {
  it('CA24: PENDING -> PAID registrando paidAt e updatedAt; retorna true', () => {
    const entry = cardExpense(1, newCard(1));
    expect(entry.markAsPaid(LATER)).toBe(true);
    expect(entry.status).toBe('PAID');
    expect(entry.toSnapshot().paidAt).toEqual(LATER);
    expect(entry.toSnapshot().updatedAt).toEqual(LATER);
    expect(entry.toSnapshot().createdAt).toEqual(NOW);
  });

  describe('Entry.updateExpense', () => {
    const changes = (over: Partial<Parameters<typeof rawEntry>[0]> = {}) =>
      NewEntryInput.parse(rawEntry({ date: '2026-10-10', ...over, paymentMethod: 'PIX', cardId: null, paid: undefined }));

    it('atualiza campos permitidos de PIX, preservando status e paidAt e recalculando o mês', () => {
      const entry = pixExpense(1, { paid: false, date: '2026-10-10' });
      const original = entry.toSnapshot();
      entry.updateExpense(changes({ description: '  Feira  ', category: 'Mercado', date: '2026-11-02', amount: '45.90' }), null, LATER);
      const updated = entry.toSnapshot();

      expect(updated.description.value).toBe('Feira');
      expect(updated.category.value).toBe('Mercado');
      expect(updated.date.toString()).toBe('2026-11-02');
      expect(updated.amount.toString()).toBe('45.90');
      expect(updated.referenceMonth.toString()).toBe('2026-11');
      expect(updated.status).toBe(original.status);
      expect(updated.paidAt).toBe(original.paidAt);
      expect(updated.updatedAt).toEqual(LATER);
    });

    it('recalcula a fatura de cartão pendente somente quando a data muda', () => {
      const card = newCard(1, { closingDay: 25, dueDay: 5 });
      const entry = cardExpense(1, card, { date: '2026-10-10' });
      const originalInvoice = entry.invoiceDates;

      entry.updateExpense(changes({ description: 'Compra corrigida', category: 'Mercado', amount: '99.90' }), null, LATER);
      expect(entry.invoiceDates).toBe(originalInvoice);
      expect(entry.referenceMonth.toString()).toBe('2026-11');

      entry.updateExpense(changes({ date: '2026-10-26' }), card.billingInfo(), LATER);
      expect(entry.invoiceDates?.closingDate.toString()).toBe('2026-11-25');
      expect(entry.invoiceDates?.dueDate.toString()).toBe('2026-12-05');
      expect(entry.referenceMonth.toString()).toBe('2026-12');
    });

    it('não permite alterar a data de cartão já pago, mas mantém os demais campos editáveis', () => {
      const card = newCard(1);
      const entry = cardExpense(1, card);
      entry.markAsPaid(LATER);
      const paidAt = entry.toSnapshot().paidAt;

      const error = thrown(() => entry.updateExpense(changes({ date: '2026-10-26' }), card.billingInfo(), LATER));
      expect(error).toMatchObject({ code: 'PAID_CARD_EXPENSE_DATE_LOCKED', kind: 'business_rule' });

      entry.updateExpense(changes({ description: 'Descrição corrigida', amount: '20.00' }), null, LATER);
      expect(entry.status).toBe('PAID');
      expect(entry.toSnapshot().paidAt).toEqual(paidAt);
      expect(entry.toSnapshot().description.value).toBe('Descrição corrigida');
    });
  });

  it('CA25: ja PAID e no-op (false), sem mudar paidAt/updatedAt nem emitir evento', () => {
    const entry = cardExpense(1, newCard(1));
    entry.markAsPaid(LATER);
    pullEvents(entry);
    const before = entry.toSnapshot();
    expect(entry.markAsPaid(new Date('2026-12-01T00:00:00.000Z'))).toBe(false);
    expect(entry.toSnapshot().paidAt).toEqual(before.paidAt);
    expect(entry.toSnapshot().updatedAt).toEqual(before.updatedAt);
    expect(pullEvents(entry)).toEqual([]);
  });

  it('CA25: PIX que nasceu pago tambem e no-op', () => {
    const entry = pixExpense(1);
    pullEvents(entry);
    expect(entry.markAsPaid(LATER)).toBe(false);
    expect(entry.toSnapshot().paidAt).toEqual(NOW);
    expect(pullEvents(entry)).toEqual([]);
  });

  it('CA27: receita lanca IncomeNotPayableError (422) com o id e mantem o estado', () => {
    const entry = income(7);
    const before = entry.toSnapshot();
    const error = thrown(() => entry.markAsPaid(LATER));
    expect(error.code).toBe('ENTRY_NOT_PAYABLE');
    expect(error.kind).toBe('business_rule');
    expect(error.details).toEqual({ incomeIds: [entry.id.value] });
    expect(entry.status).toBe('RECEIVED');
    expect(entry.toSnapshot()).toEqual(before);
  });

  it('CA28: edição não cria operação para desfazer pagamento ou reverter status', () => {
    const names = Object.getOwnPropertyNames(Entry.prototype).filter((n) => n !== 'constructor');
    const forbidden = /(unpay|revert|reopen|undo|refund|cancel|setstatus|markaspending|settle.*back)/i;
    expect(names.filter((n) => forbidden.test(n))).toEqual([]);
    expect(names).toEqual(expect.arrayContaining(['markAsPaid', 'updateExpense', 'toSnapshot', 'isIncome']));
  });
});

describe('Entry.restore', () => {
  const pix = () => pixExpense(1, { paid: false }).toSnapshot();
  const card = newCard(1);
  const cardSnap = () => cardExpense(1, card).toSnapshot();
  const restoreFails = (snapshot: unknown) => {
    const error = thrown(() => Entry.restore(snapshot as never));
    expect(isInvariantViolation(error)).toBe(true);
  };

  it('faz round trip dos snapshots validos, sem emitir eventos', () => {
    for (const snap of [pix(), cardSnap(), pixExpense(2).toSnapshot(), income(3).toSnapshot()]) {
      const restored = Entry.restore(snap);
      expect(restored.toSnapshot()).toEqual(snap);
      expect(pullEvents(restored)).toEqual([]);
    }
  });

  it('nao recalcula: aceita datas gravadas distintas das que o cartao produziria hoje (DR2)', () => {
    const snap = cardSnap();
    const dates = snap.invoiceDates!;
    const entry = Entry.restore(snap);
    expect(entry.invoiceDates?.dueDate.toString()).toBe(dates.dueDate.toString());
    expect(entry.referenceMonth.toString()).toBe('2026-11');
  });

  it.each([
    ['receita PAID', () => ({ ...income(1).toSnapshot(), status: 'PAID', paidAt: NOW })],
    ['receita PENDING', () => ({ ...income(1).toSnapshot(), status: 'PENDING' })],
    ['receita com paidAt', () => ({ ...income(1).toSnapshot(), paidAt: NOW })],
    ['receita no cartao', () => ({ ...income(1).toSnapshot(), paymentMethod: 'CARD', cardId: cardId(1) })],
    ['despesa RECEIVED', () => ({ ...pix(), status: 'RECEIVED' })],
    ['CARD sem invoiceDates', () => ({ ...cardSnap(), invoiceDates: null })],
    ['CARD sem cardId', () => ({ ...cardSnap(), cardId: null })],
    [
      'PIX com invoiceDates',
      () => ({
        ...pix(),
        invoiceDates: calculateInvoiceDates(
          date('2026-10-05'),
          unwrap<ClosingDay>(ClosingDay.create(25)),
          unwrap<DueDay>(DueDay.create(5)),
        ),
      }),
    ],
    ['PIX com cardId', () => ({ ...pix(), cardId: cardId(1) })],
    ['referencia CARD diferente do mes do vencimento', () => ({ ...cardSnap(), referenceMonth: rm('2026-10') })],
    ['referencia PIX diferente do mes da data', () => ({ ...pix(), referenceMonth: rm('2026-11') })],
    ['PAID sem paidAt', () => ({ ...pixExpense(1).toSnapshot(), paidAt: null })],
    ['PENDING com paidAt', () => ({ ...pix(), paidAt: NOW })],
    ['paidAt anterior a createdAt', () => ({ ...pixExpense(1).toSnapshot(), paidAt: new Date(NOW.getTime() - 1) })],
    ['updatedAt anterior a createdAt', () => ({ ...pix(), updatedAt: new Date(NOW.getTime() - 1) })],
  ])('rejeita snapshot inconsistente: %s', (_label, build) => {
    restoreFails(build());
  });
});
