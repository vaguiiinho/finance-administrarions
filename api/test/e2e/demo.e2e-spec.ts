import { CAST, bearer, idOf, startIdentityE2e, type IdentityE2e } from '../support/identity-e2e.js';
import { cardEntry, cardUuid, entryUuid, query } from '../support/db.js';
import { insertOwnedCard, insertOwnedEntry } from '../support/owned-db.js';
import { DEMO_USER_ID, FIRST_ADMIN_ID } from '@shared/domain/well-known-ids.js';

let e: IdentityE2e;
let ana: string;
beforeAll(async () => {
  e = await startIdentityE2e();
});
afterAll(() => e.close());

const MONTH = '2026-11';
const DEMO_CARD = 7;

/** Demo: cartao + 3 lancamentos reconheciveis. Ana, Bruno e o 1o admin: lancamentos com marcador SECRETO (nunca podem aparecer na demo). */
beforeEach(async () => {
  await e.resetAll();
  await e.seedUser({ n: 90, id: DEMO_USER_ID, kind: 'DEMO', name: 'Demonstração', email: 'demo@finance.invalid' });
  await e.seedUser(CAST.ana);
  await e.seedUser(CAST.bruno);
  await e.seedUser({ n: 91, id: FIRST_ADMIN_ID, name: 'Primeiro', email: 'primeiro@exemplo.com', role: 'ADMIN' });
  ana = await e.sessionFor(idOf(1));

  await insertOwnedCard(e.pool, DEMO_USER_ID, { n: DEMO_CARD, name: 'Cartao Demo', closingDay: 25, dueDay: 5 });
  await insertOwnedEntry(e.pool, DEMO_USER_ID, { n: 701, type: 'INCOME', amount: '7777.00', date: '2026-11-05', category: 'Salario Demo', description: 'Salario demo' });
  await insertOwnedEntry(e.pool, DEMO_USER_ID, { n: 702, amount: '333.00', date: '2026-11-07', category: 'Moradia Demo', status: 'PENDING', paidAt: null, description: 'Aluguel demo' });
  await insertOwnedEntry(e.pool, DEMO_USER_ID, cardEntry(703, DEMO_CARD, { date: '2026-10-10', closing: '2026-10-25', due: '2026-11-05', amount: '99.00', category: 'Lazer Demo', description: 'Cinema demo' }));

  for (const [uid, base, tag] of [[idOf(1), 100, 'ANA'], [idOf(2), 200, 'BRUNO'], [FIRST_ADMIN_ID, 300, 'ADMIN']] as const) {
    await insertOwnedCard(e.pool, uid, { n: base, name: `Cartao ${tag}-SECRETO` });
    await insertOwnedEntry(e.pool, uid, { n: base + 1, type: 'INCOME', amount: '1234.00', date: '2026-11-05', category: `${tag}-SECRETO`, description: `${tag}-SECRETO` });
    await insertOwnedEntry(e.pool, uid, { n: base + 2, amount: '4321.00', date: '2026-11-07', category: `${tag}-SECRETO`, description: `${tag}-SECRETO` });
    await insertOwnedEntry(e.pool, uid, cardEntry(base + 3, base, { date: '2026-10-10', closing: '2026-10-25', due: '2026-11-05', amount: '55.00', category: `${tag}-SECRETO`, description: `${tag}-SECRETO` }));
  }
});

const DEMO_READS = (month = MONTH) => [
  `/api/demo/entries/expenses?month=${month}`,
  `/api/demo/entries/incomes?month=${month}`,
  '/api/demo/categories',
  '/api/demo/cards',
  `/api/demo/invoices?month=${month}`,
  `/api/demo/cards/${cardUuid(DEMO_CARD)}/invoices/${month}/entries`,
  `/api/demo/summary?month=${month}`,
  `/api/demo/dashboard/monthly-series?month=${month}`,
  `/api/demo/dashboard/category-distribution?month=${month}`,
];
// Campos anulaveis (paidAt etc.) sao strings/datas ou null: null conta como 'string' para o contrato.
const shape = (v: unknown): unknown => {
  if (Array.isArray(v)) return v.length ? [shape(v[0])] : [];
  if (v && typeof v === 'object') return Object.fromEntries(Object.keys(v).sort().map((k) => [k, shape((v as Record<string, unknown>)[k])]));
  return v === null ? 'string' : typeof v;
};

