import type pg from 'pg';
import { buildInfra, type Infra } from '@test/support/infra.js';
import {
  cardEntry,
  cardUuid,
  createPool,
  entryUuid,
  expectCheckViolation,
  insertCard,
  insertEntry,
  query,
  resetDb,
} from '@test/support/default-owner-db.js';
import { FixedClock } from '@test/fakes/simple-fakes.js';
import { DEFAULT_OWNER, cardExpense, cardId, entryId, newCard, pixExpense, income, rawEntry, rejected } from '@test/support/builders.js';
import type { FinanceUnitOfWork } from '@finance/application/ports/finance-unit-of-work.js';
import { unwrap } from '@test/support/result.js';
import { ReferenceMonth } from '@finance/domain/billing/reference-month.js';
import { InvoiceKey } from '@finance/domain/billing/invoice-key.js';

let pool: pg.Pool;
let infra: Infra;
beforeAll(async () => {
  pool = createPool();
  infra = await buildInfra();
});
afterAll(async () => {
  await infra.close();
  await pool.end();
});
beforeEach(async () => {
  await resetDb(pool);
  infra.publisher.published.length = 0;
});

const statuses = async () =>
  Object.fromEntries(
    (await query<{ id: string; status: string; paid_at: Date | null }>(pool, 'SELECT id, status, paid_at FROM entries ORDER BY id')).map((r) => [
      r.id,
      [r.status, r.paid_at?.toISOString() ?? null],
    ]),
  );

describe('PrismaEntryRepository - round trip (CA23: sem deslocamento em America/Sao_Paulo)', () => {
  it('despesa no cartao: todos os campos, inclusive datas da fatura e centavos', async () => {
    const card = newCard(1, { closingDay: 25, dueDay: 5 });
    await infra.cards.insert(card);
    const entry = cardExpense(1, card, { date: '2026-10-31', amount: '1234567.89', category: 'Alimentação' });
    await infra.entries.insert(entry);

    const [row] = await query<Record<string, string>>(
      pool,
      `SELECT "date"::text AS date, closing_date::text AS closing, due_date::text AS due, reference_month::text AS ref,
              amount::text AS amount, status, payment_method, category_key FROM entries`,
    );
    expect(row).toMatchObject({
      date: '2026-10-31',
      closing: '2026-11-25',
      due: '2026-12-05',
      ref: '2026-12-01',
      amount: '1234567.89',
      status: 'PENDING',
      payment_method: 'CARD',
      category_key: 'alimentação',
    });

    const [loaded] = await infra.uow.run((scope) => scope.entries.findByIdsForUpdate(DEFAULT_OWNER, [entryId(1)]));
    expect(loaded.toSnapshot()).toEqual(entry.toSnapshot());
  });

  it('despesa PIX paga: paidAt = createdAt, sem datas de fatura; receita sem paidAt', async () => {
    await infra.entries.insert(pixExpense(1, { date: '2026-03-01' }));
    await infra.entries.insert(income(2, { date: '2026-12-31' }));
    const loaded = await infra.uow.run((scope) => scope.entries.findByIdsForUpdate(DEFAULT_OWNER, [entryId(1), entryId(2)]));
    expect(loaded.map((e) => e.toSnapshot())).toEqual([pixExpense(1, { date: '2026-03-01' }).toSnapshot(), income(2, { date: '2026-12-31' }).toSnapshot()]);
    const rows = await query<Record<string, string | null>>(pool, `SELECT "date"::text AS d, reference_month::text AS r, closing_date FROM entries ORDER BY id`);
    expect(rows[0]).toMatchObject({ d: '2026-03-01', r: '2026-03-01', closing_date: null });
    expect(rows[1]).toMatchObject({ d: '2026-12-31', r: '2026-12-01' });
  });

  it('findByIdsForUpdate: ids inexistentes nao aparecem; ordem por id asc', async () => {
    await infra.entries.insert(pixExpense(3));
    await infra.entries.insert(pixExpense(1));
    const found = await infra.uow.run((scope) => scope.entries.findByIdsForUpdate(DEFAULT_OWNER, [entryId(3), entryId(9), entryId(1)]));
    expect(found.map((e) => e.id.value)).toEqual([entryUuid(1), entryUuid(3)]);
  });

  it('saveAll persiste status, paidAt e updatedAt de despesas', async () => {
    await infra.entries.insert(pixExpense(1, { paid: false }));
    const later = new Date('2026-10-06T09:30:00.000Z');
    await infra.uow.run(async (scope) => {
      const [e] = await scope.entries.findByIdsForUpdate(DEFAULT_OWNER, [entryId(1)]);
      e.markAsPaid(later);
      await scope.entries.saveAll([e]);
    });
    const [row] = await query<{ status: string; paid_at: Date; updated_at: Date }>(pool, 'SELECT status, paid_at, updated_at FROM entries');
    expect(row.status).toBe('PAID');
    expect(row.paid_at.toISOString()).toBe(later.toISOString());
    expect(row.updated_at.toISOString()).toBe(later.toISOString());
  });

  it('saveAll com guarda status = PENDING: linha ja paga no banco -> erro (violacao do contrato de lock)', async () => {
    await insertEntry(pool, { n: 1, status: 'PAID' });
    const stale = pixExpense(1, { paid: false }); // em memoria ainda PENDING
    stale.markAsPaid(new Date('2026-10-06T09:30:00.000Z'));
    await expect(infra.uow.run((scope) => scope.entries.saveAll([stale]))).rejects.toThrow();
  });

  it('FK: despesa no cartao de cartao inexistente e rejeitada pelo banco', async () => {
    const ghost = newCard(77);
    await expect(infra.entries.insert(cardExpense(1, ghost))).rejects.toMatchObject({});
    expect(await query(pool, 'SELECT 1 FROM entries')).toHaveLength(0);
  });
});

