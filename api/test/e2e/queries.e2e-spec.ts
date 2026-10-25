import { startE2eApp, type E2eApp } from '../support/e2e-app.js';
import { cardEntry, cardUuid, entryUuid, insertCard, insertEntry } from '../support/db.js';
import { CATEGORY_READ_MODEL } from '@finance/application/ports/category-read-model.js';

let e: E2eApp;
beforeAll(async () => {
  e = await startE2eApp();
});
afterAll(() => e.close());
beforeEach(() => e.reset());

const get = (path: string, query: Record<string, string | string[]> = {}) => e.http().get(path).query(query);
const fieldsOf = (res: { body: any }) => res.body.details.fields as { field: string; code: string }[];
const pending = { status: 'PENDING', paidAt: null } as const;
const NOV = { date: '2026-10-10', closing: '2026-10-25', due: '2026-11-05' };
const MISSING = '0192f1e2-0000-7000-8000-000000000999';

/** Mes do CA47: receitas 5000; despesas pagas 3000 (1000 Moradia); pendentes 2500. */
async function seedCa47() {
  await insertEntry(e.pool, { n: 1, type: 'INCOME', amount: '5000.00', category: 'Salário' });
  await insertEntry(e.pool, { n: 2, amount: '1000.00', category: 'Moradia' });
  await insertEntry(e.pool, { n: 3, amount: '2000.00', category: 'Lazer' });
  await insertEntry(e.pool, { n: 4, ...pending, amount: '2500.00', category: 'Lazer' });
}

describe('S1 GET /api/summary', () => {
  it('CA48: formato completo com totais e saldos com sinal', async () => {
    await seedCa47();
    const res = await get('/api/summary', { month: '2026-10' });
    expect(res.status).toBe(200);
    expect(res.body).toEqual({
      month: '2026-10',
      totals: {
        income: '5000.00',
        expenses: { total: '5500.00', paid: '3000.00', pending: '2500.00' },
        balance: { realized: '2000.00', projected: '-500.00' },
      },
    });
  });

  it('CA47: resumo independe de filtros/paginacao das listagens (so existe o filtro de mes)', async () => {
    await seedCa47();
    const before = (await get('/api/summary', { month: '2026-10' })).body;
    await get('/api/entries/expenses', { month: '2026-10', category: 'moradia', page: '2' });
    expect((await get('/api/summary', { month: '2026-10' })).body).toEqual(before);
    const withFilter = await get('/api/summary', { month: '2026-10', category: 'moradia' });
    expect(withFilter.status).toBe(400);
    expect(fieldsOf(withFilter)).toContainEqual(expect.objectContaining({ field: 'category', code: 'UNKNOWN_FIELD' }));
  });

  it('CA52: precisao decimal', async () => {
    for (const [n, a] of [[1, '0.10'], [2, '0.20'], [3, '0.30']] as const) await insertEntry(e.pool, { n, ...pending, amount: a });
    await insertEntry(e.pool, { n: 4, type: 'INCOME', amount: '0.50' });
    const { totals } = (await get('/api/summary', { month: '2026-10' })).body;
    expect(totals.expenses.total).toBe('0.60');
    expect(totals.balance.projected).toBe('-0.10');
  });

  it('CA65: mes sem dados -> tudo "0.00"', async () => {
    const { body } = await get('/api/summary', { month: '2030-01' });
    expect(body.totals).toEqual({ income: '0.00', expenses: { total: '0.00', paid: '0.00', pending: '0.00' }, balance: { realized: '0.00', projected: '0.00' } });
  });

  it.each([[{}], [{ month: '2026-13' }], [{ month: 'abc' }], [{ month: '2026-1' }]])('CA57: query %j -> 400', async (q) => {
    const res = await get('/api/summary', q as Record<string, string>);
    expect(res.status).toBe(400);
    expect(res.body.code).toBe('VALIDATION_ERROR');
    expect(fieldsOf(res).some((f) => f.field === 'month')).toBe(true);
  });

  it('parametro repetido -> 400 INVALID_TYPE', async () => {
    const res = await get('/api/summary', { month: ['2026-10', '2026-11'] });
    expect(res.status).toBe(400);
    expect(fieldsOf(res)).toContainEqual(expect.objectContaining({ field: 'month', code: 'INVALID_TYPE' }));
  });
});

