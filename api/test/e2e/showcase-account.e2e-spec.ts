import { ATTEMPT_LIMITER } from '@identity/application/ports/attempt-limiter.js';
import { InMemoryAttemptLimiter } from '@identity/infrastructure/in-memory-attempt-limiter.js';
import { buildSampleDataset } from '@finance/application/sample-dataset/sample-dataset.js';
import { OwnerId } from '@finance/domain/owner/owner-id.js';
import { YearMonth } from '@shared/domain/value-objects/year-month.js';
import { SequentialIdGenerator } from '../fakes/simple-fakes.js';
import { ResetOwnerData } from '@finance/application/use-cases/maintenance/reset-owner-data.js';
import { CAST, bearer, idOf } from '../support/identity-e2e.js';
import { SHOWCASE_E2E_EMAIL as EMAIL, SHOWCASE_E2E_PASSWORD as PASSWORD, startShowcaseE2e, type ShowcaseE2e } from '../support/showcase-e2e.js';

const SHOWCASE_ID = '01900000-0000-7000-8000-0000000000d2';
let e: ShowcaseE2e;
beforeAll(async () => {
  e = await startShowcaseE2e();
});
afterAll(() => e.close());
beforeEach(async () => {
  await e.resetAll();
  (e.app.get(ATTEMPT_LIMITER) as InMemoryAttemptLimiter).clear();
  await e.seedUser(CAST.vagner);
  await e.seedUser(CAST.ana);
  expect((await e.provision()).status).toBe('created');
});

const login = (email: string, password: string) => e.http().post('/api/auth/login').set('X-Forwarded-For', e.freshIp()).send({ email, password });
const showcaseToken = async () => (await login(EMAIL, PASSWORD)).body.session.token as string;
const change = (token: string, body: object) =>
  e.http().put('/api/account/password').set(bearer(token)).set('X-Forwarded-For', e.freshIp()).send(body);
const entry = (over: object = {}) => ({ type: 'EXPENSE', description: 'Padaria', category: 'Alimentação', date: '2026-10-05', amount: '12.50', paymentMethod: 'PIX', ...over });

describe('CA44: entrar com a conta demo', () => {
  it('e-mail + senha da conta -> 200, accountKind SHOWCASE, nivel USER, so MANAGE_EXPENSES, sem troca obrigatoria', async () => {
    const res = await login(EMAIL, PASSWORD);
    expect(res.status).toBe(200);
    expect(res.body.user).toEqual({
      id: SHOWCASE_ID,
      name: 'Conta de demonstração',
      email: EMAIL,
      role: 'USER',
      mustChangePassword: false,
      accountKind: 'SHOWCASE',
      capabilities: ['MANAGE_EXPENSES'],
    });
  });

  it('me devolve o mesmo tipo de conta', async () => {
    const res = await e.http().get('/api/auth/me').set(bearer(await showcaseToken()));
    expect(res.body).toMatchObject({ accountKind: 'SHOWCASE', capabilities: ['MANAGE_EXPENSES'] });
  });

  it('recem-provisionada (so o EnsureShowcaseAccount, antes do dataset de exemplo): categorias vazias e sem cartoes', async () => {
    const t = await showcaseToken();
    expect((await e.http().get('/api/categories').set(bearer(t))).body).toEqual({ items: [] });
    expect((await e.http().get('/api/cards').set(bearer(t))).body).toEqual({ items: [] });
  });

  it('a mesma credencial entra no site (fluxo normal, sem excecao de formato)', async () => {
    expect((await login(EMAIL, PASSWORD)).status).toBe(200);
  });
});

