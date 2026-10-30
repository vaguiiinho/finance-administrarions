import { CAST, bearer, idOf, startIdentityE2e, type IdentityE2e } from '../support/identity-e2e.js';
import { cardEntry, cardUuid, entryUuid, query } from '../support/db.js';
import { insertOwnedCard, insertOwnedEntry } from '../support/owned-db.js';

let e: IdentityE2e;
let ana: string;
let bruno: string;
let vagner: string;
beforeAll(async () => {
  e = await startIdentityE2e();
});
afterAll(() => e.close());
beforeEach(async () => {
  await e.resetAll();
  await e.seedUser(CAST.ana);
  await e.seedUser(CAST.bruno);
  await e.seedUser(CAST.vagner);
  ana = await e.sessionFor(idOf(1));
  bruno = await e.sessionFor(idOf(2));
  vagner = await e.sessionFor(idOf(4));
});

const get = (t: string, p: string) => e.http().get(p).set(bearer(t));
const post = (t: string, p: string, b: object = {}) => e.http().post(p).set(bearer(t)).send(b);
const put = (t: string, p: string, b: object) => e.http().put(p).set(bearer(t)).send(b);
const MONTH = '2026-11';

/** Ana: receita 5000, despesa PIX paga 600. Bruno: receita 123.45, despesa 50, cartao Itau (c=2) com fatura 70 pendente (e=13). */
async function seedBoth() {
  await insertOwnedCard(e.pool, idOf(2), { n: 2, name: 'Itau', closingDay: 25, dueDay: 5 });
  await insertOwnedEntry(e.pool, idOf(1), { n: 1, type: 'INCOME', amount: '5000.00', date: '2026-11-05', category: 'Salario' });
  await insertOwnedEntry(e.pool, idOf(1), { n: 2, amount: '600.00', date: '2026-11-07', category: 'Moradia' });
  await insertOwnedEntry(e.pool, idOf(2), { n: 11, type: 'INCOME', amount: '123.45', date: '2026-11-05', category: 'Bonus' });
  await insertOwnedEntry(e.pool, idOf(2), { n: 12, amount: '50.00', date: '2026-11-07', category: 'Mercado' });
  await insertOwnedEntry(e.pool, idOf(2), cardEntry(13, 2, { date: '2026-10-10', closing: '2026-10-25', due: '2026-11-05', amount: '70.00', category: 'Viagem' }));
}

describe('CA28 / RF23: dono atribuido na criacao', () => {
  it('cartao e despesa criados por Ana pertencem a Ana; a resposta nao traz dono', async () => {
    const card = await post(ana, '/api/cards', { name: 'Nubank', closingDay: 25, dueDay: 5 });
    expect(card.status).toBe(201);
    const entry = await post(ana, '/api/entries', { type: 'EXPENSE', description: 'Aluguel', category: 'Moradia', date: '2026-11-05', amount: '1500.00', paymentMethod: 'PIX' });
    expect(entry.status).toBe(201);
    expect((await query<{ user_id: string }>(e.pool, 'SELECT user_id FROM cards'))[0].user_id).toBe(idOf(1));
    expect((await query<{ user_id: string }>(e.pool, 'SELECT user_id FROM entries'))[0].user_id).toBe(idOf(1));
    expect(JSON.stringify([card.body, entry.body])).not.toMatch(/userId|ownerId|user_id/);
  });

  it('userId no corpo -> 400 UNKNOWN_FIELD em userId (cartao e lancamento); nada criado', async () => {
    const card = await post(ana, '/api/cards', { name: 'X', closingDay: 1, dueDay: 2, userId: idOf(2) });
    const entry = await post(ana, '/api/entries', { type: 'EXPENSE', description: 'X', category: 'C', date: '2026-11-05', amount: '1.00', paymentMethod: 'PIX', userId: idOf(2) });
    for (const res of [card, entry]) {
      expect(res.status).toBe(400);
      expect(res.body.details.fields).toContainEqual(expect.objectContaining({ field: 'userId', code: 'UNKNOWN_FIELD' }));
    }
    expect(await query(e.pool, 'SELECT 1 FROM cards')).toHaveLength(0);
    expect(await query(e.pool, 'SELECT 1 FROM entries')).toHaveLength(0);
  });
});