describe('E2 GET /api/entries/expenses', () => {
  it('CA46: formato, pagina padrao 1/20 e ordenacao por data desc', async () => {
    for (let n = 1; n <= 25; n++) await insertEntry(e.pool, { n, date: `2026-10-${String(1 + (n % 20)).padStart(2, '0')}`, amount: '10.00' });
    const res = await get('/api/entries/expenses', { month: '2026-10' });
    expect(res.status).toBe(200);
    expect(res.body.month).toBe('2026-10');
    expect(res.body.items).toHaveLength(20);
    expect(res.body.pagination).toEqual({ page: 1, pageSize: 20, totalItems: 25, totalPages: 2 });
    const dates = res.body.items.map((i: { date: string }) => i.date);
    expect([...dates].sort().reverse()).toEqual(dates);
    expect(res.body.subtotal).toEqual({ total: '250.00', paid: '250.00', pending: '0.00' });
    const page2 = await get('/api/entries/expenses', { month: '2026-10', page: '2' });
    expect(page2.body.items).toHaveLength(5);
  });

  it('CA46: pageSize respeitado; pagina alem do fim -> items [] com metadados', async () => {
    for (let n = 1; n <= 3; n++) await insertEntry(e.pool, { n });
    const res = await get('/api/entries/expenses', { month: '2026-10', page: '9', pageSize: '2' });
    expect(res.body.items).toEqual([]);
    expect(res.body.pagination).toEqual({ page: 9, pageSize: 2, totalItems: 3, totalPages: 2 });
  });

  it('CA50: subtotal considera todo o filtro (30 Moradia), nao a pagina; resumo continua no mes inteiro', async () => {
    for (let n = 1; n <= 30; n++) await insertEntry(e.pool, { n, category: 'Moradia', amount: '10.00' });
    await insertEntry(e.pool, { n: 100, category: 'Lazer', amount: '500.00' });
    const res = await get('/api/entries/expenses', { month: '2026-10', category: 'moradia' });
    expect(res.body.items).toHaveLength(20);
    expect(res.body.subtotal).toEqual({ total: '300.00', paid: '300.00', pending: '0.00' });
    expect((await get('/api/summary', { month: '2026-10' })).body.totals.expenses.total).toBe('800.00');
  });

  it('CA53: compra no cartao de 10/10 aparece em 2026-11 (com invoice); PIX de 20/10 nao', async () => {
    await insertCard(e.pool, { n: 1, name: 'C' });
    await insertEntry(e.pool, cardEntry(1, 1, { ...NOV }));
    await insertEntry(e.pool, { n: 2, date: '2026-10-20' });
    const nov = await get('/api/entries/expenses', { month: '2026-11' });
    expect(nov.body.items.map((i: { id: string }) => i.id)).toEqual([entryUuid(1)]);
    expect(nov.body.items[0]).toMatchObject({ referenceMonth: '2026-11', date: '2026-10-10', card: { id: cardUuid(1), name: 'C' }, invoice: { closingDate: '2026-10-25', dueDate: '2026-11-05' } });
  });

  it('CA54: filtro por status (subtotal pagas 0.00 em PENDING); resumo nao muda', async () => {
    await insertEntry(e.pool, { n: 1, amount: '30.00' });
    await insertEntry(e.pool, { n: 2, ...pending, amount: '70.00' });
    const summary = (await get('/api/summary', { month: '2026-10' })).body;
    const res = await get('/api/entries/expenses', { month: '2026-10', status: 'PENDING' });
    expect(res.body.items.map((i: { status: string }) => i.status)).toEqual(['PENDING']);
    expect(res.body.subtotal).toEqual({ total: '70.00', paid: '0.00', pending: '70.00' });
    expect((await get('/api/summary', { month: '2026-10' })).body).toEqual(summary);
  });

  it('CA55: filtro por cartao e por "pix"', async () => {
    await insertCard(e.pool, { n: 1, name: 'C1' });
    await insertCard(e.pool, { n: 2, name: 'C2' });
    await insertEntry(e.pool, cardEntry(1, 1, { ...NOV, amount: '10.00' }));
    await insertEntry(e.pool, cardEntry(2, 2, { ...NOV, amount: '20.00' }));
    await insertEntry(e.pool, { n: 3, date: '2026-11-03', amount: '5.00' });
    const c1 = await get('/api/entries/expenses', { month: '2026-11', cardId: cardUuid(1) });
    expect(c1.body.items.map((i: { id: string }) => i.id)).toEqual([entryUuid(1)]);
    expect(c1.body.subtotal.pending).toBe('10.00');
    const pix = await get('/api/entries/expenses', { month: '2026-11', cardId: 'pix' });
    expect(pix.body.items.map((i: { id: string }) => i.id)).toEqual([entryUuid(3)]);
    const ghost = await get('/api/entries/expenses', { month: '2026-11', cardId: MISSING });
    expect(ghost.status).toBe(200);
    expect(ghost.body.items).toEqual([]);
  });

  it('CA56: categoria case-insensitive', async () => {
    await insertEntry(e.pool, { n: 1, category: 'Moradia' });
    await insertEntry(e.pool, { n: 2, category: 'Alimentação' });
    const res = await get('/api/entries/expenses', { month: '2026-10', category: 'MORADIA' });
    expect(res.body.items.map((i: { category: string }) => i.category)).toEqual(['Moradia']);
  });

  it('CA58: sem correspondencia -> lista vazia, subtotais "0.00"', async () => {
    await insertEntry(e.pool, { n: 1 });
    const res = await get('/api/entries/expenses', { month: '2026-10', category: 'nada' });
    expect(res.body.items).toEqual([]);
    expect(res.body.subtotal).toEqual({ total: '0.00', paid: '0.00', pending: '0.00' });
    expect(res.body.pagination.totalItems).toBe(0);
  });

  it.each([
    ['mes ausente', {}, 'month'],
    ['mes 2026-13', { month: '2026-13' }, 'month'],
    ['status RECEIVED', { month: '2026-10', status: 'RECEIVED' }, 'status'],
    ['status minusculo', { month: '2026-10', status: 'pending' }, 'status'],
    ['cardId abc', { month: '2026-10', cardId: 'abc' }, 'cardId'],
    ['cardId none (legado)', { month: '2026-10', cardId: 'none' }, 'cardId'],
    ['pageSize 101', { month: '2026-10', pageSize: '101' }, 'pageSize'],
    ['page 0', { month: '2026-10', page: '0' }, 'page'],
    ['page abc', { month: '2026-10', page: 'abc' }, 'page'],
  ])('CA57: %s -> 400', async (_label, q, field) => {
    const res = await get('/api/entries/expenses', q as Record<string, string>);
    expect(res.status).toBe(400);
    expect(res.body).toMatchObject({ code: 'VALIDATION_ERROR' });
    expect(fieldsOf(res).some((f) => f.field === field)).toBe(true);
  });

  it.each([['fromMonth', '2026-01'], ['toMonth', '2026-12'], ['type', 'EXPENSE'], ['period', 'all']])(
    'CA57: parametro desconhecido/legado %s -> 400 UNKNOWN_FIELD',
    async (name, value) => {
      const res = await get('/api/entries/expenses', { month: '2026-10', [name]: value });
      expect(res.status).toBe(400);
      expect(fieldsOf(res)).toContainEqual(expect.objectContaining({ field: name, code: 'UNKNOWN_FIELD' }));
    },
  );
});