describe('CA12/CA13/CA14: alias "demo" no login (ADR 0013, B1)', () => {
  it.each(['demo', 'Demo', ' demo ', 'DEMO'])('CA12: %j + demo -> 200, entra como "Conta de demonstração" com o e-mail canonico', async (alias) => {
    const res = await login(alias, PASSWORD);
    expect(res.status).toBe(200);
    expect(res.body.user).toEqual({
      id: SHOWCASE_ID,
      name: 'Conta de demonstração',
      email: EMAIL,
      role: 'USER',
      mustChangePassword: false,
      accountKind: 'SHOWCASE',
      capabilities: ['MANAGE_EXPENSES'],
    });
    expect(typeof res.body.session.token).toBe('string');
  });

  it('CA12: o alias vale tambem para o app (X-Client mobile)', async () => {
    const res = await e.http().post('/api/auth/login').set('X-Forwarded-For', e.freshIp()).set('X-Client', 'mobile/1.2.3').send({ email: 'demo', password: PASSWORD });
    expect(res.status).toBe(200);
    expect(res.body.user.email).toBe(EMAIL);
  });

  it('CA12: a sessao aberta pelo alias funciona (me)', async () => {
    const t = (await login('demo', PASSWORD)).body.session.token as string;
    expect((await e.http().get('/api/auth/me').set(bearer(t))).body).toMatchObject({ id: SHOWCASE_ID, accountKind: 'SHOWCASE' });
  });

  it('CA13: o e-mail canonico segue funcionando', async () => {
    expect((await login(EMAIL, PASSWORD)).status).toBe(200);
  });

  it('CA12: alias com senha errada -> 401 INVALID_CREDENTIALS generico', async () => {
    const res = await login('demo', 'errada');
    expect(res.status).toBe(401);
    expect(res.body).toEqual({ code: 'INVALID_CREDENTIALS', message: 'E-mail ou senha inválidos.', details: null });
  });

  it.each(['admin', 'ana', 'demo2', 'showcase'])('CA14: %j (sem @) -> 401 INVALID_CREDENTIALS identico ao de senha errada, e nenhuma sessao e criada', async (id) => {
    const before = Number((await e.pool.query('SELECT count(*) AS c FROM sessions')).rows[0].c);
    const res = await login(id, PASSWORD);
    expect(res.status).toBe(401);
    expect(res.body).toEqual({ code: 'INVALID_CREDENTIALS', message: 'E-mail ou senha inválidos.', details: null });
    expect(Number((await e.pool.query('SELECT count(*) AS c FROM sessions')).rows[0].c)).toBe(before);
  });

  it('CA11: com a conta demo desabilitada, demo/demo -> 401 INVALID_CREDENTIALS ("E-mail ou senha inválidos.")', async () => {
    expect((await e.provision(null)).status).toBe('disabled');
    const res = await login('demo', PASSWORD);
    expect(res.status).toBe(401);
    expect(res.body).toEqual({ code: 'INVALID_CREDENTIALS', message: 'E-mail ou senha inválidos.', details: null });
  });

  it('RF11: o alias nao enfraquece o limite por IP (21o login do mesmo IP -> 429)', async () => {
    const ip = e.freshIp();
    let last = 0;
    for (let i = 0; i < 21; i++) last = (await e.http().post('/api/auth/login').set('X-Forwarded-For', ip).send({ email: 'demo', password: PASSWORD })).status;
    expect(last).toBe(429);
  });

  it('RF11: demo e o e-mail canonico contam como o mesmo identificador (isencao da conta demo vale para os dois: 6 erros e o login correto passa)', async () => {
    for (let i = 0; i < 3; i++) expect((await login('demo', `errada-${i}`)).status).toBe(401);
    for (let i = 0; i < 3; i++) expect((await login(EMAIL, `errada-${i}`)).status).toBe(401);
    expect((await login('Demo', PASSWORD)).status).toBe(200);
  });

  it('CA45 (regra de senha): o alias nao altera a excecao de senha curta: a regra segue exclusiva da conta demo', async () => {
    const admin = await e.sessionFor(idOf(4));
    const res = await e.http().post('/api/admin/users').set(bearer(admin)).send({ name: 'Novo', email: 'demo@exemplo.com', role: 'USER', password: 'demo' });
    expect(res.status).toBe(400);
  });
});