describe('CA21 - as 22 linhas da tabela, via CreateEntry real, passam em todos os CHECKs', () => {
  const rows: [number, 'CARD' | 'PIX' | 'INCOME', number, number, string, string | null, string | null, string][] = [
    [1, 'CARD', 25, 5, '2026-10-10', '2026-10-25', '2026-11-05', '2026-11-01'],
    [2, 'CARD', 25, 5, '2026-10-25', '2026-10-25', '2026-11-05', '2026-11-01'],
    [3, 'CARD', 25, 5, '2026-10-26', '2026-11-25', '2026-12-05', '2026-12-01'],
    [4, 'CARD', 3, 10, '2026-10-02', '2026-10-03', '2026-10-10', '2026-10-01'],
    [5, 'CARD', 3, 10, '2026-10-04', '2026-11-03', '2026-11-10', '2026-11-01'],
    [6, 'CARD', 5, 15, '2026-10-05', '2026-10-05', '2026-10-15', '2026-10-01'],
    [7, 'CARD', 10, 10, '2026-10-05', '2026-10-10', '2026-11-10', '2026-11-01'],
    [8, 'CARD', 25, 5, '2026-12-10', '2026-12-25', '2027-01-05', '2027-01-01'],
    [9, 'CARD', 25, 5, '2026-12-26', '2027-01-25', '2027-02-05', '2027-02-01'],
    [10, 'CARD', 3, 10, '2026-12-15', '2027-01-03', '2027-01-10', '2027-01-01'],
    [11, 'CARD', 31, 10, '2026-02-15', '2026-02-28', '2026-03-10', '2026-03-01'],
    [12, 'CARD', 31, 10, '2026-02-28', '2026-02-28', '2026-03-10', '2026-03-01'],
    [13, 'CARD', 31, 10, '2026-01-31', '2026-01-31', '2026-02-10', '2026-02-01'],
    [14, 'CARD', 30, 5, '2026-01-31', '2026-02-28', '2026-03-05', '2026-03-01'],
    [15, 'CARD', 30, 7, '2028-02-29', '2028-02-29', '2028-03-07', '2028-03-01'],
    [16, 'CARD', 29, 7, '2027-02-28', '2027-02-28', '2027-03-07', '2027-03-01'],
    [17, 'CARD', 20, 31, '2026-02-10', '2026-02-20', '2026-02-28', '2026-02-01'],
    [18, 'CARD', 31, 30, '2026-02-28', '2026-02-28', '2026-03-30', '2026-03-01'],
    [19, 'CARD', 31, 31, '2026-04-30', '2026-04-30', '2026-05-31', '2026-05-01'],
    [20, 'CARD', 28, 30, '2026-01-29', '2026-02-28', '2026-03-30', '2026-03-01'],
    [21, 'PIX', 0, 0, '2026-10-31', null, null, '2026-10-01'],
    [22, 'INCOME', 0, 0, '2026-12-31', null, null, '2026-12-01'],
  ];

  it.each(rows)('linha #%i (%s fecha %i vence %i, compra %s)', async (n, kind, closing, due, purchase, expClosing, expDue, expRef) => {
    let cardIdValue: string | null = null;
    if (kind === 'CARD') {
      cardIdValue = (await infra.useCases.createCard.execute({ name: `Cartao ${n}`, closingDay: closing, dueDay: due })).id;
    }
    const view = await infra.useCases.createEntry.execute(
      rawEntry({
        type: kind === 'INCOME' ? 'INCOME' : 'EXPENSE',
        paymentMethod: kind === 'CARD' ? 'CARD' : 'PIX',
        cardId: cardIdValue,
        date: purchase,
      }),
    );
    const [row] = await query<Record<string, string | null>>(
      pool,
      `SELECT closing_date::text AS closing, due_date::text AS due, reference_month::text AS ref FROM entries WHERE id = $1::uuid`,
      [view.id],
    );
    expect(row).toEqual({ closing: expClosing, due: expDue, ref: expRef });
  });
});