describe('E3 GET /api/entries/incomes', () => {
  it('CA53/CA56: so receitas do mes, subtotal { total }, filtro por categoria', async () => {
    await insertEntry(e.pool, { n: 1, type: 'INCOME', date: '2026-11-05', amount: '5000.00', category: 'Salário' });
    await insertEntry(e.pool, { n: 2, type: 'INCOME', date: '2026-11-06', amount: '300.00', category: 'Extra' });
    await insertEntry(e.pool, { n: 3, date: '2026-11-05' });
    const all = await get('/api/entries/incomes', { month: '2026-11' });
    expect(all.status).toBe(200);
    expect(all.body.month).toBe('2026-11');
    expect(all.body.items.map((i: { id: string }) => i.id)).toEqual([entryUuid(2), entryUuid(1)]);
    expect(all.body.subtotal).toEqual({ total: '5300.00' });
    expect(all.body.pagination).toEqual({ page: 1, pageSize: 20, totalItems: 2, totalPages: 1 });
    const extra = await get('/api/entries/incomes', { month: '2026-11', category: 'extra' });
    expect(extra.body.subtotal).toEqual({ total: '300.00' });
    expect(extra.body.items[0]).toMatchObject({ type: 'INCOME', status: 'RECEIVED', card: null, invoice: null, paidAt: null });
  });

  it('CA58: vazio -> subtotal 0.00', async () => {
    const res = await get('/api/entries/incomes', { month: '2026-11' });
    expect(res.body.items).toEqual([]);
    expect(res.body.subtotal).toEqual({ total: '0.00' });
  });

  it.each([
    ['mes ausente', {}],
    ['mes invalido', { month: '2026-13' }],
    ['status em receitas', { month: '2026-11', status: 'PAID' }],
    ['cardId em receitas', { month: '2026-11', cardId: 'pix' }],
    ['fromMonth', { month: '2026-11', fromMonth: '2026-01' }],
  ])('CA57: %s -> 400', async (_label, q) => {
    const res = await get('/api/entries/incomes', q as Record<string, string>);
    expect(res.status).toBe(400);
  });
});

