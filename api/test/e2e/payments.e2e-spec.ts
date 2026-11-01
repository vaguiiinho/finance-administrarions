import { type E2eApp } from '../support/e2e-app.js';
import { startFinanceE2e } from '../support/finance-e2e.js';
import { query } from '../support/db.js';
import { DEFAULT_OWNER_ID } from '../support/default-owner-db.js';

let e: E2eApp;
const T0 = new Date('2026-10-05T13:00:00.000Z');
const T1 = new Date('2026-10-06T09:30:00.000Z');
const T2 = new Date('2026-10-07T09:30:00.000Z');
const MISSING = '0192f1e2-0000-7000-8000-000000000999';
const MISSING_2 = '0192f1e2-0000-7000-8000-000000000998';

beforeAll(async () => {
  e = await startFinanceE2e(T0);
});
afterAll(() => e.close());
beforeEach(async () => {
  await e.reset();
  e.clock.set(T0);
});

const entry = (over: Record<string, unknown> = {}) => ({
  type: 'EXPENSE',
  description: 'Conta',
  category: 'Moradia',
  date: '2026-10-10',
  amount: '100.00',
  paymentMethod: 'PIX',
  paid: false,
  ...over,
});
const create = async (over: Record<string, unknown> = {}) => (await e.http().post('/api/entries').send(entry(over))).body as { id: string; status: string; paidAt: string | null };
const newCard = async (name = 'C', closingDay = 25, dueDay = 5) => (await e.http().post('/api/cards').send({ name, closingDay, dueDay })).body as { id: string };
const cardEntry = (cardId: string, over: Record<string, unknown> = {}) => create({ paymentMethod: 'CARD', cardId, paid: undefined, ...over });
const rowOf = async (id: string) => (await query<{ status: string; paid_at: Date | null }>(e.pool, 'SELECT status, paid_at FROM entries WHERE id = $1::uuid', [id]))[0];
const payBatch = (ids: unknown) => e.http().post('/api/entries/pay').send({ ids });
const makeAdmin = () => e.pool.query('UPDATE users SET role = $1::user_role WHERE id = $2::uuid', ['ADMIN', DEFAULT_OWNER_ID]);

describe('E4 POST /api/entries/:id/pay', () => {
  it('CA24: despesa no cartao PENDING -> 200 PAID com paidAt em UTC (relogio injetado)', async () => {
    const card = await newCard();
    const exp = await cardEntry(card.id);
    expect(exp.status).toBe('PENDING');
    e.clock.set(T1);
    const res = await e.http().post(`/api/entries/${exp.id}/pay`);
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ id: exp.id, status: 'PAID', paidAt: T1.toISOString(), card: { id: card.id, name: 'C' } });
  });

  it('CA24: PIX "Ainda nao paguei" tambem pode ser paga', async () => {
    const exp = await create();
    e.clock.set(T1);
    expect((await e.http().post(`/api/entries/${exp.id}/pay`)).body).toMatchObject({ status: 'PAID', paidAt: T1.toISOString() });
  });

  it('CA25: idempotente - segunda chamada devolve o mesmo paidAt', async () => {
    const exp = await create();
    e.clock.set(T1);
    const first = await e.http().post(`/api/entries/${exp.id}/pay`);
    e.clock.set(T2);
    const second = await e.http().post(`/api/entries/${exp.id}/pay`);
    expect(second.status).toBe(200);
    expect(second.body.paidAt).toBe(first.body.paidAt);
    expect(second.body.paidAt).toBe(T1.toISOString());
  });

  it('CA25: PIX que nasceu paga -> sucesso e paidAt original', async () => {
    const exp = await create({ paid: undefined });
    expect(exp.status).toBe('PAID');
    e.clock.set(T2);
    const res = await e.http().post(`/api/entries/${exp.id}/pay`);
    expect(res.status).toBe(200);
    expect(res.body.paidAt).toBe(T0.toISOString());
  });

  it('CA26: id inexistente -> 404 ENTRY_NOT_FOUND no formato { code, message, details }', async () => {
    const res = await e.http().post(`/api/entries/${MISSING}/pay`);
    expect(res.status).toBe(404);
    expect(res.body).toEqual({ code: 'ENTRY_NOT_FOUND', message: expect.any(String), details: { id: MISSING } });
  });

  it('id mal formado -> 400', async () => {
    const res = await e.http().post('/api/entries/abc/pay');
    expect(res.status).toBe(400);
    expect(res.body.code).toBe('VALIDATION_ERROR');
  });

  it('CA27: receita -> 422 ENTRY_NOT_PAYABLE com incomeIds; permanece RECEIVED', async () => {
    const income = await create({ type: 'INCOME', paid: undefined });
    const res = await e.http().post(`/api/entries/${income.id}/pay`);
    expect(res.status).toBe(422);
    expect(res.body).toEqual({ code: 'ENTRY_NOT_PAYABLE', message: expect.any(String), details: { incomeIds: [income.id] } });
    expect((await rowOf(income.id)).status).toBe('RECEIVED');
  });

  it('CA28: PATCH e DELETE continuam indisponiveis e PUT exige ADMIN', async () => {
    const exp = await create({ paid: undefined });
    for (const method of ['patch', 'delete'] as const) {
      const res = await e.http()[method](`/api/entries/${exp.id}`);
      expect(res.status).toBe(404);
      expect(res.body.code).toBe('ROUTE_NOT_FOUND');
    }
    expect((await e.http().post(`/api/entries/${exp.id}/unpay`)).status).toBe(404);
    expect((await e.http().put(`/api/entries/${exp.id}`).send({})).status).toBe(403);
    expect((await rowOf(exp.id)).status).toBe('PAID');
  });
});