describe('CA45/CA15: a excecao de senha curta e restrita a conta demo', () => {
  it('CA15: admin criando a usuaria bia@exemplo.com com senha "demo" -> 400 TOO_SHORT', async () => {
    const admin = await e.sessionFor(idOf(4));
    const res = await e.http().post('/api/admin/users').set(bearer(admin)).send({ name: 'Bia', email: 'bia@exemplo.com', role: 'USER', password: 'demo' });
    expect(res.status).toBe(400);
    expect(res.body.details.fields).toContainEqual(expect.objectContaining({ field: 'password', code: 'TOO_SHORT' }));
  });

  it('CA15: admin criando usuario com senha "demo" -> 400 TOO_SHORT', async () => {
    const admin = await e.sessionFor(idOf(4));
    const res = await e.http().post('/api/admin/users').set(bearer(admin)).send({ name: 'Novo', email: 'novo@exemplo.com', role: 'USER', password: 'demo' });
    expect(res.status).toBe(400);
    expect(res.body.details.fields).toContainEqual(expect.objectContaining({ field: 'password', code: 'TOO_SHORT' }));
  });

  it('CA15: admin redefinindo a senha de alguem para "demo" -> 400 TOO_SHORT', async () => {
    const admin = await e.sessionFor(idOf(4));
    const res = await e.http().post(`/api/admin/users/${idOf(1)}/password-reset`).set(bearer(admin)).send({ password: 'demo' });
    expect(res.status).toBe(400);
    expect(res.body.details.fields).toContainEqual(expect.objectContaining({ code: 'TOO_SHORT' }));
  });

  it('CA15: usuario trocando a propria senha para "demo" -> 400 TOO_SHORT', async () => {
    const ana = await e.sessionFor(idOf(1));
    const res = await change(ana, { currentPassword: 'segredo123', newPassword: 'demo' });
    expect(res.status).toBe(400);
    expect(res.body.details.fields).toContainEqual(expect.objectContaining({ field: 'newPassword', code: 'TOO_SHORT' }));
  });

  it('a conta demo nao aparece na gestao de usuarios', async () => {
    const admin = await e.sessionFor(idOf(4));
    const res = await e.http().get('/api/admin/users').set(bearer(admin));
    expect(JSON.stringify(res.body)).not.toContain('showcase');
  });
});

describe('CA46: a conta demo usa as acoes do app, so nos proprios dados', () => {
  it('cria, edita (200) e exclui (204) a propria despesa; paga e paga em lote', async () => {
    const t = await showcaseToken();
    const a = (await e.http().post('/api/entries').set(bearer(t)).send(entry({ paid: false }))).body;
    const b = (await e.http().post('/api/entries').set(bearer(t)).send(entry({ description: 'Luz', paid: false }))).body;
    expect((await e.http().post(`/api/entries/${a.id}/pay`).set(bearer(t))).status).toBe(200);
    expect((await e.http().post('/api/entries/pay').set(bearer(t)).send({ ids: [b.id] })).status).toBe(200);
    const put = await e.http().put(`/api/entries/${a.id}`).set(bearer(t)).send({ description: 'Padaria 2', category: 'Alimentação', date: '2026-10-06', amount: '13.00' });
    expect(put.status).toBe(200);
    expect((await e.http().delete(`/api/entries/${a.id}`).set(bearer(t))).status).toBe(204);
  });

  it('nao alcanca lancamento de outro usuario (404 ENTRY_NOT_FOUND)', async () => {
    const ana = await e.sessionFor(idOf(1));
    const own = (await e.http().post('/api/entries').set(bearer(ana)).send(entry())).body;
    const t = await showcaseToken();
    const res = await e.http().delete(`/api/entries/${own.id}`).set(bearer(t));
    expect(res.status).toBe(404);
    expect(res.body.code).toBe('ENTRY_NOT_FOUND');
  });
});