describe('CA29 / RF24: leituras e agregados isolados', () => {
  it('Ana ve income 5000.00 e expenses.total 600.00; Bruno ve os dele', async () => {
    await seedBoth();
    const a = await get(ana, `/api/summary?month=${MONTH}`);
    expect(a.body.totals.income).toBe('5000.00');
    expect(a.body.totals.expenses.total).toBe('600.00');
    const b = await get(bruno, `/api/summary?month=${MONTH}`);
    expect(b.body.totals.income).toBe('123.45');
    expect(b.body.totals.expenses.total).toBe('120.00');
  });

  it('despesas, receitas, faturas, cartoes, categorias e dashboard de Ana nao contem nada de Bruno', async () => {
    await seedBoth();
    const responses = await Promise.all([
      get(ana, `/api/entries/expenses?month=${MONTH}`),
      get(ana, `/api/entries/incomes?month=${MONTH}`),
      get(ana, `/api/invoices?month=${MONTH}`),
      get(ana, '/api/cards'),
      get(ana, '/api/categories'),
      get(ana, `/api/dashboard/monthly-series?month=${MONTH}`),
      get(ana, `/api/dashboard/category-distribution?month=${MONTH}`),
    ]);
    for (const r of responses) expect(r.status).toBe(200);
    const text = JSON.stringify(responses.map((r) => r.body));
    for (const secret of ['Itau', 'Bonus', 'Mercado', 'Viagem', '123.45', '"50.00"', '70.00', entryUuid(11), entryUuid(12), entryUuid(13), cardUuid(2)]) {
      expect(text, secret).not.toContain(secret);
    }
    expect(JSON.stringify(responses[4].body)).toContain('Moradia');
    expect(responses[3].body.items).toEqual([]);
  });

  it('filtro cardId com cartao de OUTRO dono -> 200 lista vazia (igual cartao inexistente)', async () => {
    await seedBoth();
    const other = await get(ana, `/api/entries/expenses?month=${MONTH}&cardId=${cardUuid(2)}`);
    const missing = await get(ana, `/api/entries/expenses?month=${MONTH}&cardId=${cardUuid(99)}`);
    expect(other.status).toBe(200);
    expect(other.body.items).toEqual([]);
    expect(other.body).toEqual(missing.body);
  });
});

