import { ATTEMPT_LIMITER } from '@identity/application/ports/attempt-limiter.js';
import { InMemoryAttemptLimiter } from '@identity/infrastructure/in-memory-attempt-limiter.js';
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
  await e.seedUser({ n: 90, kind: 'DEMO', name: 'Demonstração', email: 'demo@finance.invalid' });
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

  it('nasce sem dados: categorias vazias (sinal de conta vazia) e sem cartoes', async () => {
    const t = await showcaseToken();
    expect((await e.http().get('/api/categories').set(bearer(t))).body).toEqual({ items: [] });
    expect((await e.http().get('/api/cards').set(bearer(t))).body).toEqual({ items: [] });
  });

  it('o dataset demo publico (/api/demo/*) nao vaza para a conta, e vice-versa', async () => {
    await e.pool.query(
      `INSERT INTO entries (id, user_id, type, description, category, category_key, "date", amount, payment_method, reference_month, status, paid_at, created_at, updated_at)
       VALUES ('e0000000-0000-7000-8000-0000000000f1','01900000-0000-7000-8000-0000000000d1','EXPENSE','Do dataset publico','Demo','demo','2026-10-05',10,'PIX','2026-10-01','PAID','2026-10-05T13:00:00Z','2026-10-05T13:00:00Z','2026-10-05T13:00:00Z')`,
    );
    const t = await showcaseToken();
    expect((await e.http().get('/api/categories').set(bearer(t))).body.items).toEqual([]);
    expect((await e.http().get('/api/demo/categories')).body.items).toEqual(['Demo']);
  });

  it('a mesma credencial entra no site (fluxo normal, sem excecao de formato)', async () => {
    expect((await login(EMAIL, PASSWORD)).status).toBe(200);
  });
});

describe('CA45: a excecao e restrita a conta demo', () => {
  it('identificador "demo" (sem @) + senha da conta -> 401 INVALID_CREDENTIALS (nao ha alias)', async () => {
    const res = await login('demo', PASSWORD);
    expect(res.status).toBe(401);
    expect(res.body.code).toBe('INVALID_CREDENTIALS');
  });

  it.each(['admin', 'ana', 'showcase'])('identificador %j sem @ segue INVALID_CREDENTIALS', async (id) => {
    expect((await login(id, 'segredo123')).body.code).toBe('INVALID_CREDENTIALS');
  });

  it('admin criando usuario com senha "demo" -> 400 TOO_SHORT', async () => {
    const admin = await e.sessionFor(idOf(4));
    const res = await e.http().post('/api/admin/users').set(bearer(admin)).send({ name: 'Novo', email: 'novo@exemplo.com', role: 'USER', password: 'demo' });
    expect(res.status).toBe(400);
    expect(res.body.details.fields).toContainEqual(expect.objectContaining({ field: 'password', code: 'TOO_SHORT' }));
  });

  it('admin redefinindo a senha de alguem para "demo" -> 400 TOO_SHORT', async () => {
    const admin = await e.sessionFor(idOf(4));
    const res = await e.http().post(`/api/admin/users/${idOf(1)}/password-reset`).set(bearer(admin)).send({ password: 'demo' });
    expect(res.status).toBe(400);
    expect(res.body.details.fields).toContainEqual(expect.objectContaining({ code: 'TOO_SHORT' }));
  });

  it('usuario trocando a propria senha para "demo" -> 400 TOO_SHORT', async () => {
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
    expect(rows[0].c).toBe(4); // vagner, ana, demo publico, conta demo
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