describe('CA47: sem administracao', () => {
  it.each([
    ['get', '/api/admin/users'],
    ['post', '/api/admin/users'],
    ['put', `/api/admin/users/${idOf(1)}`],
  ] as const)('%s %s -> 403 FORBIDDEN, nada criado nem alterado', async (method, path) => {
    const t = await showcaseToken();
    const res = await e.http()[method](path).set(bearer(t)).send({ name: 'X', email: 'x@exemplo.com', role: 'ADMIN', password: 'Senha1234' });
    expect(res.status).toBe(403);
    expect(res.body.code).toBe('FORBIDDEN');
    expect(res.body.details).toEqual({});
    const { rows } = await e.pool.query('SELECT count(*)::int AS c FROM users');
    expect(rows[0].c).toBe(3); // vagner, ana, conta demo
  });

  it('PUT /api/account/profile -> 403 FORBIDDEN e o nome nao muda (B8)', async () => {
    const t = await showcaseToken();
    const res = await e.http().put('/api/account/profile').set(bearer(t)).send({ name: 'Texto ofensivo' });
    expect(res.status).toBe(403);
    expect(res.body.code).toBe('FORBIDDEN');
    const { rows } = await e.pool.query('SELECT name FROM users WHERE id = $1::uuid', [SHOWCASE_ID]);
    expect(rows[0].name).toBe('Conta de demonstração');
  });
});

describe('CA48: a conta demo nao troca a senha', () => {
  it('senha atual correta -> 403 { code: FORBIDDEN, message, details }; a senha segue valendo', async () => {
    const t = await showcaseToken();
    const res = await change(t, { currentPassword: PASSWORD, newPassword: 'OutraSenha9' });
    expect(res.status).toBe(403);
    expect(res.body).toEqual({ code: 'FORBIDDEN', message: expect.any(String), details: {} });
    expect((await login(EMAIL, PASSWORD)).status).toBe(200);
    expect((await login(EMAIL, 'OutraSenha9')).status).toBe(401);
  });

  it('senha atual ERRADA tambem -> 403 (nao 400 INCORRECT)', async () => {
    const res = await change(await showcaseToken(), { currentPassword: 'errada', newPassword: 'OutraSenha9' });
    expect(res.status).toBe(403);
    expect(res.body.code).toBe('FORBIDDEN');
  });

  it('corpo invalido -> 403 (o 403 vence o 400)', async () => {
    const t = await showcaseToken();
    expect((await change(t, {})).status).toBe(403);
    expect((await change(t, { currentPassword: 'x', newPassword: 'a' })).status).toBe(403);
    expect((await change(t, { lixo: true })).status).toBe(403);
  });

  it('6 tentativas seguidas continuam 403 (nunca 429), mesmo do mesmo IP', async () => {
    const t = await showcaseToken();
    const ip = e.freshIp();
    for (let i = 0; i < 6; i++) {
      const res = await e.http().put('/api/account/password').set(bearer(t)).set('X-Forwarded-For', ip).send({ currentPassword: 'errada', newPassword: 'OutraSenha9' });
      expect(res.status).toBe(403);
    }
  });

  it('a sessao da conta continua valida depois da recusa', async () => {
    const t = await showcaseToken();
    await change(t, { currentPassword: PASSWORD, newPassword: 'OutraSenha9' });
    expect((await e.http().get('/api/auth/me').set(bearer(t))).status).toBe(200);
  });

  it('regressao: usuario comum continua trocando a senha (200)', async () => {
    const ana = await e.sessionFor(idOf(1));
    expect((await change(ana, { currentPassword: 'segredo123', newPassword: 'NovaSenha9' })).status).toBe(200);
  });
});

describe('isencao do bloqueio por e-mail (ADR 0011 3.4)', () => {
  it('6 senhas erradas (IPs diferentes) e o login correto ainda passa; nunca 429 por e-mail', async () => {
    for (let i = 0; i < 6; i++) expect((await login(EMAIL, `errada-${i}`)).status).toBe(401);
    expect((await login(EMAIL, PASSWORD)).status).toBe(200);
  });

  it('regressao: e-mail comum bloqueia apos 5 falhas (429 TOO_MANY_ATTEMPTS)', async () => {
    for (let i = 0; i < 5; i++) await login('ana@exemplo.com', 'errada123');
    const res = await login('ana@exemplo.com', 'segredo123');
    expect(res.status).toBe(429);
    expect(res.body.code).toBe('TOO_MANY_ATTEMPTS');
  });

  it('o limite POR IP continua valendo para a conta demo (21o login do mesmo IP -> 429)', async () => {
    const ip = e.freshIp();
    let last = 0;
    for (let i = 0; i < 21; i++) {
      last = (await e.http().post('/api/auth/login').set('X-Forwarded-For', ip).send({ email: EMAIL, password: PASSWORD })).status;
    }
    expect(last).toBe(429);
  });
});

