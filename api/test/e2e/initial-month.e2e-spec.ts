import { CAST, bearer, idOf, startIdentityE2e, type IdentityE2e } from '../support/identity-e2e.js';
import { startFinanceE2e } from '../support/finance-e2e.js';
import { cardEntry } from '../support/db.js';
import { insertOwnedCard, insertOwnedEntry } from '../support/owned-db.js';
import { DEMO_USER_ID } from '@shared/domain/well-known-ids.js';
import { PENDING_OVERVIEW_READ_MODEL } from '@finance/application/ports/pending-overview-read-model.js';

/**
 * GET /api/entries/initial-month (protegida) e GET /api/demo/entries/initial-month (publica): ADR 0007 6.1.
 * Relogio controlado (FixedClock): por padrao 2026-10-05T13:00Z, ou seja, M = 2026-10 em America/Sao_Paulo.
 */
let e: IdentityE2e;
let ana: string;
let bruno: string;
beforeAll(async () => {
  e = await startIdentityE2e();
});
afterAll(() => e.close());
beforeEach(async () => {
  e.clock.set(new Date('2026-10-05T13:00:00.000Z'));
  await e.resetAll();
  await e.seedUser({ n: 90, id: DEMO_USER_ID, kind: 'DEMO', name: 'Demonstração', email: 'demo@finance.invalid' });
  await e.seedUser(CAST.ana);
  await e.seedUser(CAST.bruno);
  ana = await e.sessionFor(idOf(1));
  bruno = await e.sessionFor(idOf(2));
});

const ANA = idOf(1);
const BRUNO = idOf(2);
const ROUTE = '/api/entries/initial-month';
const DEMO_ROUTE = '/api/demo/entries/initial-month';
const as = (token: string, path = ROUTE) => e.http().get(path).set(bearer(token));
const pendingPix = (owner: string, n: number, date: string) => insertOwnedEntry(e.pool, owner, { n, date, status: 'PENDING', paidAt: null });
const paidPix = (owner: string, n: number, date: string) => insertOwnedEntry(e.pool, owner, { n, date });
const card = (owner: string, n: number, name = `Cartao ${n}`) => insertOwnedCard(e.pool, owner, { n, name, closingDay: 25, dueDay: 5 });

