import { CAST, bearer, idOf, listRoutes, startIdentityE2e, type IdentityE2e } from '../support/identity-e2e.js';
import { cardEntry, cardUuid } from '../support/db.js';
import { insertOwnedCard, insertOwnedEntry } from '../support/owned-db.js';

/**
 * Remocao da demonstracao publica (ADR 0013 6.1; RF01, CA01, CA02) e ausencia de rota HTTP para a rotina (RF17, CA25).
 * Dados reais no banco provam que nada e devolvido: a resposta e 404 ROUTE_NOT_FOUND, com ou sem Bearer.
 */
let e: IdentityE2e;
let ana: string;
beforeAll(async () => {
  e = await startIdentityE2e();
});
afterAll(() => e.close());

const MONTH = '2026-11';
beforeEach(async () => {
  await e.resetAll();
  await e.seedUser(CAST.ana);
  ana = await e.sessionFor(idOf(1));
  await insertOwnedCard(e.pool, idOf(1), { n: 7, name: 'Cartao SECRETO', closingDay: 25, dueDay: 5 });
  await insertOwnedEntry(e.pool, idOf(1), { n: 701, type: 'INCOME', amount: '7777.00', date: '2026-11-05', category: 'Salario SECRETO', description: 'Salario SECRETO' });
  await insertOwnedEntry(e.pool, idOf(1), { n: 702, amount: '333.00', date: '2026-11-07', category: 'Moradia', description: 'Aluguel SECRETO' });
  await insertOwnedEntry(e.pool, idOf(1), cardEntry(703, 7, { date: '2026-10-10', closing: '2026-10-25', due: '2026-11-05', amount: '99.00', description: 'Cinema SECRETO' }));
});

const DEMO_PATHS = [
  '/api/demo/entries/initial-month',
  `/api/demo/entries/expenses?month=${MONTH}`,
  `/api/demo/entries/incomes?month=${MONTH}`,
  '/api/demo/categories',
  '/api/demo/cards',
  `/api/demo/invoices?month=${MONTH}`,
  `/api/demo/cards/${cardUuid(7)}/invoices/${MONTH}/entries`,
  `/api/demo/summary?month=${MONTH}`,
  `/api/demo/dashboard/monthly-series?month=${MONTH}`,
  `/api/demo/dashboard/category-distribution?month=${MONTH}`,
  '/api/demo',
  '/api/demo/',
  '/api/demo/qualquer/coisa',
];

describe('CA01: as rotas /api/demo/* nao existem mais', () => {
  it.each(DEMO_PATHS)('GET %s sem credencial -> 404 ROUTE_NOT_FOUND no formato { code, message, details } e nenhum dado financeiro', async (path) => {
    const res = await e.http().get(path);
    expect(res.status).toBe(404);
    expect(res.body).toMatchObject({ code: 'ROUTE_NOT_FOUND', message: expect.any(String) });
    expect(res.body).toHaveProperty('details');
    expect(JSON.stringify(res.body)).not.toMatch(/SECRETO|7777|333|Moradia/);
  });

  it.each(DEMO_PATHS)('GET %s com Bearer valido -> o mesmo 404 ROUTE_NOT_FOUND', async (path) => {
    const res = await e.http().get(path).set(bearer(ana));
    expect(res.status).toBe(404);
    expect(res.body.code).toBe('ROUTE_NOT_FOUND');
    expect(JSON.stringify(res.body)).not.toMatch(/SECRETO/);
  });

  it('com Bearer invalido tambem 404 (a rota nao existe, nao ha guarda a acionar)', async () => {
    const res = await e.http().get('/api/demo/summary?month=2026-11').set(bearer('token-invalido'));
    expect(res.status).toBe(404);
    expect(res.body.code).toBe('ROUTE_NOT_FOUND');
  });

  it('nenhuma rota registrada no Express comeca com /api/demo (nem DemoController)', () => {
    const demoRoutes = listRoutes(e.app).filter((r) => r.path.startsWith('/api/demo'));
    expect(demoRoutes).toEqual([]);
  });

  it('RNF05: a superficie sem autenticacao e so login e logout (nenhuma rota publica nova de leitura)', async () => {
    const res = await e.http().get('/api/summary?month=2026-11');
    expect(res.status).toBe(401);
    expect(res.body.code).toBe('UNAUTHENTICATED');
  });
});

describe('CA02: as rotas protegidas continuam iguais (so os dados do proprio usuario)', () => {
  it('GET /api/entries/expenses e GET /api/summary respondem 200 com os dados da Ana', async () => {
    const expenses = await e.http().get(`/api/entries/expenses?month=${MONTH}`).set(bearer(ana));
    expect(expenses.status).toBe(200);
    expect(JSON.stringify(expenses.body)).toContain('Aluguel SECRETO');
    const summary = await e.http().get(`/api/summary?month=${MONTH}`).set(bearer(ana));
    expect(summary.status).toBe(200);
    expect(summary.body.totals.income).toBe('7777.00');
  });

  it('as demais leituras protegidas seguem 200', async () => {
    for (const path of ['/api/categories', '/api/cards', `/api/invoices?month=${MONTH}`, `/api/dashboard/monthly-series?month=${MONTH}`, `/api/dashboard/category-distribution?month=${MONTH}`, '/api/entries/initial-month']) {
      expect((await e.http().get(path).set(bearer(ana))).status, path).toBe(200);
    }
  });
});

describe('CA25: nao existe rota HTTP para disparar a rotina da conta demo (RF17, RNF05)', () => {
  const PATHS = [
    '/api/maintenance',
    '/api/maintenance/reset-demo-account',
    '/api/maintenance/demo-reset',
    '/api/admin/demo-reset',
    '/api/admin/maintenance/reset-demo-account',
    '/api/admin/showcase/reset',
    '/api/showcase/reset',
    '/api/internal/demo/reset',
  ];
  it.each(PATHS)('GET e POST %s sem sessao -> 404 ROUTE_NOT_FOUND', async (path) => {
    for (const method of ['get', 'post'] as const) {
      const res = await (e.http() as any)[method](path).send({});
      expect(res.status, `${method} ${path}`).toBe(404);
      expect(res.body.code).toBe('ROUTE_NOT_FOUND');
    }
  });

  it.each(PATHS)('GET e POST %s com sessao de usuario comum -> 404 ROUTE_NOT_FOUND', async (path) => {
    for (const method of ['get', 'post'] as const) {
      const res = await (e.http() as any)[method](path).set(bearer(ana)).send({});
      expect(res.status, `${method} ${path}`).toBe(404);
      expect(res.body.code).toBe('ROUTE_NOT_FOUND');
    }
  });

  it('com sessao de administrador tambem 404: nenhuma rota de manutencao ou reset de demo existe', async () => {
    await e.seedUser(CAST.vagner);
    const adminToken = await e.sessionFor(idOf(4));
    for (const path of PATHS) {
      const res = await e.http().post(path).set(bearer(adminToken)).send({});
      expect(res.status, path).toBe(404);
    }
  });

  it('nenhuma rota registrada menciona maintenance, reset ou demo', () => {
    const offenders = listRoutes(e.app).filter((r) => /maintenance|demo|showcase|reset/i.test(r.path) && !/password-reset/.test(r.path));
    expect(offenders).toEqual([]);
  });
});