describe('PUT /api/entries/:id (admin)', () => {
  it('edita descrição, categoria, data e valor sem alterar status nem paidAt', async () => {
    const exp = await create({ paid: false });
    await makeAdmin();
    e.clock.set(T1);

    const res = await e.http().put(`/api/entries/${exp.id}`).send({
      description: 'Conta atualizada',
      category: 'Moradia',
      date: '2026-11-02',
      amount: '125.50',
    });

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({
      id: exp.id,
      description: 'Conta atualizada',
      category: 'Moradia',
      date: '2026-11-02',
      amount: '125.50',
      referenceMonth: '2026-11',
      status: 'PENDING',
      paidAt: null,
    });
    const row = await query<{ status: string; paid_at: Date | null; amount: string }>(
      e.pool,
      'SELECT status, paid_at, amount::text AS amount FROM entries WHERE id = $1::uuid',
      [exp.id],
    );
    expect(row[0]).toEqual({ status: 'PENDING', paid_at: null, amount: '125.50' });
  });

  it('recalcula a fatura ao mudar a data de compra no cartão pendente', async () => {
    const card = await newCard('Cartão', 25, 5);
    const exp = await cardEntry(card.id, { date: '2026-10-10' });
    await makeAdmin();

    const res = await e.http().put(`/api/entries/${exp.id}`).send({
      description: 'Compra corrigida',
      category: 'Mercado',
      date: '2026-10-26',
      amount: '80.00',
    });

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({
      date: '2026-10-26',
      invoice: { closingDate: '2026-11-25', dueDate: '2026-12-05' },
      referenceMonth: '2026-12',
      status: 'PENDING',
    });
  });

  it('bloqueia data de cartão paga, mas permite corrigir seus demais campos', async () => {
    const card = await newCard();
    const exp = await cardEntry(card.id);
    await e.http().post(`/api/entries/${exp.id}/pay`);
    await makeAdmin();
    const dateEdit = await e.http().put(`/api/entries/${exp.id}`).send({
      description: 'Conta',
      category: 'Moradia',
      date: '2026-10-26',
      amount: '100.00',
    });
    expect(dateEdit.status).toBe(422);
    expect(dateEdit.body.code).toBe('PAID_CARD_EXPENSE_DATE_LOCKED');

    const detailsEdit = await e.http().put(`/api/entries/${exp.id}`).send({
      description: 'Conta corrigida',
      category: 'Moradia',
      date: '2026-10-10',
      amount: '110.00',
    });
    expect(detailsEdit.status).toBe(200);
    expect(detailsEdit.body).toMatchObject({ status: 'PAID', description: 'Conta corrigida', amount: '110.00' });
  });

  it('corpo estrito, id inexistente e receita mantêm os erros do contrato', async () => {
    const exp = await create();
    const income = await create({ type: 'INCOME', paid: undefined });
    await makeAdmin();
    const body = { description: 'Conta', category: 'Moradia', date: '2026-10-10', amount: '100.00' };
    const unknownField = await e.http().put(`/api/entries/${exp.id}`).send({ ...body, status: 'PAID' });
    const missing = await e.http().put(`/api/entries/${MISSING}`).send(body);
    const notExpense = await e.http().put(`/api/entries/${income.id}`).send(body);
    expect(unknownField.status).toBe(400);
    expect(unknownField.body.details.fields).toContainEqual(expect.objectContaining({ field: 'status', code: 'UNKNOWN_FIELD' }));
    expect(missing.status).toBe(404);
    expect(missing.body.code).toBe('ENTRY_NOT_FOUND');
    expect(notExpense.status).toBe(422);
    expect(notExpense.body.code).toBe('ENTRY_NOT_EDITABLE');
  });
});