describe('CHECKs de entries (7.4): cada regra rejeita a linha invalida', () => {
  const card = 1;
  beforeEach(async () => {
    await insertCard(pool, { n: card });
  });
  const cardRow = (over: Record<string, unknown> = {}) =>
    cardEntry(1, card, { date: '2026-10-10', closing: '2026-10-25', due: '2026-11-05', ...over });

  it('controles: despesa PIX paga, despesa no cartao pendente e receita validas entram', async () => {
    await expect(insertEntry(pool, { n: 1 })).resolves.toBeDefined();
    await expect(insertEntry(pool, cardRow({ n: 2 }))).resolves.toBeDefined();
    await expect(insertEntry(pool, { n: 3, type: 'INCOME' })).resolves.toBeDefined();
  });

  it.each<[string, object]>([
    ['receita PAID', { n: 1, type: 'INCOME', status: 'PAID' }],
    ['receita PENDING', { n: 1, type: 'INCOME', status: 'PENDING', paidAt: null }],
    ['despesa RECEIVED', { n: 1, status: 'RECEIVED', paidAt: null }],
    ['receita no cartao', { n: 1, type: 'INCOME', paymentMethod: 'CARD', cardN: 1, closingDate: '2026-10-25', dueDate: '2026-11-05', referenceMonth: '2026-11-01' }],
    ['CARD sem card_id', { n: 1, paymentMethod: 'CARD', status: 'PENDING', paidAt: null, closingDate: '2026-10-25', dueDate: '2026-11-05', referenceMonth: '2026-11-01' }],
    ['CARD sem due_date', { n: 1, paymentMethod: 'CARD', cardN: 1, status: 'PENDING', paidAt: null, closingDate: '2026-10-25', dueDate: null, referenceMonth: '2026-10-01' }],
    ['CARD sem closing_date', { n: 1, paymentMethod: 'CARD', cardN: 1, status: 'PENDING', paidAt: null, closingDate: null, dueDate: '2026-11-05', referenceMonth: '2026-11-01' }],
    ['PIX com closing_date', { n: 1, closingDate: '2026-10-25' }],
    ['PIX com due_date', { n: 1, dueDate: '2026-11-05' }],
    ['PIX com card_id', { n: 1, cardN: 1 }],
    ['closing_date < date', cardRow({ n: 1, closing: '2026-10-09' })],
    ['closing_date dois meses depois', cardRow({ n: 1, closing: '2026-12-01', due: '2026-12-10', referenceMonth: '2026-12-01' })],
    ['due_date = closing_date', cardRow({ n: 1, due: '2026-10-25', referenceMonth: '2026-10-01' })],
    ['due_date < closing_date', cardRow({ n: 1, due: '2026-10-24', referenceMonth: '2026-10-01' })],
    ['due_date dois meses apos o fechamento', cardRow({ n: 1, due: '2026-12-05', referenceMonth: '2026-12-01' })],
    ['reference_month dia 15', { n: 1, referenceMonth: '2026-10-15' }],
    ['referencia CARD != mes do vencimento', cardRow({ n: 1, referenceMonth: '2026-10-01' })],
    ['referencia PIX != mes da data', { n: 1, referenceMonth: '2026-11-01' }],
    ['PAID sem paid_at', { n: 1, status: 'PAID', paidAt: null }],
    ['PENDING com paid_at', { n: 1, status: 'PENDING', paidAt: '2026-10-05T13:00:00.000Z' }],
    ['paid_at < created_at', { n: 1, paidAt: '2026-10-05T12:59:59.000Z' }],
    ['updated_at < created_at', { n: 1, updatedAt: '2026-10-05T12:00:00.000Z' }],
    ['amount zero', { n: 1, amount: '0.00' }],
    ['amount negativo', { n: 1, amount: '-1.00' }],
  ])('%s', async (_label, row) => {
    await expectCheckViolation(insertEntry(pool, row as never));
  });

  it('FK: card_id inexistente (violacao 23503)', async () => {
    await expect(insertEntry(pool, cardRow({ n: 1, cardN: 99 }))).rejects.toMatchObject({ code: '23503' });
  });

  it('FK Restrict: nao e possivel excluir cartao com lancamentos', async () => {
    await insertEntry(pool, cardRow({ n: 1 }));
    await expect(pool.query('DELETE FROM cards WHERE id = $1::uuid', [cardUuid(card)])).rejects.toMatchObject({ code: '23503' });
  });

  it('Decimal(12,2): 9999999999.99 cabe; precisao e exata', async () => {
    await insertEntry(pool, { n: 1, amount: '9999999999.99' });
    const [r] = await query<{ amount: string }>(pool, 'SELECT amount::text FROM entries');
    expect(r.amount).toBe('9999999999.99');
  });
});