describe('I1 GET /api/invoices e I2 GET /api/cards/:cardId/invoices/:month/entries', () => {
  async function seedCa43() {
    await insertCard(e.pool, { n: 1, name: 'A', closingDay: 25, dueDay: 5 });
    await insertCard(e.pool, { n: 2, name: 'B', closingDay: 3, dueDay: 10 });
    await insertEntry(e.pool, cardEntry(1, 1, { date: '2026-10-10', closing: '2026-10-25', due: '2026-11-05', amount: '100.00' }));
    await insertEntry(e.pool, cardEntry(2, 1, { date: '2026-10-20', closing: '2026-10-25', due: '2026-11-05', amount: '40.00', status: 'PAID' }));
    await insertEntry(e.pool, cardEntry(3, 2, { date: '2026-10-15', closing: '2026-11-03', due: '2026-11-10', amount: '60.00' }));
  }

  it('CA43: faturas ordenadas por vencimento com datas, contagens, pendingCount e totais', async () => {
    await seedCa43();
    const res = await get('/api/invoices', { month: '2026-11' });
    expect(res.status).toBe(200);
    expect(res.body).toEqual({
      month: '2026-11',
      items: [
        {
          card: { id: cardUuid(1), name: 'A' },
          referenceMonth: '2026-11',
          closingDate: '2026-10-25',
          dueDate: '2026-11-05',
          entryCount: 2,
          pendingCount: 1,
          totals: { total: '140.00', paid: '40.00', pending: '100.00' },
        },
        {
          card: { id: cardUuid(2), name: 'B' },
          referenceMonth: '2026-11',
          closingDate: '2026-11-03',
          dueDate: '2026-11-10',
          entryCount: 1,
          pendingCount: 1,
          totals: { total: '60.00', paid: '0.00', pending: '60.00' },
        },
      ],
    });
  });

  it('CA44: cartao sem despesas nao aparece; mes sem faturas -> items []', async () => {
    await seedCa43();
    await insertCard(e.pool, { n: 3, name: 'Sem despesas' });
    const names = (await get('/api/invoices', { month: '2026-11' })).body.items.map((i: { card: { name: string } }) => i.card.name);
    expect(names).toEqual(['A', 'B']);
    expect((await get('/api/invoices', { month: '2027-06' })).body).toEqual({ month: '2027-06', items: [] });
  });

  it('CA45: fatura paga continua listada com pendente "0.00" e pendingCount 0', async () => {
    await insertCard(e.pool, { n: 1, name: 'A' });
    await insertEntry(e.pool, cardEntry(1, 1, { ...NOV, status: 'PAID', amount: '70.00' }));
    const [a] = (await get('/api/invoices', { month: '2026-11' })).body.items;
    expect(a.pendingCount).toBe(0);
    expect(a.totals).toEqual({ total: '70.00', paid: '70.00', pending: '0.00' });
  });

  it('B9: datas divergentes na mesma fatura -> maiores closingDate e dueDate', async () => {
    await insertCard(e.pool, { n: 1, name: 'Editado' });
    await insertEntry(e.pool, cardEntry(1, 1, { date: '2026-10-10', closing: '2026-10-10', due: '2026-11-05' }));
    await insertEntry(e.pool, cardEntry(2, 1, { date: '2026-10-15', closing: '2026-11-20', due: '2026-11-28' }));
    const [inv] = (await get('/api/invoices', { month: '2026-11' })).body.items;
    expect(inv).toMatchObject({ closingDate: '2026-11-20', dueDate: '2026-11-28', entryCount: 2 });
  });

  it('CA49: soma dos totais das faturas = soma das despesas no cartao do mes', async () => {
    await seedCa43();
    const invoices = (await get('/api/invoices', { month: '2026-11' })).body.items as { totals: { total: string } }[];
    const cents = invoices.reduce((acc, i) => acc + BigInt(i.totals.total.replace('.', '')), 0n);
    const expenses = await get('/api/entries/expenses', { month: '2026-11', pageSize: '100' });
    const cardOnly = (expenses.body.items as { paymentMethod: string; amount: string }[]).filter((i) => i.paymentMethod === 'CARD');
    expect(cardOnly.reduce((acc, i) => acc + BigInt(i.amount.replace('.', '')), 0n)).toBe(cents);
  });

  it.each([[{}], [{ month: '2026-13' }], [{ month: '2026-11', cardId: cardUuid(1) }]])('I1 query %j -> 400', async (q) => {
    expect((await get('/api/invoices', q as Record<string, string>)).status).toBe(400);
  });

  it('I2/DR7: todas as despesas do bloco, sem paginacao, data desc, so do cartao e do mes', async () => {
    await insertCard(e.pool, { n: 1, name: 'Nubank' });
    await insertCard(e.pool, { n: 2, name: 'Outro' });
    for (let n = 1; n <= 25; n++) {
      await insertEntry(e.pool, cardEntry(n, 1, { date: `2026-10-${String(1 + (n % 9)).padStart(2, '0')}`, closing: '2026-10-25', due: '2026-11-05' }));
    }
    await insertEntry(e.pool, cardEntry(100, 2, { ...NOV }));
    await insertEntry(e.pool, cardEntry(101, 1, { date: '2026-11-10', closing: '2026-11-25', due: '2026-12-05' }));
    const res = await get(`/api/cards/${cardUuid(1)}/invoices/2026-11/entries`);
    expect(res.status).toBe(200);
    expect(res.body.card).toEqual({ id: cardUuid(1), name: 'Nubank' });
    expect(res.body.referenceMonth).toBe('2026-11');
    expect(res.body.items).toHaveLength(25);
    expect(res.body.pagination).toBeUndefined();
    const dates = res.body.items.map((i: { date: string }) => i.date);
    expect([...dates].sort().reverse()).toEqual(dates);
    expect(res.body.items[0]).toMatchObject({ paymentMethod: 'CARD', card: { name: 'Nubank' }, invoice: { dueDate: '2026-11-05' } });
  });

  it('I2: cartao existente sem despesas -> items []; cartao inexistente -> 404; mes invalido -> 400', async () => {
    await insertCard(e.pool, { n: 1, name: 'Nubank' });
    expect((await get(`/api/cards/${cardUuid(1)}/invoices/2027-01/entries`)).body.items).toEqual([]);
    const notFound = await get(`/api/cards/${MISSING}/invoices/2026-11/entries`);
    expect(notFound.status).toBe(404);
    expect(notFound.body.code).toBe('CARD_NOT_FOUND');
    expect((await get(`/api/cards/${cardUuid(1)}/invoices/2026-13/entries`)).status).toBe(400);
    expect((await get(`/api/cards/abc/invoices/2026-11/entries`)).status).toBe(400);
  });
});

