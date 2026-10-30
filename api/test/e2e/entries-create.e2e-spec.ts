import { UUID_V7, type E2eApp } from '../support/e2e-app.js';
import { startFinanceE2e } from '../support/finance-e2e.js';
import { query } from '../support/db.js';

let e: E2eApp;
beforeAll(async () => {
  e = await startFinanceE2e(new Date('2026-10-05T13:00:00.000Z'));
});
afterAll(() => e.close());
beforeEach(async () => {
  await e.reset();
  e.clock.set(new Date('2026-10-05T13:00:00.000Z'));
});

const post = (body: Record<string, unknown>) => e.http().post('/api/entries').send(body);
const count = async () => (await query(e.pool, 'SELECT 1 FROM entries')).length;
const pix = (over: Record<string, unknown> = {}) => ({
  type: 'EXPENSE',
  description: 'Aluguel',
  category: 'Moradia',
  date: '2026-10-05',
  amount: '1500.00',
  paymentMethod: 'PIX',
  ...over,
});
const newCard = async (name = 'Nubank', closingDay = 25, dueDay = 5) =>
  (await e.http().post('/api/cards').send({ name, closingDay, dueDay })).body as { id: string };
const fieldsOf = (res: { body: any }) => res.body.details.fields as { field: string; code: string }[];

describe('E1 POST /api/entries - despesa PIX', () => {
  it('CA07: sem paid -> 201 PAID, paidAt = relogio injetado, referenceMonth, invoice null, id UUID v7', async () => {
    const res = await post(pix());
    expect(res.status).toBe(201);
    expect(res.body).toEqual({
      id: expect.stringMatching(UUID_V7),
      type: 'EXPENSE',
      description: 'Aluguel',
      category: 'Moradia',
      date: '2026-10-05',
      amount: '1500.00',
      paymentMethod: 'PIX',
      card: null,
      invoice: null,
      referenceMonth: '2026-10',
      status: 'PAID',
      paidAt: '2026-10-05T13:00:00.000Z',
      createdAt: '2026-10-05T13:00:00.000Z',
      updatedAt: '2026-10-05T13:00:00.000Z',
    });
  });

  it('CA07: o resumo de 2026-10 ganha 1500.00 em pagas e o realizado cai o mesmo valor', async () => {
    await post(pix());
    const res = await e.http().get('/api/summary').query({ month: '2026-10' });
    expect(res.body.totals.expenses.paid).toBe('1500.00');
    expect(res.body.totals.balance.realized).toBe('-1500.00');
  });

  it('CA08: paid=false -> PENDING sem paidAt; paid=true igual ao CA07', async () => {
    const pending = await post(pix({ paid: false }));
    expect(pending.status).toBe(201);
    expect(pending.body).toMatchObject({ status: 'PENDING', paidAt: null });
    const paid = await post(pix({ paid: true }));
    expect(paid.body).toMatchObject({ status: 'PAID', paidAt: '2026-10-05T13:00:00.000Z' });
  });

  it('B8: data futura nasce PAID; com paid=false nasce PENDING', async () => {
    const future = await post(pix({ date: '2027-03-20' }));
    expect(future.body).toMatchObject({ status: 'PAID', paidAt: '2026-10-05T13:00:00.000Z', referenceMonth: '2027-03' });
    expect((await post(pix({ date: '2027-03-20', paid: false }))).body.status).toBe('PENDING');
  });

  it('cardId null explicito equivale a omitido', async () => {
    expect((await post(pix({ cardId: null }))).status).toBe(201);
  });

  it('CA23: PIX de 2026-10-31 criado as 23h em Sao Paulo aparece em outubro como 2026-10-31', async () => {
    e.clock.set(new Date('2026-11-01T02:30:00.000Z'));
    const res = await post(pix({ date: '2026-10-31' }));
    expect(res.body.date).toBe('2026-10-31');
    expect(res.body.referenceMonth).toBe('2026-10');
    const list = await e.http().get('/api/entries/expenses').query({ month: '2026-10' });
    expect(list.body.items.map((i: { date: string }) => i.date)).toEqual(['2026-10-31']);
    const nov = await e.http().get('/api/entries/expenses').query({ month: '2026-11' });
    expect(nov.body.items).toEqual([]);
  });
});