describe('findPendingByInvoiceForUpdate (CA38, CA39)', () => {
  const key = (cardN: number, month: string) =>
    ({ cardId: cardId(cardN), referenceMonth: unwrap<ReferenceMonth>(ReferenceMonth.parse(month)) }) as unknown as InvoiceKey;
  const pendingIds = (cardN: number, month: string) =>
    infra.uow.run(async (scope) => (await scope.entries.findPendingByInvoiceForUpdate(DEFAULT_OWNER, key(cardN, month))).map((e) => e.id.value));

  beforeEach(async () => {
    await insertCard(pool, { n: 1 });
    await insertCard(pool, { n: 2 });
  });

  it('CA38: so PENDING do cartao no mes de referencia, ordenadas por id', async () => {
    const nov = { closing: '2026-10-25', due: '2026-11-05', date: '2026-10-10' };
    await insertEntry(pool, cardEntry(2, 1, { ...nov })); // E2 pendente
    await insertEntry(pool, cardEntry(1, 1, { ...nov })); // E1 pendente
    await insertEntry(pool, cardEntry(3, 1, { ...nov, status: 'PAID' })); // E3 paga
    await insertEntry(pool, cardEntry(4, 1, { date: '2026-11-10', closing: '2026-11-25', due: '2026-12-05' })); // E4 mes 12
    await insertEntry(pool, cardEntry(5, 2, { ...nov })); // E5 outro cartao
    await insertEntry(pool, { n: 6, status: 'PENDING', paidAt: null, date: '2026-11-20' }); // E6 PIX 2026-11
    expect(await pendingIds(1, '2026-11')).toEqual([entryUuid(1), entryUuid(2)]);
  });

  it('CA39: usa o mes do vencimento, nao o da compra nem o do fechamento', async () => {
    await insertEntry(pool, cardEntry(1, 1, { date: '2026-10-10', closing: '2026-10-25', due: '2026-11-05' }));
    expect(await pendingIds(1, '2026-10')).toEqual([]);
    expect(await pendingIds(1, '2026-11')).toEqual([entryUuid(1)]);
  });
});