describe('CA51 - totais consistentes apos pagamento em lote (S1, E2, D2)', () => {
  it('pendente vira pago no resumo, no subtotal e na serie; previsto inalterado', async () => {
    await insertEntry(e.pool, { n: 1, type: 'INCOME', amount: '1000.00' });
    await insertEntry(e.pool, { n: 2, amount: '200.00' });
    await insertEntry(e.pool, { n: 3, ...pending, amount: '150.00' });
    await insertEntry(e.pool, { n: 4, ...pending, amount: '100.10' });
    await insertEntry(e.pool, { n: 5, ...pending, amount: '49.90' });
    const res = await e.http().post('/api/entries/pay').send({ ids: [entryUuid(4), entryUuid(5)] });
    expect(res.status).toBe(200);
    const expected = { total: '500.00', paid: '350.00', pending: '150.00' };
    const summary = (await get('/api/summary', { month: '2026-10' })).body.totals;
    expect(summary.expenses).toEqual(expected);
    expect(summary.balance).toEqual({ realized: '650.00', projected: '500.00' });
    expect((await get('/api/entries/expenses', { month: '2026-10' })).body.subtotal).toEqual(expected);
    const series = (await get('/api/dashboard/monthly-series', { month: '2026-10' })).body.points.at(-1);
    expect(series.totals.expenses).toEqual(expected);
  });
});