describe('GET /api/entries/initial-month - contrato (ADR 0007 6.1)', () => {
  it('200 com { currentMonth, month, advance } e SEM outros campos', async () => {
    await card(ANA, 1);
    await pendingPix(ANA, 1, '2026-10-20');
    const res = await as(ana);
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ currentMonth: '2026-10', month: '2026-10', advance: 'NONE' });
  });

  it('CA01/CA09: pendencia em M (fatura ou PIX) mantem M, advance NONE', async () => {
    await card(ANA, 1);
    await insertOwnedEntry(e.pool, ANA, cardEntry(1, 1, { date: '2026-09-12', closing: '2026-09-25', due: '2026-10-05' }));
    await insertOwnedEntry(e.pool, ANA, cardEntry(2, 1, { date: '2026-10-26', closing: '2026-11-25', due: '2026-12-05' }));
    expect((await as(ana)).body).toEqual({ currentMonth: '2026-10', month: '2026-10', advance: 'NONE' });
  });

  it('CA02/CA08: com cartao e sem nenhuma pendencia -> M+1 e NO_PENDING_AHEAD', async () => {
    await card(ANA, 1);
    await paidPix(ANA, 1, '2026-10-02');
    expect((await as(ana)).body).toEqual({ currentMonth: '2026-10', month: '2026-11', advance: 'NO_PENDING_AHEAD' });
  });

  it('CA06/CA10: salta direto ate o primeiro mes futuro com pendencia (PIX conta)', async () => {
    await card(ANA, 1);
    await pendingPix(ANA, 1, '2026-12-10');
    await pendingPix(ANA, 2, '2027-03-10');
    expect((await as(ana)).body).toEqual({ currentMonth: '2026-10', month: '2026-12', advance: 'NEXT_PENDING' });
  });

  it('CA05: fatura ainda ABERTA (fecha 10/10, hoje 05/10) com compra pendente conta como pendencia -> M, NONE', async () => {
    await card(ANA, 1);
    await insertOwnedEntry(e.pool, ANA, cardEntry(1, 1, { date: '2026-10-04', closing: '2026-10-10', due: '2026-10-17' }));
    expect((await as(ana)).body).toEqual({ currentMonth: '2026-10', month: '2026-10', advance: 'NONE' });
  });

  it('CA11: sem cartao e sem pendencia -> M, NONE', async () => {
    await paidPix(ANA, 1, '2026-10-02');
    expect((await as(ana)).body).toEqual({ currentMonth: '2026-10', month: '2026-10', advance: 'NONE' });
  });

  it('CA13: sem cartao com PIX pendente futuro -> avanca', async () => {
    await pendingPix(ANA, 1, '2026-12-10');
    expect((await as(ana)).body).toEqual({ currentMonth: '2026-10', month: '2026-12', advance: 'NEXT_PENDING' });
  });

  it('CA14: PIX pendente de mes anterior nao interfere', async () => {
    await card(ANA, 1);
    await pendingPix(ANA, 1, '2026-09-10');
    expect((await as(ana)).body).toMatchObject({ month: '2026-11', advance: 'NO_PENDING_AHEAD' });
  });

  it('RFH01: fatura pendente mais antiga abre no mes de referencia, mesmo anterior a M', async () => {
    e.clock.set(new Date('2026-11-05T13:00:00.000Z'));
    ana = await e.sessionFor(ANA);
    await insertOwnedCard(e.pool, ANA, { n: 1, closingDay: 4, dueDay: 11 });
    await insertOwnedEntry(e.pool, ANA, cardEntry(1, 1, { date: '2026-09-20', closing: '2026-10-04', due: '2026-10-11' }));
    await insertOwnedEntry(e.pool, ANA, cardEntry(2, 1, { date: '2026-10-20', closing: '2026-11-04', due: '2026-11-11' }));
    await pendingPix(ANA, 3, '2026-09-15');
    expect((await as(ana)).body).toEqual({ currentMonth: '2026-11', month: '2026-10', advance: 'NONE' });
  });

  it('o resultado e leitura pura: nenhuma escrita (mesmas linhas antes e depois)', async () => {
    await card(ANA, 1);
    await pendingPix(ANA, 1, '2026-12-10');
    const dump = async () => JSON.stringify((await e.pool.query('SELECT * FROM entries ORDER BY id')).rows) + JSON.stringify((await e.pool.query('SELECT * FROM cards ORDER BY id')).rows);
    const before = await dump();
    await as(ana);
    expect(await dump()).toBe(before);
  });
});

describe('GET /api/entries/initial-month - relogio de negocio em America/Sao_Paulo (CA15-CA20)', () => {
  it('CA18: 2026-11-01T02:30Z (31/10 23:30 em SP): com pendencia em 2026-10 -> outubro; sem nenhuma -> novembro', async () => {
    e.clock.set(new Date('2026-11-01T02:30:00.000Z'));
    ana = await e.sessionFor(ANA); // a sessao do beforeEach expira em 24h do relogio original
    await card(ANA, 1);
    await pendingPix(ANA, 1, '2026-10-20');
    expect((await as(ana)).body).toEqual({ currentMonth: '2026-10', month: '2026-10', advance: 'NONE' });
    await e.pool.query(`UPDATE entries SET status = 'PAID', paid_at = now()`);
    expect((await as(ana)).body).toEqual({ currentMonth: '2026-10', month: '2026-11', advance: 'NO_PENDING_AHEAD' });
  });

  it('CA19: 2026-11-01T03:30Z (01/11 00:30 em SP): M = novembro; pendencia so em outubro -> dezembro', async () => {
    e.clock.set(new Date('2026-11-01T03:30:00.000Z'));
    ana = await e.sessionFor(ANA); // a sessao do beforeEach expira em 24h do relogio original
    await card(ANA, 1);
    await pendingPix(ANA, 1, '2026-10-20');
    expect((await as(ana)).body).toEqual({ currentMonth: '2026-11', month: '2026-12', advance: 'NO_PENDING_AHEAD' });
    await pendingPix(ANA, 2, '2026-11-02');
    expect((await as(ana)).body).toEqual({ currentMonth: '2026-11', month: '2026-11', advance: 'NONE' });
  });

  it('CA20: 2027-01-01T02:30Z (31/12 23:30 em SP): dezembro com pendencia; sem nenhuma -> janeiro de 2027', async () => {
    e.clock.set(new Date('2027-01-01T02:30:00.000Z'));
    ana = await e.sessionFor(ANA); // a sessao do beforeEach expira em 24h do relogio original
    await card(ANA, 1);
    await pendingPix(ANA, 1, '2026-12-20');
    expect((await as(ana)).body).toEqual({ currentMonth: '2026-12', month: '2026-12', advance: 'NONE' });
    await e.pool.query(`UPDATE entries SET status = 'PAID', paid_at = now()`);
    expect((await as(ana)).body).toEqual({ currentMonth: '2026-12', month: '2027-01', advance: 'NO_PENDING_AHEAD' });
  });

  it('CA15/CA16: virada de ano com a proxima pendencia e com salto de varios meses', async () => {
    e.clock.set(new Date('2026-12-15T15:00:00.000Z'));
    ana = await e.sessionFor(ANA); // a sessao do beforeEach expira em 24h do relogio original
    await pendingPix(ANA, 1, '2027-01-10');
    expect((await as(ana)).body).toEqual({ currentMonth: '2026-12', month: '2027-01', advance: 'NEXT_PENDING' });
    e.clock.set(new Date('2026-11-20T15:00:00.000Z'));
    await e.pool.query(`UPDATE entries SET "date" = '2027-02-10', reference_month = '2027-02-01'`);
    expect((await as(ana)).body).toEqual({ currentMonth: '2026-11', month: '2027-02', advance: 'NEXT_PENDING' });
  });
});