describe('PrismaFinanceUnitOfWork com use cases reais - atomicidade', () => {
  /** Decorator: executa o UPDATE de verdade e DEPOIS lanca (CA34/CA42). */
  const failingUow = (real: FinanceUnitOfWork): FinanceUnitOfWork => ({
    run: (work) =>
      real.run((scope) => {
        const entries = Object.create(scope.entries);
        entries.saveAll = async (list: never) => {
          await scope.entries.saveAll(list);
          throw new Error('falha simulada apos o UPDATE');
        };
        return work({ ...scope, entries });
      }),
  });

  it('CA34: falha depois do UPDATE em lote -> rollback, banco inalterado, nada publicado', async () => {
    for (const n of [1, 2, 3]) await insertEntry(pool, { n, status: 'PENDING', paidAt: null });
    const before = await statuses();
    const useCase = infra.useCases.payBatch(infra.clock, failingUow(infra.uow));
    await expect(useCase.execute({ ids: [entryUuid(1), entryUuid(2), entryUuid(3)] })).rejects.toThrow('falha simulada');
    expect(await statuses()).toEqual(before);
    expect(infra.publisher.published).toEqual([]);
  });

  it('CA42: falha em "Pagar fatura" com 3 pendentes -> nenhuma alterada', async () => {
    await insertCard(pool, { n: 1 });
    for (const n of [1, 2, 3]) await insertEntry(pool, cardEntry(n, 1, { date: '2026-10-10', closing: '2026-10-25', due: '2026-11-05' }));
    const before = await statuses();
    const useCase = infra.useCases.payInvoice(infra.clock, failingUow(infra.uow));
    await expect(useCase.execute({ cardId: cardUuid(1), referenceMonth: '2026-11' })).rejects.toThrow('falha simulada');
    expect(await statuses()).toEqual(before);
    expect(infra.publisher.published).toEqual([]);
  });

  it('CA31: lote com ids inexistentes -> 404 e banco inalterado', async () => {
    await insertEntry(pool, { n: 1, status: 'PENDING', paidAt: null });
    const before = await statuses();
    const error = await rejected(infra.useCases.payBatch().execute({ ids: [entryUuid(1), entryUuid(8), entryUuid(9)] }));
    expect(error).toMatchObject({ code: 'ENTRIES_NOT_FOUND' });
    expect(error.details.missingIds).toEqual([entryUuid(8), entryUuid(9)]);
    expect(await statuses()).toEqual(before);
  });

  it('CA32: receita no lote -> 422 e banco inalterado', async () => {
    await insertEntry(pool, { n: 1, status: 'PENDING', paidAt: null });
    await insertEntry(pool, { n: 2, type: 'INCOME' });
    const before = await statuses();
    const error = await rejected(infra.useCases.payBatch().execute({ ids: [entryUuid(1), entryUuid(2)] }));
    expect(error).toMatchObject({ code: 'ENTRIES_NOT_PAYABLE' });
    expect(await statuses()).toEqual(before);
  });

  it('pagamento individual idempotente preserva o paidAt original', async () => {
    await insertEntry(pool, { n: 1, status: 'PENDING', paidAt: null });
    const first = new FixedClock(new Date('2026-10-06T10:00:00.000Z'));
    const second = new FixedClock(new Date('2026-10-07T10:00:00.000Z'));
    const a = await infra.useCases.markEntryAsPaid(first).execute({ id: entryUuid(1) });
    const b = await infra.useCases.markEntryAsPaid(second).execute({ id: entryUuid(1) });
    expect(a.paidAt).toEqual(new Date('2026-10-06T10:00:00.000Z'));
    expect(b.paidAt).toEqual(a.paidAt);
  });
});