describe('E6 GET /api/categories', () => {
  it('lista unica por chave (receitas e despesas), grafia do primeiro uso', async () => {
    await insertEntry(e.pool, { n: 1, category: 'Alimentação', createdAt: '2026-10-05T10:00:00.000Z' });
    await insertEntry(e.pool, { n: 2, category: 'ALIMENTAÇÃO', createdAt: '2026-10-05T11:00:00.000Z' });
    await insertEntry(e.pool, { n: 3, type: 'INCOME', category: 'Salário' });
    const res = await get('/api/categories');
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ items: ['Alimentação', 'Salário'] });
  });
});

describe('D2 GET /api/dashboard/monthly-series', () => {
  it('CA62: 12 pontos de 2025-11 a 2026-10 com zeros e saldos', async () => {
    await insertEntry(e.pool, { n: 1, type: 'INCOME', date: '2026-03-10', amount: '1000.00' });
    await insertEntry(e.pool, { n: 2, ...pending, date: '2026-10-10', amount: '1500.00' });
    await insertEntry(e.pool, { n: 3, type: 'INCOME', date: '2026-10-01', amount: '1000.00' });
    const res = await get('/api/dashboard/monthly-series', { month: '2026-10' });
    expect(res.status).toBe(200);
    expect(res.body.from).toBe('2025-11');
    expect(res.body.to).toBe('2026-10');
    expect(res.body.points).toHaveLength(12);
    expect(res.body.points[0]).toEqual({
      month: '2025-11',
      totals: { income: '0.00', expenses: { total: '0.00', paid: '0.00', pending: '0.00' }, balance: { realized: '0.00', projected: '0.00' } },
    });
    expect(res.body.points[4].totals.income).toBe('1000.00');
    expect(res.body.points[11].totals.balance).toEqual({ realized: '1000.00', projected: '-500.00' });
  });

  it('CA59: o ultimo ponto e igual ao resumo do mesmo mes', async () => {
    await seedCa47();
    const summary = (await get('/api/summary', { month: '2026-10' })).body;
    const series = (await get('/api/dashboard/monthly-series', { month: '2026-10' })).body;
    expect(series.points.at(-1)).toEqual({ month: '2026-10', totals: summary.totals });
  });

  it('CA60: saldo previsto negativo, realizado positivo', async () => {
    await insertEntry(e.pool, { n: 1, type: 'INCOME', amount: '1000.00' });
    await insertEntry(e.pool, { n: 2, ...pending, amount: '1500.00' });
    const { totals } = (await get('/api/summary', { month: '2026-10' })).body;
    expect(totals.balance).toEqual({ realized: '1000.00', projected: '-500.00' });
  });

  it('CA63: compra de 10/09 com vencimento em outubro entra em outubro', async () => {
    await insertCard(e.pool, { n: 1 });
    await insertEntry(e.pool, cardEntry(1, 1, { date: '2026-09-10', closing: '2026-09-25', due: '2026-10-05', amount: '80.00' }));
    const points = (await get('/api/dashboard/monthly-series', { month: '2026-10' })).body.points;
    expect(points.at(-1).totals.expenses.pending).toBe('80.00');
    expect(points.at(-2).totals.expenses.pending).toBe('0.00');
    expect((await get('/api/summary', { month: '2026-10' })).body.totals.expenses.pending).toBe('80.00');
  });

  it.each([[{}], [{ month: '2026-13' }], [{ month: '2026-10', from: '2026-01' }]])('query %j -> 400', async (q) => {
    expect((await get('/api/dashboard/monthly-series', q as Record<string, string>)).status).toBe(400);
  });
});