describe('E1 - despesa no cartao', () => {
  it('CA09/CA22: PENDING com fechamento, vencimento e referencia; E2 devolve o mesmo item', async () => {
    const card = await newCard('Nubank', 25, 5);
    const res = await post(pix({ paymentMethod: 'CARD', cardId: card.id, date: '2026-10-10', amount: '250.00', category: 'Alimentação' }));
    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({
      status: 'PENDING',
      paidAt: null,
      paymentMethod: 'CARD',
      card: { id: card.id, name: 'Nubank' },
      invoice: { closingDate: '2026-10-25', dueDate: '2026-11-05' },
      referenceMonth: '2026-11',
    });
    const list = await e.http().get('/api/entries/expenses').query({ month: '2026-11' });
    expect(list.body.items).toEqual([res.body]);
  });

  it('CA22: compra em 2026-10-26 -> 25/11, 05/12, 2026-12', async () => {
    const card = await newCard();
    const res = await post(pix({ paymentMethod: 'CARD', cardId: card.id, date: '2026-10-26' }));
    expect(res.body).toMatchObject({ invoice: { closingDate: '2026-11-25', dueDate: '2026-12-05' }, referenceMonth: '2026-12' });
  });

  it('CA09: paid=false aceito', async () => {
    const card = await newCard();
    expect((await post(pix({ paymentMethod: 'CARD', cardId: card.id, paid: false }))).body.status).toBe('PENDING');
  });

  it('CA09: paid=true no cartao -> 400 em paid e nada criado (mesmo com cartao inexistente, nao 404)', async () => {
    const card = await newCard();
    const real = await post(pix({ paymentMethod: 'CARD', cardId: card.id, paid: true }));
    expect(real.status).toBe(400);
    expect(fieldsOf(real)).toContainEqual(expect.objectContaining({ field: 'paid', code: 'NOT_ALLOWED_FOR_CARD' }));
    const ghost = await post(pix({ paymentMethod: 'CARD', cardId: '0192f1e2-0000-7000-8000-000000000999', paid: true }));
    expect(ghost.status).toBe(400);
    expect(await count()).toBe(0);
  });

  it('CA13: cartao inexistente -> 404 CARD_NOT_FOUND e nada criado', async () => {
    const res = await post(pix({ paymentMethod: 'CARD', cardId: '0192f1e2-0000-7000-8000-000000000999' }));
    expect(res.status).toBe(404);
    expect(res.body).toEqual({ code: 'CARD_NOT_FOUND', message: expect.any(String), details: { id: '0192f1e2-0000-7000-8000-000000000999' } });
    expect(await count()).toBe(0);
  });

  it('CA12: CARD sem cardId e PIX com cardId -> 400 no campo cardId', async () => {
    const card = await newCard();
    const a = await post(pix({ paymentMethod: 'CARD' }));
    expect(a.status).toBe(400);
    expect(fieldsOf(a)).toContainEqual(expect.objectContaining({ field: 'cardId', code: 'REQUIRED' }));
    const b = await post(pix({ paymentMethod: 'PIX', cardId: card.id }));
    expect(b.status).toBe(400);
    expect(fieldsOf(b)).toContainEqual(expect.objectContaining({ field: 'cardId', code: 'NOT_ALLOWED_FOR_PIX' }));
    expect(await count()).toBe(0);
  });

  describe('CA21 - amostra da tabela via HTTP', () => {
    // [#, fecha, vence, compra, fechamento, vencimento, mesRef]
    it.each([
      [1, 25, 5, '2026-10-10', '2026-10-25', '2026-11-05', '2026-11'],
      [3, 25, 5, '2026-10-26', '2026-11-25', '2026-12-05', '2026-12'],
      [7, 10, 10, '2026-10-05', '2026-10-10', '2026-11-10', '2026-11'],
      [8, 25, 5, '2026-12-10', '2026-12-25', '2027-01-05', '2027-01'],
      [18, 31, 30, '2026-02-28', '2026-02-28', '2026-03-30', '2026-03'],
      [20, 28, 30, '2026-01-29', '2026-02-28', '2026-03-30', '2026-03'],
    ])('linha #%i', async (n, closing, due, purchase, expClosing, expDue, expRef) => {
      const card = await newCard(`Cartao ${n}`, closing, due);
      const res = await post(pix({ paymentMethod: 'CARD', cardId: card.id, date: purchase }));
      expect(res.status).toBe(201);
      expect(res.body.invoice).toEqual({ closingDate: expClosing, dueDate: expDue });
      expect(res.body.referenceMonth).toBe(expRef);
    });

    it('linhas 21 e 22: PIX e receita usam o mes da data', async () => {
      const a = await post(pix({ date: '2026-10-31' }));
      expect(a.body).toMatchObject({ referenceMonth: '2026-10', invoice: null });
      const b = await post(pix({ type: 'INCOME', date: '2026-12-31' }));
      expect(b.body).toMatchObject({ referenceMonth: '2026-12', invoice: null });
    });
  });
});