describe('GET /api/entries/initial-month - isolamento (CA23, RNF04)', () => {
  it('Ana (cartao, sem pendencia) abre em novembro; Bruno (pendencia em out e dez) abre em outubro', async () => {
    await card(ANA, 1);
    await card(BRUNO, 2);
    await pendingPix(BRUNO, 10, '2026-10-10');
    await pendingPix(BRUNO, 11, '2026-12-10');
    expect((await as(ana)).body).toEqual({ currentMonth: '2026-10', month: '2026-11', advance: 'NO_PENDING_AHEAD' });
    expect((await as(bruno)).body).toEqual({ currentMonth: '2026-10', month: '2026-10', advance: 'NONE' });
  });

  it('o cartao de outro usuario nao conta como "tem cartao"', async () => {
    await card(BRUNO, 2);
    expect((await as(ana)).body).toMatchObject({ month: '2026-10', advance: 'NONE' });
  });
});

describe('GET /api/entries/initial-month - erros no formato { code, message, details }', () => {
  it('400 VALIDATION_ERROR / UNKNOWN_FIELD para qualquer parametro de query', async () => {
    for (const query of ['?month=2026-10', '?foo=1']) {
      const res = await e.http().get(`${ROUTE}${query}`).set(bearer(ana));
      expect(res.status, query).toBe(400);
      expect(res.body.code).toBe('VALIDATION_ERROR');
      expect(res.body.details.fields[0]).toMatchObject({ code: 'UNKNOWN_FIELD' });
    }
  });

  it('401 UNAUTHENTICATED sem credencial, com token invalido e com sessao expirada', async () => {
    const expired = await e.sessionFor(idOf(1), { createdAtOffsetMs: -25 * 3_600_000, expiresAtOffsetMs: -3_600_000 });
    for (const token of [undefined, 'nao-e-um-token', expired]) {
      const req = e.http().get(ROUTE).set('X-Forwarded-For', e.freshIp());
      const res = await (token ? req.set(bearer(token)) : req);
      expect(res.status).toBe(401);
      expect(res.body).toEqual({ code: 'UNAUTHENTICATED', message: expect.any(String), details: null });
    }
  });

  it('403 PASSWORD_CHANGE_REQUIRED enquanto a troca de senha estiver pendente', async () => {
    await e.seedUser(CAST.carla);
    const carla = await e.sessionFor(idOf(3));
    const res = await e.http().get(ROUTE).set(bearer(carla));
    expect(res.status).toBe(403);
    expect(res.body.code).toBe('PASSWORD_CHANGE_REQUIRED');
  });

  it('a rota de mes inicial so aceita GET; mutacoes nao alcançam dados (rotas genericas de entrada exigem ADMIN)', async () => {
    for (const method of ['post', 'patch'] as const) {
      const protectedRes = await (e.http() as any)[method](ROUTE).set(bearer(ana)).send({});
      expect(protectedRes.status, `${method} ${ROUTE}`).toBe(404);
      expect(protectedRes.body.code).toBe('ROUTE_NOT_FOUND');
      const demoRes = await (e.http() as any)[method](DEMO_ROUTE).set(bearer(ana)).send({});
      expect(demoRes.status, `${method} ${DEMO_ROUTE}`).toBe(404);
      expect(demoRes.body.code).toBe('ROUTE_NOT_FOUND');
    }
    for (const method of ['put', 'delete'] as const) {
      const protectedRes = await (e.http() as any)[method](ROUTE).set(bearer(ana)).send({});
      expect(protectedRes.status, `${method} ${ROUTE}`).toBe(403);
      expect(protectedRes.body.code).toBe('FORBIDDEN');
      const demoRes = await (e.http() as any)[method](DEMO_ROUTE).set(bearer(ana)).send({});
      expect(demoRes.status, `${method} ${DEMO_ROUTE}`).toBe(404);
      expect(demoRes.body.code).toBe('ROUTE_NOT_FOUND');
    }
  });
});