describe('CA35 / RF29: leitura publica da demo', () => {
  it('as 9 leituras respondem 200 SEM credencial, so com dados do usuario demo', async () => {
    for (const path of DEMO_READS()) {
      const res = await e.http().get(path);
      expect(res.status, path).toBe(200);
    }
    const summary = await e.http().get(`/api/demo/summary?month=${MONTH}`);
    expect(summary.body.totals.income).toBe('7777.00');
    const expenses = await e.http().get(`/api/demo/entries/expenses?month=${MONTH}`);
    expect(JSON.stringify(expenses.body)).toContain('Aluguel demo');
  });

  it('mesmo contrato das leituras protegidas (mesmo formato de resposta)', async () => {
    const pairs: [string, string][] = [
      [`/api/demo/entries/expenses?month=${MONTH}`, `/api/entries/expenses?month=${MONTH}`],
      [`/api/demo/entries/incomes?month=${MONTH}`, `/api/entries/incomes?month=${MONTH}`],
      ['/api/demo/categories', '/api/categories'],
      ['/api/demo/cards', '/api/cards'],
      [`/api/demo/invoices?month=${MONTH}`, `/api/invoices?month=${MONTH}`],
      [`/api/demo/summary?month=${MONTH}`, `/api/summary?month=${MONTH}`],
      [`/api/demo/dashboard/monthly-series?month=${MONTH}`, `/api/dashboard/monthly-series?month=${MONTH}`],
      [`/api/demo/dashboard/category-distribution?month=${MONTH}`, `/api/dashboard/category-distribution?month=${MONTH}`],
    ];
    for (const [demo, real] of pairs) {
      const d = await e.http().get(demo);
      const r = await e.http().get(real).set(bearer(ana));
      expect(shape(d.body), demo).toEqual(shape(r.body));
    }
    const di = await e.http().get(`/api/demo/cards/${cardUuid(DEMO_CARD)}/invoices/${MONTH}/entries`);
    const ri = await e.http().get(`/api/cards/${cardUuid(100)}/invoices/${MONTH}/entries`).set(bearer(ana));
    expect(shape(di.body)).toEqual(shape(ri.body));
  });

  it('validacao continua valendo na demo: mes invalido -> 400 VALIDATION_ERROR', async () => {
    const res = await e.http().get('/api/demo/summary?month=invalido');
    expect(res.status).toBe(400);
    expect(res.body.code).toBe('VALIDATION_ERROR');
  });

  it('cartao inexistente, ou de outro usuario, na fatura da demo -> 404 CARD_NOT_FOUND', async () => {
    for (const id of [cardUuid(99), cardUuid(100)]) {
      const res = await e.http().get(`/api/demo/cards/${id}/invoices/${MONTH}/entries`);
      expect(res.status, id).toBe(404);
      expect(res.body.code).toBe('CARD_NOT_FOUND');
    }
  });

  it('logado, a demo continua mostrando os dados de exemplo (nao os dele)', async () => {
    const res = await e.http().get(`/api/demo/summary?month=${MONTH}`).set(bearer(ana));
    expect(res.body.totals.income).toBe('7777.00');
  });

  it('as rotas protegidas equivalentes continuam exigindo sessao', async () => {
    expect((await e.http().get(`/api/summary?month=${MONTH}`)).status).toBe(401);
  });
});