describe('E1 - receita', () => {
  it('CA10: 201 RECEIVED, sem cartao, referencia do mes, valor entra no realizado mesmo com data futura', async () => {
    e.clock.set(new Date('2026-10-24T12:00:00.000Z'));
    const res = await post({ type: 'INCOME', description: 'Salário', category: 'Salário', date: '2026-10-30', amount: '5000.00', paymentMethod: 'PIX' });
    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({ status: 'RECEIVED', paidAt: null, card: null, invoice: null, referenceMonth: '2026-10', type: 'INCOME' });
    const summary = await e.http().get('/api/summary').query({ month: '2026-10' });
    expect(summary.body.totals.balance.realized).toBe('5000.00');
  });

  it.each([
    ['CARD', { paymentMethod: 'CARD', cardId: '0192f1e2-0000-7000-8000-000000000999' }],
    ['com cardId', { cardId: '0192f1e2-0000-7000-8000-000000000999' }],
    ['com paid=true', { paid: true }],
    ['com paid=false', { paid: false }],
  ])('CA11: receita %s -> 400 e nada criado (cartao inexistente nao vira 404)', async (_label, extra) => {
    const res = await post(pix({ type: 'INCOME', ...extra }));
    expect(res.status).toBe(400);
    expect(res.body.code).toBe('VALIDATION_ERROR');
    expect(await count()).toBe(0);
  });
});