describe('E5 POST /api/entries/pay (lote)', () => {
  it('CA29: lote todo pendente', async () => {
    const a = await create({ amount: '100.00' });
    const b = await create({ amount: '50.25' });
    e.clock.set(T1);
    const res = await payBatch([a.id, b.id]);
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ paidIds: [a.id, b.id], alreadyPaidIds: [] });
    expect((await rowOf(a.id)).status).toBe('PAID');
    expect((await rowOf(b.id)).paid_at?.toISOString()).toBe(T1.toISOString());
  });

  it('CA30: lote misto - B ja paga fica inalterada (inclusive paidAt)', async () => {
    const a = await create();
    const b = await create({ paid: undefined });
    e.clock.set(T1);
    const res = await payBatch([a.id, b.id]);
    expect(res.body).toEqual({ paidIds: [a.id], alreadyPaidIds: [b.id] });
    expect((await rowOf(b.id)).paid_at?.toISOString()).toBe(T0.toISOString());
  });

  it('CA31: ids inexistentes -> 404 ENTRIES_NOT_FOUND com missingIds [X, Y]; A segue PENDING', async () => {
    const a = await create();
    const res = await payBatch([a.id, MISSING, MISSING_2]);
    expect(res.status).toBe(404);
    expect(res.body).toEqual({ code: 'ENTRIES_NOT_FOUND', message: expect.any(String), details: { missingIds: [MISSING, MISSING_2] } });
    expect((await rowOf(a.id)).status).toBe('PENDING');
  });

  it('CA32: receita no lote -> 422 ENTRIES_NOT_PAYABLE com incomeIds; despesa segue PENDING', async () => {
    const a = await create();
    const r = await create({ type: 'INCOME', paid: undefined });
    const res = await payBatch([a.id, r.id]);
    expect(res.status).toBe(422);
    expect(res.body).toEqual({ code: 'ENTRIES_NOT_PAYABLE', message: expect.any(String), details: { incomeIds: [r.id] } });
    expect((await rowOf(a.id)).status).toBe('PENDING');
  });

  it('CA33: 404 tem precedencia sobre 422', async () => {
    const r = await create({ type: 'INCOME', paid: undefined });
    const res = await payBatch([r.id, MISSING]);
    expect(res.status).toBe(404);
    expect(res.body.details.missingIds).toEqual([MISSING]);
  });

  it('CA35: ids duplicados -> sucesso, paga uma unica vez', async () => {
    const a = await create();
    const res = await payBatch([a.id, a.id]);
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ paidIds: [a.id], alreadyPaidIds: [] });
  });

  it.each([
    ['lista vazia', [], 'ids', 'EMPTY'],
    ['id mal formado', ['abc'], 'ids[0]', 'INVALID_FORMAT'],
    ['101 itens', Array(101).fill('0192f1e2-0000-7000-8000-000000000001'), 'ids', 'TOO_MANY_ITEMS'],
    ['ids nao e array', 'x', 'ids', 'INVALID_TYPE'],
  ])('CA36: %s -> 400 e nada alterado', async (_label, ids, field, code) => {
    const a = await create();
    const res = await payBatch(ids);
    expect(res.status).toBe(400);
    expect(res.body.details.fields).toContainEqual(expect.objectContaining({ field, code }));
    expect((await rowOf(a.id)).status).toBe('PENDING');
  });

  it('CA36: corpo sem ids ou com campo desconhecido -> 400', async () => {
    expect((await e.http().post('/api/entries/pay').send({})).status).toBe(400);
    const res = await e.http().post('/api/entries/pay').send({ ids: [MISSING], force: true });
    expect(res.status).toBe(400);
    expect(res.body.details.fields).toContainEqual(expect.objectContaining({ field: 'force', code: 'UNKNOWN_FIELD' }));
  });

  it('a rota /pay nao colide com :id (UUID) - POST /api/entries/pay sem corpo e 400, nao ENTRY_NOT_FOUND', async () => {
    const res = await e.http().post('/api/entries/pay');
    expect(res.status).toBe(400);
  });
});