describe('CA30 / RF25: recurso de outro dono e inexistente (404)', () => {
  beforeEach(seedBoth);
  const dbState = async () => JSON.stringify([await query(e.pool, 'SELECT * FROM cards ORDER BY id'), await query(e.pool, 'SELECT * FROM entries ORDER BY id')]);

  it('PUT /api/cards/:id, POST /api/entries com cardId, POST /api/entries/:id/pay, faturas -> 404 iguais aos de id inexistente; nada muda', async () => {
    const before = await dbState();
    const cases: [string, (id: string, l: string) => Promise<any>, string, string][] = [
      ['PUT card', (c) => put(ana, `/api/cards/${c}`, { name: 'Hack', closingDay: 1, dueDay: 2 }), cardUuid(2), 'CARD_NOT_FOUND'],
      [
        'POST entry com cardId',
        (c) => post(ana, '/api/entries', { type: 'EXPENSE', description: 'X', category: 'C', date: '2026-11-05', amount: '1.00', paymentMethod: 'CARD', cardId: c }),
        cardUuid(2),
        'CARD_NOT_FOUND',
      ],
      ['POST pay', (l) => post(ana, `/api/entries/${l}/pay`), entryUuid(13), 'ENTRY_NOT_FOUND'],
      ['GET fatura', (c) => get(ana, `/api/cards/${c}/invoices/${MONTH}/entries`), cardUuid(2), 'CARD_NOT_FOUND'],
      ['POST fatura pay', (c) => post(ana, `/api/cards/${c}/invoices/${MONTH}/pay`), cardUuid(2), 'CARD_NOT_FOUND'],
    ];
    for (const [name, run, foreignId, code] of cases) {
      const foreign = await run(foreignId, foreignId);
      const missingId = code === 'ENTRY_NOT_FOUND' ? entryUuid(999) : cardUuid(999);
      const missing = await run(missingId, missingId);
      expect(foreign.status, name).toBe(404);
      expect(foreign.body.code, name).toBe(code);
      expect(foreign.body.message, name).toBe(missing.body.message);
      expect(Object.keys(foreign.body.details), name).toEqual(Object.keys(missing.body.details));
    }
    expect(await dbState()).toBe(before);
  });

  it('administrador contra recurso de usuario comum tambem e 404 (CA25)', async () => {
    expect((await get(vagner, `/api/cards/${cardUuid(2)}/invoices/${MONTH}/entries`)).body.code).toBe('CARD_NOT_FOUND');
    expect((await post(vagner, `/api/entries/${entryUuid(13)}/pay`)).body.code).toBe('ENTRY_NOT_FOUND');
  });

  it('o dono continua conseguindo: Bruno paga a fatura dele', async () => {
    const res = await post(bruno, `/api/cards/${cardUuid(2)}/invoices/${MONTH}/pay`);
    expect(res.status).toBe(200);
    expect((await query<{ status: string }>(e.pool, `SELECT status FROM entries WHERE id = $1`, [entryUuid(13)]))[0].status).toBe('PAID');
  });
});

describe('CA31 / RF25: lote com ids de outro dono', () => {
  it('ids [A1, B1] -> 404 ENTRIES_NOT_FOUND com missingIds [B1]; nenhum pago', async () => {
    await insertOwnedEntry(e.pool, idOf(1), { n: 1, status: 'PENDING', paidAt: null });
    await insertOwnedEntry(e.pool, idOf(2), { n: 2, status: 'PENDING', paidAt: null });
    const res = await post(ana, '/api/entries/pay', { ids: [entryUuid(1), entryUuid(2)] });
    expect(res.status).toBe(404);
    expect(res.body).toMatchObject({ code: 'ENTRIES_NOT_FOUND', details: { missingIds: [entryUuid(2)] } });
    expect((await query<{ status: string }>(e.pool, 'SELECT status FROM entries ORDER BY id')).map((r) => r.status)).toEqual(['PENDING', 'PENDING']);
  });
});

describe('CA32 / CA33 / RF26: unicidade e categoria canonica por usuario', () => {
  it('CA32: Bruno tem "Nubank"; Ana cria "nubank" (201); "NUBANK" de novo -> 409 CARD_NAME_TAKEN', async () => {
    expect((await post(bruno, '/api/cards', { name: 'Nubank', closingDay: 25, dueDay: 5 })).status).toBe(201);
    expect((await post(ana, '/api/cards', { name: 'nubank', closingDay: 25, dueDay: 5 })).status).toBe(201);
    const dup = await post(ana, '/api/cards', { name: 'NUBANK', closingDay: 25, dueDay: 5 });
    expect(dup.status).toBe(409);
    expect(dup.body.code).toBe('CARD_NAME_TAKEN');
  });

  it('CA33: a grafia canonica e de cada usuario; /api/categories mostra so a propria', async () => {
    const entry = (token: string, category: string) =>
      post(token, '/api/entries', { type: 'EXPENSE', description: 'Mercado', category, date: '2026-11-05', amount: '10.00', paymentMethod: 'PIX' });
    expect((await entry(bruno, 'alimentação')).body.category).toBe('alimentação');
    expect((await entry(ana, 'Alimentação')).body.category).toBe('Alimentação');
    expect((await entry(ana, 'ALIMENTAÇÃO')).body.category).toBe('Alimentação');
    expect((await get(ana, '/api/categories')).body.items).toEqual(['Alimentação']);
    expect((await get(bruno, '/api/categories')).body.items).toEqual(['alimentação']);
  });
});