describe('E1 - validacao', () => {
  it.each([
    ['sem tipo', (() => { const { type: _t, ...rest } = pix(); return rest; })(), 'type', 'REQUIRED'],
    ['tipo TRANSFERENCIA', pix({ type: 'TRANSFERENCIA' }), 'type', 'INVALID_VALUE'],
    ['sem forma', (() => { const { paymentMethod: _p, ...rest } = pix(); return rest; })(), 'paymentMethod', 'REQUIRED'],
    ['forma CONTA', pix({ paymentMethod: 'CONTA' }), 'paymentMethod', 'INVALID_VALUE'],
    ['forma DINHEIRO', pix({ paymentMethod: 'DINHEIRO' }), 'paymentMethod', 'INVALID_VALUE'],
    ['forma ACCOUNT', pix({ paymentMethod: 'ACCOUNT' }), 'paymentMethod', 'INVALID_VALUE'],
    ['descricao vazia', pix({ description: '' }), 'description', 'REQUIRED'],
    ['descricao so espacos', pix({ description: '   ' }), 'description', 'REQUIRED'],
    ['descricao 121', pix({ description: 'x'.repeat(121) }), 'description', 'TOO_LONG'],
    ['valor 0', pix({ amount: '0' }), 'amount', 'MUST_BE_POSITIVE'],
    ['valor 0.00', pix({ amount: '0.00' }), 'amount', 'MUST_BE_POSITIVE'],
    ['valor negativo', pix({ amount: '-10.00' }), 'amount', 'MUST_BE_POSITIVE'],
    ['valor 3 casas', pix({ amount: '10.123' }), 'amount', 'TOO_MANY_DECIMALS'],
    ['valor abc', pix({ amount: 'abc' }), 'amount', 'INVALID_FORMAT'],
    ['valor acima do maximo', pix({ amount: '10000000000.00' }), 'amount', 'TOO_LARGE'],
    ['valor numerico', pix({ amount: 10 }), 'amount', 'INVALID_TYPE'],
    ['sem categoria', (() => { const { category: _c, ...rest } = pix(); return rest; })(), 'category', 'REQUIRED'],
    ['sem data', (() => { const { date: _d, ...rest } = pix(); return rest; })(), 'date', 'REQUIRED'],
    ['data 2026-02-30', pix({ date: '2026-02-30' }), 'date', 'INVALID_DATE'],
    ['paid "true" (string)', pix({ paid: 'true' }), 'paid', 'INVALID_TYPE'],
    ['paid null', pix({ paid: null }), 'paid', 'INVALID_TYPE'],
    ['cardId mal formado', pix({ paymentMethod: 'CARD', cardId: 'abc' }), 'cardId', 'INVALID_FORMAT'],
  ])('%s -> 400 no campo', async (_label, body, field, code) => {
    const res = await post(body as Record<string, unknown>);
    expect(res.status).toBe(400);
    expect(res.body).toMatchObject({ code: 'VALIDATION_ERROR', message: expect.any(String) });
    expect(fieldsOf(res)).toContainEqual(expect.objectContaining({ field, code }));
    expect(await count()).toBe(0);
  });

  it.each([['status', 'PAID'], ['referenceMonth', '2026-01'], ['closingDate', '2026-10-25'], ['dueDate', '2026-11-05'], ['invoice', { dueDate: '2026-11-05' }], ['qualquerCoisa', 1]])(
    'CA15: campo %s na entrada -> 400 UNKNOWN_FIELD e nada criado',
    async (field, value) => {
      const res = await post(pix({ [field]: value }));
      expect(res.status).toBe(400);
      expect(fieldsOf(res)).toContainEqual(expect.objectContaining({ field, code: 'UNKNOWN_FIELD' }));
      expect(await count()).toBe(0);
    },
  );

  it('CA16: descricao com exatamente 120 caracteres -> 201', async () => {
    expect((await post(pix({ description: 'x'.repeat(120) }))).status).toBe(201);
  });

  it('CA18: valores "10" e "10.5" voltam como "10.00" e "10.50"', async () => {
    expect((await post(pix({ amount: '10' }))).body.amount).toBe('10.00');
    expect((await post(pix({ amount: '10.5' }))).body.amount).toBe('10.50');
  });

  it('CA17: valor maximo 9999999999.99 e aceito', async () => {
    expect((await post(pix({ amount: '9999999999.99' }))).body.amount).toBe('9999999999.99');
  });

  it('CA19: acumula todas as violacoes juntas', async () => {
    const res = await post(pix({ category: '', date: '2026-02-30', amount: '0', description: '' }));
    expect(res.status).toBe(400);
    expect(fieldsOf(res).map((f) => f.field).sort()).toEqual(['amount', 'category', 'date', 'description']);
  });

  it('CA19: violacoes de forma (zod) tambem vem todas juntas', async () => {
    const res = await post({});
    expect(res.status).toBe(400);
    const names = fieldsOf(res).map((f) => f.field);
    for (const f of ['type', 'description', 'category', 'date', 'amount', 'paymentMethod']) expect(names).toContain(f);
  });

  it('JSON invalido -> 400 MALFORMED_JSON', async () => {
    const res = await e.http().post('/api/entries').set('Content-Type', 'application/json').send('{"type": ');
    expect(res.status).toBe(400);
    expect(res.body.code).toBe('MALFORMED_JSON');
  });

  it('CA20: categoria "  alimentação " usa a grafia existente "Alimentação" e E6 lista uma so', async () => {
    await post(pix({ category: 'Alimentação' }));
    const res = await post(pix({ category: '  alimentação ' }));
    expect(res.body.category).toBe('Alimentação');
    expect((await e.http().get('/api/categories')).body).toEqual({ items: ['Alimentação'] });
  });
});