describe('CA37 - concorrencia (lote x lote x fatura)', () => {
  const T = [new Date('2026-10-10T10:00:00.000Z'), new Date('2026-10-10T10:00:01.000Z'), new Date('2026-10-10T10:00:02.000Z')];

  it.each(Array.from({ length: 8 }, (_, i) => [i + 1]))('rodada %i: todas PAGO, um paidAt por despesa, conjuntos pagos disjuntos', async () => {
    await resetDb(pool);
    infra.publisher.published.length = 0;
    await insertCard(pool, { n: 1 });
    const ids = [1, 2, 3, 4, 5, 6].map(entryUuid);
    for (const n of [1, 2, 3, 4, 5, 6]) {
      await insertEntry(pool, cardEntry(n, 1, { date: '2026-10-10', closing: '2026-10-25', due: '2026-11-05', amount: `${n}0.${n}5` }));
    }
    const [ca, cb, cc] = T.map((t) => new FixedClock(t));
    const [a, b, c] = await Promise.all([
      infra.useCases.payBatch(ca).execute({ ids: ids.slice(0, 4) }),
      infra.useCases.payBatch(cb).execute({ ids: ids.slice(2, 6) }),
      infra.useCases.payInvoice(cc).execute({ cardId: cardUuid(1), referenceMonth: '2026-11' }),
    ]);

    // cada despesa foi paga por exatamente UMA operacao
    for (const id of ids) {
      const claimed = [a.paidIds, b.paidIds, c.paidIds].filter((list) => list.includes(id)).length;
      expect(claimed).toBe(1);
    }
    // o que cada lote pediu e partilhado entre pago agora e ja pago
    expect([...a.paidIds, ...a.alreadyPaidIds].sort()).toEqual(ids.slice(0, 4));
    expect([...b.paidIds, ...b.alreadyPaidIds].sort()).toEqual(ids.slice(2, 6));
    expect(c.paidCount).toBe(c.paidIds.length);

    // estado final: todas pagas, paidAt = relogio da operacao vencedora
    const rows = await query<{ id: string; status: string; paid_at: Date }>(pool, 'SELECT id, status, paid_at FROM entries ORDER BY id');
    expect(rows.every((r) => r.status === 'PAID')).toBe(true);
    const owner = (id: string) => (a.paidIds.includes(id) ? T[0] : b.paidIds.includes(id) ? T[1] : T[2]);
    for (const r of rows) expect(r.paid_at.toISOString()).toBe(owner(r.id).toISOString());

    // totais consistentes: soma paga = soma das despesas; um EntryPaid por despesa
    const [{ total }] = await query<{ total: string }>(pool, `SELECT SUM(amount)::text AS total FROM entries WHERE status = 'PAID'`);
    const [{ all }] = await query<{ all: string }>(pool, `SELECT SUM(amount)::text AS all FROM entries`);
    expect(total).toBe(all);
    expect(infra.publisher.names().filter((n) => n === 'EntryPaid')).toHaveLength(6);
    const invoiceAmount = c.paidAmount.toString();
    const expected = await query<{ s: string }>(pool, `SELECT COALESCE(SUM(amount),0)::numeric(20,2)::text AS s FROM entries WHERE id = ANY($1::uuid[])`, [c.paidIds]);
    expect(invoiceAmount).toBe(expected[0].s);
  });
});