describe('I3 POST /api/cards/:cardId/invoices/:referenceMonth/pay', () => {
  it('CA38: paga so as PENDING do cartao/mes; 2 lancamentos e 150.00; demais inalterados', async () => {
    const c = await newCard('C');
    const other = await newCard('Outro');
    const e1 = await cardEntry(c.id, { amount: '100.00' }); // 10/10 -> ref 2026-11
    const e2 = await cardEntry(c.id, { amount: '50.00' });
    const e3 = await cardEntry(c.id, { amount: '30.00' });
    await e.http().post(`/api/entries/${e3.id}/pay`);
    const e4 = await cardEntry(c.id, { date: '2026-11-10' }); // ref 2026-12
    const e5 = await cardEntry(other.id);
    const e6 = await create({ date: '2026-11-20' }); // PIX pendente 2026-11
    e.clock.set(T1);
    const res = await e.http().post(`/api/cards/${c.id}/invoices/2026-11/pay`);
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ cardId: c.id, referenceMonth: '2026-11', paidIds: expect.arrayContaining([e1.id, e2.id]), paidCount: 2, paidAmount: '150.00' });
    expect(res.body.paidIds).toHaveLength(2);
    expect((await rowOf(e1.id)).status).toBe('PAID');
    expect((await rowOf(e3.id)).paid_at?.toISOString()).toBe(T0.toISOString());
    for (const id of [e4.id, e5.id, e6.id]) expect((await rowOf(id)).status).toBe('PENDING');
  });

  it('CA39: pagar a fatura de 2026-10 nao paga a compra de 10/10 (vence em novembro); 2026-11 paga', async () => {
    const c = await newCard();
    const x = await cardEntry(c.id);
    const oct = await e.http().post(`/api/cards/${c.id}/invoices/2026-10/pay`);
    expect(oct.body).toMatchObject({ paidCount: 0, paidAmount: '0.00', paidIds: [] });
    expect((await rowOf(x.id)).status).toBe('PENDING');
    const nov = await e.http().post(`/api/cards/${c.id}/invoices/2026-11/pay`);
    expect(nov.body.paidCount).toBe(1);
    expect((await rowOf(x.id)).status).toBe('PAID');
  });

  it('CA40: sem pendencias (vazia ou ja paga) -> 200, [], 0, "0.00"', async () => {
    const c = await newCard();
    const empty = await e.http().post(`/api/cards/${c.id}/invoices/2027-01/pay`);
    expect(empty.status).toBe(200);
    expect(empty.body).toEqual({ cardId: c.id, referenceMonth: '2027-01', paidIds: [], paidCount: 0, paidAmount: '0.00' });
    await cardEntry(c.id);
    await e.http().post(`/api/cards/${c.id}/invoices/2026-11/pay`);
    const again = await e.http().post(`/api/cards/${c.id}/invoices/2026-11/pay`);
    expect(again.body).toMatchObject({ paidCount: 0, paidAmount: '0.00' });
  });

  it('CA41: cartao inexistente -> 404; mes "2026-13" -> 400', async () => {
    const c = await newCard();
    const x = await cardEntry(c.id);
    const notFound = await e.http().post(`/api/cards/${MISSING}/invoices/2026-11/pay`);
    expect(notFound.status).toBe(404);
    expect(notFound.body.code).toBe('CARD_NOT_FOUND');
    const badMonth = await e.http().post(`/api/cards/${c.id}/invoices/2026-13/pay`);
    expect(badMonth.status).toBe(400);
    expect(badMonth.body.code).toBe('VALIDATION_ERROR');
    expect((await e.http().post(`/api/cards/abc/invoices/2026-11/pay`)).status).toBe(400);
    expect((await rowOf(x.id)).status).toBe('PENDING');
  });
});