describe('CA49: provisionamento idempotente e interruptor', () => {
  it('duas execucoes com lancamentos entre elas: uma conta, USER, senha igual, lancamentos preservados', async () => {
    const t = await showcaseToken();
    await e.http().post('/api/entries').set(bearer(t)).send(entry());
    expect((await e.provision()).status).toBe('unchanged');
    const { rows } = await e.pool.query(`SELECT role, email FROM users WHERE kind = 'SHOWCASE'`);
    expect(rows).toEqual([{ role: 'USER', email: EMAIL }]);
    expect((await e.http().get('/api/categories').set(bearer(t))).body.items).toEqual(['Alimentação']);
    expect((await login(EMAIL, PASSWORD)).status).toBe(200);
  });

  it('desabilitada: inativa, sessoes encerradas (401) e login -> INVALID_CREDENTIALS', async () => {
    const t = await showcaseToken();
    expect((await e.provision(null)).status).toBe('disabled');
    expect((await e.http().get('/api/auth/me').set(bearer(t))).status).toBe(401);
    const res = await login(EMAIL, PASSWORD);
    expect(res.status).toBe(401);
    expect(res.body.code).toBe('INVALID_CREDENTIALS');
  });
});

describe('CA17/CA18/CA19/CA24: dataset de exemplo e redefinicao da conta demo (ADR 0013)', () => {
  const NOV = new Date('2026-11-14T15:00:00.000Z');
  const resetter = () => e.app.get(ResetOwnerData, { strict: false });
  const restore = (condition: object = { kind: 'sample-stale' }) =>
    resetter().execute({ ownerId: SHOWCASE_ID, withSample: true, condition: condition as never });
  const cents = (v: string) => Math.round(Number(v) * 100);

  beforeEach(() => {
    e.clock.set(NOV);
  });
  afterAll(() => e.clock.set(new Date('2026-10-05T13:00:00.000Z')));

  it('CA17: depois do seed (conta ativa) a conta demo tem 2 cartoes e totais de 2026-11 iguais aos do gerador, mais a fatura de 2026-12', async () => {
    await restore();
    const t = await showcaseToken();
    expect((await e.http().get('/api/cards').set(bearer(t))).body.items).toHaveLength(2);

    const summary = (await e.http().get('/api/summary').query({ month: '2026-11' }).set(bearer(t))).body;
    const owner = OwnerId.create(SHOWCASE_ID);
    if (!owner.ok) throw new Error('owner');
    const sample = buildSampleDataset({ ownerId: owner.value, anchor: YearMonth.of(2026, 11), ids: new SequentialIdGenerator(), now: NOV });
    const sumOf = (type: string) =>
      sample.entries
        .map((x) => x.toSnapshot())
        .filter((s) => s.type === type && s.referenceMonth.toString() === '2026-11')
        .reduce((acc, s) => acc + cents(s.amount.toString()), 0);
    expect(cents(summary.totals.income)).toBe(sumOf('INCOME'));
    expect(cents(summary.totals.expenses.total)).toBe(sumOf('EXPENSE'));
    expect(sumOf('INCOME')).toBeGreaterThan(0);
    const next = (await e.http().get('/api/invoices').query({ month: '2026-12' }).set(bearer(t))).body;
    expect(JSON.stringify(next)).toMatch(/Cart/);
    const oldest = (await e.http().get('/api/summary').query({ month: '2025-12' }).set(bearer(t))).body;
    expect(cents(oldest.totals.income) + cents(oldest.totals.expenses.total)).toBeGreaterThan(0);
    const before = (await e.http().get('/api/summary').query({ month: '2025-11' }).set(bearer(t))).body;
    expect(before.totals.income).toBe('0.00');
    expect(before.totals.expenses.total).toBe('0.00');
  });

  it('CA18: o que o visitante criou (despesa e cartao) some na redefinicao; categorias dele somem; Ana nao muda', async () => {
    await restore();
    const t = await showcaseToken();
    const ana = await e.sessionFor(idOf(1));
    await e.http().post('/api/entries').set(bearer(ana)).send(entry({ description: 'Da Ana', category: 'Categoria da Ana' }));
    const anaBefore = (await e.http().get('/api/categories').set(bearer(ana))).body;
    await e.http().post('/api/cards').set(bearer(t)).send({ name: 'Cartao X', closingDay: 10, dueDay: 20 });
    await e.http().post('/api/entries').set(bearer(t)).send(entry({ description: 'Teste visitante', category: 'Categoria do visitante' }));
    expect((await e.http().get('/api/categories').set(bearer(t))).body.items).toContain('Categoria do visitante');

    e.clock.set(new Date('2026-11-15T06:00:00.000Z'));
    const result = await restore({ kind: 'not-reset-since', since: new Date('2026-11-15T06:00:00.000Z') });
    expect(result).toMatchObject({ status: 'reset' });

    const cats = (await e.http().get('/api/categories').set(bearer(t))).body.items as string[];
    expect(cats).not.toContain('Categoria do visitante');
    const cards = (await e.http().get('/api/cards').set(bearer(t))).body.items as { name: string }[];
    expect(cards.map((c) => c.name)).not.toContain('Cartao X');
    expect(cards).toHaveLength(2);
    expect((await e.http().get('/api/categories').set(bearer(ana))).body).toEqual(anaBefore);
  });

  it('CA19: excluir uma despesa de exemplo vale ate a proxima redefinicao, que devolve o dataset ao original', async () => {
    await restore();
    const t = await showcaseToken();
    const list = async () => (await e.http().get('/api/entries/expenses').query({ month: '2026-11', pageSize: '100' }).set(bearer(t))).body;
    const original = await list();
    const victim = original.items[0].id as string;
    expect((await e.http().delete(`/api/entries/${victim}`).set(bearer(t))).status).toBe(204);
    expect((await list()).pagination.totalItems).toBe(original.pagination.totalItems - 1);
    await restore({ kind: 'always' });
    const restored = await list();
    expect(restored.pagination.totalItems).toBe(original.pagination.totalItems);
    const sig = (items: { description: string; amount: string }[]) => items.map((i) => `${i.description}|${i.amount}`).sort();
    expect(sig(restored.items)).toEqual(sig(original.items));
  });

  it('CA24: as sessoes (web e app) continuam validas depois da redefinicao e o numero de sessoes nao muda', async () => {
    await restore();
    const web = (await login(EMAIL, PASSWORD)).body.session.token as string;
    const app = (await e.http().post('/api/auth/login').set('X-Forwarded-For', e.freshIp()).set('X-Client', 'mobile/1.2.3').send({ email: 'demo', password: PASSWORD })).body.session.token as string;
    const count = async () => Number((await e.pool.query('SELECT count(*) AS c FROM sessions WHERE user_id = $1::uuid', [SHOWCASE_ID])).rows[0].c);
    const before = await count();
    await restore({ kind: 'always' });
    expect(await count()).toBe(before);
    expect((await e.http().get('/api/auth/me').set(bearer(web))).status).toBe(200);
    expect((await e.http().get('/api/auth/me').set(bearer(app)).set('X-Client', 'mobile/1.2.3')).status).toBe(200);
    expect((await e.http().get('/api/cards').set(bearer(web))).body.items).toHaveLength(2);
  });

  it('CA28: conta desabilitada -> a redefinicao so apaga e nao regrava o dataset nem reativa a conta', async () => {
    await restore();
    await e.provision(null);
    await resetter().execute({ ownerId: SHOWCASE_ID, withSample: false, condition: { kind: 'always' } });
    const { rows } = await e.pool.query(`SELECT status FROM users WHERE id = $1::uuid`, [SHOWCASE_ID]);
    expect(rows[0].status).toBe('INACTIVE');
    expect(Number((await e.pool.query('SELECT count(*) AS c FROM entries WHERE user_id = $1::uuid', [SHOWCASE_ID])).rows[0].c)).toBe(0);
  });
});