describe('GET /api/demo/entries/initial-month - leitura publica (CA24, RNF04)', () => {
  it('200 sem credencial, com o mesmo formato; usa so os dados do usuario demo', async () => {
    await card(DEMO_USER_ID, 7, 'Cartao Demo');
    await insertOwnedEntry(e.pool, DEMO_USER_ID, { n: 701, date: '2026-10-07', status: 'PENDING', paidAt: null, description: 'Internet demo' });
    const res = await e.http().get(DEMO_ROUTE);
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ currentMonth: '2026-10', month: '2026-10', advance: 'NONE' });
  });

  it('nao vaza dados de usuarios: pendencia de Ana/Bruno nao muda o mes da demo', async () => {
    await card(DEMO_USER_ID, 7, 'Cartao Demo');
    await paidPix(DEMO_USER_ID, 701, '2026-10-02');
    await card(ANA, 1);
    await pendingPix(ANA, 1, '2026-10-20');
    await pendingPix(BRUNO, 2, '2026-12-20');
    expect((await e.http().get(DEMO_ROUTE)).body).toEqual({ currentMonth: '2026-10', month: '2026-11', advance: 'NO_PENDING_AHEAD' });
    // logado, a demo continua sendo a demo
    expect((await e.http().get(DEMO_ROUTE).set(bearer(ana))).body).toEqual({ currentMonth: '2026-10', month: '2026-11', advance: 'NO_PENDING_AHEAD' });
  });

  it('mesmo contrato da rota protegida (mesmas chaves)', async () => {
    await card(DEMO_USER_ID, 7, 'Cartao Demo');
    await card(ANA, 1);
    const demo = await e.http().get(DEMO_ROUTE);
    const real = await as(ana);
    expect(Object.keys(demo.body).sort()).toEqual(Object.keys(real.body).sort());
  });

  it('demo também abre na fatura de cartão pendente mais antiga, anterior a M', async () => {
    e.clock.set(new Date('2026-11-05T13:00:00.000Z'));
    await insertOwnedCard(e.pool, DEMO_USER_ID, { n: 7, name: 'Cartao Demo', closingDay: 4, dueDay: 11 });
    await insertOwnedEntry(e.pool, DEMO_USER_ID, cardEntry(701, 7, { date: '2026-09-20', closing: '2026-10-04', due: '2026-10-11' }));
    await insertOwnedEntry(e.pool, DEMO_USER_ID, cardEntry(702, 7, { date: '2026-10-20', closing: '2026-11-04', due: '2026-11-11' }));
    await pendingPix(DEMO_USER_ID, 703, '2026-09-15');
    expect((await e.http().get(DEMO_ROUTE)).body).toEqual({ currentMonth: '2026-11', month: '2026-10', advance: 'NONE' });
  });

  it('400 UNKNOWN_FIELD com parametro de query tambem na demo', async () => {
    const res = await e.http().get(`${DEMO_ROUTE}?month=2026-10`);
    expect(res.status).toBe(400);
    expect(res.body.details.fields[0]).toMatchObject({ code: 'UNKNOWN_FIELD' });
  });
});

describe('GET /api/entries/initial-month - falha inesperada (RNF02)', () => {
  it('500 INTERNAL_ERROR no formato padrao, sem vazar detalhes', async () => {
    const broken = await startFinanceE2e(undefined, [
      { token: PENDING_OVERVIEW_READ_MODEL, value: { overviewFrom: async () => { throw new Error('senha-do-banco: s3cr3t'); } } },
    ]);
    try {
      const res = await broken.http().get(ROUTE);
      expect(res.status).toBe(500);
      expect(res.body).toEqual({ code: 'INTERNAL_ERROR', message: expect.any(String), details: null });
      expect(JSON.stringify(res.body)).not.toMatch(/s3cr3t|senha|stack/);
    } finally {
      await broken.close();
    }
  });
});