describe('D3 GET /api/dashboard/category-distribution', () => {
  it('CA64: so despesas - Moradia 75.00 / Alimentacao 25.00, sem Salario', async () => {
    await insertEntry(e.pool, { n: 1, category: 'Moradia', amount: '1500.00' });
    await insertEntry(e.pool, { n: 2, category: 'Alimentação', amount: '500.00' });
    await insertEntry(e.pool, { n: 3, type: 'INCOME', category: 'Salário', amount: '5000.00' });
    const res = await get('/api/dashboard/category-distribution', { month: '2026-10' });
    expect(res.status).toBe(200);
    expect(res.body).toEqual({
      month: '2026-10',
      total: '2000.00',
      items: [
        { category: 'Moradia', total: '1500.00', percentage: '75.00' },
        { category: 'Alimentação', total: '500.00', percentage: '25.00' },
      ],
    });
  });

  it('CA65: mes sem despesas -> total "0.00" e items []', async () => {
    const res = await get('/api/dashboard/category-distribution', { month: '2026-10' });
    expect(res.body).toEqual({ month: '2026-10', total: '0.00', items: [] });
  });

  it.each([[{}], [{ month: 'x' }]])('query %j -> 400', async (q) => {
    expect((await get('/api/dashboard/category-distribution', q as Record<string, string>)).status).toBe(400);
  });
});

describe('erros gerais', () => {
  it('rota inexistente -> 404 ROUTE_NOT_FOUND no formato padrao', async () => {
    const res = await get('/api/nao-existe');
    expect(res.status).toBe(404);
    expect(res.body).toEqual({ code: 'ROUTE_NOT_FOUND', message: expect.any(String), details: expect.anything() });
  });

  it('rotas legadas removidas: GET /api/entries, C4 e /api/dashboard/summary -> 404', async () => {
    expect((await get('/api/entries', { month: '2026-10' })).status).toBe(404);
    expect((await get('/api/dashboard/summary', { month: '2026-10' })).status).toBe(404);
    await insertCard(e.pool, { n: 1 });
    expect((await get(`/api/cards/${cardUuid(1)}/invoices/2026-11`)).status).toBe(404);
  });
});

describe('erro inesperado', () => {
  it('500 INTERNAL_ERROR sem vazar detalhes nem stack', async () => {
    const broken = await startE2eApp(undefined, [
      { token: CATEGORY_READ_MODEL, value: { listDistinct: async () => { throw new Error('senha-do-banco: s3cr3t'); } } },
    ]);
    try {
      const res = await broken.http().get('/api/categories');
      expect(res.status).toBe(500);
      expect(res.body.code).toBe('INTERNAL_ERROR');
      expect(res.body.details).toBeNull();
      expect(JSON.stringify(res.body)).not.toMatch(/s3cr3t|senha|stack|at \S+\(/);
    } finally {
      await broken.close();
    }
  });
});