describe('CA59: GET /api/demo/invoices com status (ADR 0007 6.3)', () => {
  it('PENDING lista a fatura pendente da demo; PAID -> vazio; sem status -> igual a antes', async () => {
    const all = await e.http().get(`/api/demo/invoices?month=${MONTH}`);
    expect(all.body.items).toHaveLength(1);
    expect((await e.http().get(`/api/demo/invoices?month=${MONTH}&status=PENDING`)).body.items).toHaveLength(1);
    expect((await e.http().get(`/api/demo/invoices?month=${MONTH}&status=PAID`)).body.items).toEqual([]);
  });

  it('depois de quitada a fatura da demo (por SQL), PAID a lista e PENDING nao', async () => {
    await e.pool.query(`UPDATE entries SET status = 'PAID', paid_at = now() WHERE id = $1::uuid`, [entryUuid(703)]);
    expect((await e.http().get(`/api/demo/invoices?month=${MONTH}&status=PAID`)).body.items).toHaveLength(1);
    expect((await e.http().get(`/api/demo/invoices?month=${MONTH}&status=PENDING`)).body.items).toEqual([]);
  });

  it('status=ALL ou invalido -> 400 INVALID_VALUE tambem na demo; nunca mistura dados de usuarios', async () => {
    for (const status of ['ALL', 'pending']) {
      const res = await e.http().get(`/api/demo/invoices?month=${MONTH}&status=${status}`);
      expect(res.status, status).toBe(400);
      expect(res.body.details.fields[0]).toMatchObject({ field: 'status', code: 'INVALID_VALUE' });
    }
    const res = await e.http().get(`/api/demo/invoices?month=${MONTH}&status=PENDING`);
    expect(JSON.stringify(res.body)).not.toMatch(/SECRETO/);
  });
});

describe('CA36 / RF29: a demo nao aceita escrita', () => {
  const paths = [
    '/api/demo/entries',
    '/api/demo/entries/pay',
    `/api/demo/entries/${entryUuid(702)}/pay`,
    '/api/demo/cards',
    `/api/demo/cards/${cardUuid(DEMO_CARD)}`,
    `/api/demo/cards/${cardUuid(DEMO_CARD)}/invoices/${MONTH}/pay`,
    '/api/demo/summary',
    '/api/demo/invoices',
  ];
  const dump = async () => JSON.stringify([await query(e.pool, 'SELECT * FROM cards ORDER BY id'), await query(e.pool, 'SELECT * FROM entries ORDER BY id')]);

  it.each(['post', 'put', 'patch', 'delete'] as const)('%s em qualquer caminho de demo -> 404 ROUTE_NOT_FOUND, sem token e com token; nada muda', async (method) => {
    const before = await dump();
    for (const token of [undefined, ana]) {
      for (const path of paths) {
        const req = (e.http() as any)[method](path);
        if (token) req.set(bearer(token));
        const res = await req.send({ ids: [entryUuid(702)], name: 'X', closingDay: 1, dueDay: 2 });
        expect(res.status, `${method} ${path}`).toBe(404);
        expect(res.body.code, `${method} ${path}`).toBe('ROUTE_NOT_FOUND');
      }
    }
    expect(await dump()).toBe(before);
  });
});

describe('CA37 / RNF06: a demo nao vaza dados de usuarios', () => {
  it('percorrendo todas as leituras, em varios meses e filtros, nenhum marcador de Ana, Bruno ou do 1o admin aparece', async () => {
    const bodies: unknown[] = [];
    for (const month of ['2026-09', '2026-10', '2026-11', '2026-12']) {
      for (const path of DEMO_READS(month)) {
        const res = await e.http().get(path);
        expect([200, 404], path).toContain(res.status);
        bodies.push(res.body);
      }
    }
    for (const extra of [
      `/api/demo/entries/expenses?month=${MONTH}&status=PENDING`,
      `/api/demo/entries/expenses?month=${MONTH}&cardId=${cardUuid(100)}`,
      `/api/demo/entries/expenses?month=${MONTH}&category=${encodeURIComponent('ANA-SECRETO')}`,
      `/api/demo/entries/incomes?month=${MONTH}&category=${encodeURIComponent('BRUNO-SECRETO')}`,
      `/api/demo/entries/expenses?month=${MONTH}&page=1&pageSize=100`,
    ]) {
      const res = await e.http().get(extra);
      expect(res.status, extra).toBe(200);
      bodies.push(res.body);
    }
    const text = JSON.stringify(bodies);
    expect(text).not.toMatch(/SECRETO/);
    for (const id of [idOf(1), idOf(2), FIRST_ADMIN_ID, entryUuid(101), entryUuid(201), entryUuid(301), cardUuid(100), cardUuid(200), cardUuid(300), '1234.00', '4321.00']) {
      expect(text, id).not.toContain(id);
    }
    expect(text).toContain('Cinema demo');
  });
});
