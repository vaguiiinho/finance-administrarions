import { CAST, bearer, idOf, startIdentityE2e, type IdentityE2e } from '../support/identity-e2e.js';
import { insertOwnedCard, insertOwnedEntry } from '../support/owned-db.js';
import { query } from '../support/db.js';

let e: IdentityE2e;
let admin: string;
beforeAll(async () => {
  e = await startIdentityE2e();
});
afterAll(() => e.close());
beforeEach(async () => {
  await e.resetAll();
  await e.seedUser(CAST.vagner);
  await e.seedUser(CAST.ana);
  await e.seedUser({ ...CAST.bruno, status: 'INACTIVE' });
  await e.seedUser({ n: 90, kind: 'DEMO', name: 'Demonstração', email: 'demo@finance.invalid' });
  admin = await e.sessionFor(idOf(4));
});

const as = (token: string) => ({
  get: (p: string) => e.http().get(p).set(bearer(token)),
  post: (p: string, b?: object) => e.http().post(p).set(bearer(token)).send(b ?? {}),
  put: (p: string, b?: object) => e.http().put(p).set(bearer(token)).send(b ?? {}),
});
const fieldsOf = (res: { body: any }) => (res.body.details.fields as { field: string; code: string }[]).map((f) => `${f.field}:${f.code}`).sort();
const DTO_KEYS = ['createdAt', 'email', 'id', 'mustChangePassword', 'name', 'role', 'status'];
const login = (email: string, password: string) =>
  e.http().post('/api/auth/login').set('X-Forwarded-For', e.freshIp()).send({ email, password });

describe('U1 GET /api/admin/users (RF11, CA25, CA26)', () => {
  it('200 { items }: ativos antes de inativos, sem o demo; so campos do AdminUserDto (nenhum hash nem dado financeiro)', async () => {
    const res = await as(admin).get('/api/admin/users');
    expect(res.status).toBe(200);
    expect(res.body.items.map((u: { name: string }) => u.name)).toEqual(['Ana Souza', 'Vagner', 'Bruno Lima']);
    expect(res.body.items.map((u: { status: string }) => u.status)).toEqual(['ACTIVE', 'ACTIVE', 'INACTIVE']);
    for (const item of res.body.items) expect(Object.keys(item).sort()).toEqual(DTO_KEYS);
    expect(res.body.items[0].createdAt).toBe('2026-10-01T12:00:00.000Z');
    expect(JSON.stringify(res.body)).not.toMatch(/passwordHash|password_hash|fake|argon|invalid/i);
  });
});

describe('U2 GET /api/admin/users/:id', () => {
  it('200 com o dto; 400 id malformado; 404 USER_NOT_FOUND para inexistente e para o demo', async () => {
    const ok = await as(admin).get(`/api/admin/users/${idOf(1)}`);
    expect(ok.status).toBe(200);
    expect(Object.keys(ok.body).sort()).toEqual(DTO_KEYS);
    expect((await as(admin).get('/api/admin/users/abc')).status).toBe(400);
    for (const id of [idOf(99), idOf(90)]) {
      const res = await as(admin).get(`/api/admin/users/${id}`);
      expect(res.status).toBe(404);
      expect(res.body).toMatchObject({ code: 'USER_NOT_FOUND', details: { id } });
    }
  });
});

describe('U3 POST /api/admin/users (RF12, CA16-CA18)', () => {
  const create = (body: object) => as(admin).post('/api/admin/users', body);

  it('CA16: 201, normaliza, nasce ativo com troca obrigatoria; o primeiro login segue o CA08', async () => {
    const res = await create({ name: '  Carla   Dias ', email: ' Carla@Exemplo.com ', role: 'USER', password: 'Temp1234' });
    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({ name: 'Carla Dias', email: 'carla@exemplo.com', role: 'USER', status: 'ACTIVE', mustChangePassword: true });
    expect(Object.keys(res.body).sort()).toEqual(DTO_KEYS);
    expect(res.body.id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
    expect(JSON.stringify(res.body)).not.toContain('Temp1234');
    const entered = await login('carla@exemplo.com', 'Temp1234');
    expect(entered.status).toBe(200);
    expect(entered.body.user.mustChangePassword).toBe(true);
    expect(await query(e.pool, `SELECT 1 FROM cards WHERE user_id = $1`, [res.body.id])).toHaveLength(0);
  });

  it('CA18: 400 acumulado nos quatro campos; nada criado', async () => {
    const res = await create({ name: '', email: 'ana@', role: 'ROOT', password: '1234567' });
    expect(res.status).toBe(400);
    expect(res.body.code).toBe('VALIDATION_ERROR');
    expect(fieldsOf(res)).toEqual(['email:INVALID_FORMAT', 'name:REQUIRED', 'password:TOO_SHORT', 'role:INVALID_VALUE']);
    expect(await query(e.pool, 'SELECT 1 FROM users')).toHaveLength(4);
  });

  it('CA18: senha de 73 caracteres -> password: TOO_LONG; campo desconhecido -> UNKNOWN_FIELD', async () => {
    expect(fieldsOf(await create({ name: 'X', email: 'x@exemplo.com', role: 'USER', password: 'a'.repeat(73) }))).toEqual(['password:TOO_LONG']);
    expect(fieldsOf(await create({ name: 'X', email: 'x@exemplo.com', role: 'USER', password: 'Temp1234', status: 'ACTIVE' }))).toContain('status:UNKNOWN_FIELD');
  });

  it.each([
    ['ativa (caixa diferente)', 'ANA@exemplo.com'],
    ['inativo', 'bruno@exemplo.com'],
  ])('CA17: e-mail %s -> 409 EMAIL_TAKEN com details.fields[0]', async (_l, email) => {
    const res = await create({ name: 'Outra', email, role: 'USER', password: 'Temp1234' });
    expect(res.status).toBe(409);
    expect(res.body.code).toBe('EMAIL_TAKEN');
    expect(res.body.details.fields[0]).toMatchObject({ field: 'email', code: 'EMAIL_TAKEN', message: expect.any(String) });
  });

  it.each(['demo@finance.invalid', 'demo@showcase.invalid'])('I4/D5: e-mail reservado %s -> 400 VALIDATION_ERROR (email:INVALID_FORMAT)', async (email) => {
    const res = await create({ name: 'Outra', email, role: 'USER', password: 'Temp1234' });
    expect(res.status).toBe(400);
    expect(res.body.code).toBe('VALIDATION_ERROR');
    expect(res.body.details.fields[0]).toMatchObject({ field: 'email', code: 'INVALID_FORMAT' });
  });
});

describe('U4 PUT /api/admin/users/:id (RF13, CA19, CA24)', () => {
  const edit = (id: string, body: object, token = admin) => as(token).put(`/api/admin/users/${id}`, body);

  it('CA19: efeito imediato do nivel, sem sair; novo e-mail vale para o proximo login', async () => {
    const ana = await e.sessionFor(idOf(1));
    expect((await as(ana).get('/api/admin/users')).status).toBe(403);
    const res = await edit(idOf(1), { name: 'Ana Lima', email: 'ana.lima@exemplo.com', role: 'ADMIN' });
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ name: 'Ana Lima', email: 'ana.lima@exemplo.com', role: 'ADMIN' });
    expect((await as(ana).get('/api/admin/users')).status).toBe(200);
    expect((await as(ana).get('/api/auth/me')).body).toMatchObject({ name: 'Ana Lima', role: 'ADMIN' });
    expect((await login('ana@exemplo.com', 'segredo123')).status).toBe(401);
    expect((await login('ana.lima@exemplo.com', 'segredo123')).status).toBe(200);

    expect((await edit(idOf(1), { name: 'Ana Lima', email: 'ana.lima@exemplo.com', role: 'USER' })).status).toBe(200);
    const denied = await as(ana).get('/api/admin/users');
    expect(denied.status).toBe(403);
    expect(denied.body.code).toBe('FORBIDDEN');
  });

  it('P17: editar nao encerra sessoes', async () => {
    const ana = await e.sessionFor(idOf(1));
    await edit(idOf(1), { name: 'Ana Lima', email: 'ana@exemplo.com', role: 'USER' });
    expect((await as(ana).get('/api/auth/me')).status).toBe(200);
  });

  it('corpo estrito: password -> UNKNOWN_FIELD; 400 acumulado; 404; 409', async () => {
    expect(fieldsOf(await edit(idOf(1), { name: 'Ana', email: 'ana@exemplo.com', role: 'USER', password: 'Hack1234' }))).toContain('password:UNKNOWN_FIELD');
    expect(fieldsOf(await edit(idOf(1), { name: '', email: 'ana@', role: 'ROOT' }))).toEqual(['email:INVALID_FORMAT', 'name:REQUIRED', 'role:INVALID_VALUE']);
    expect((await edit(idOf(99), { name: 'X', email: 'x@exemplo.com', role: 'USER' })).body.code).toBe('USER_NOT_FOUND');
    const clash = await edit(idOf(1), { name: 'Ana', email: 'VAGNER@exemplo.com', role: 'USER' });
    expect(clash.status).toBe(409);
    expect(clash.body.details.fields[0]).toMatchObject({ field: 'email', code: 'EMAIL_TAKEN' });
  });

  it('CA24: o unico administrador ativo rebaixar a si mesmo -> 422 LAST_ADMIN; nada muda', async () => {
    const res = await edit(idOf(4), { name: 'Vagner', email: 'vagner@exemplo.com', role: 'USER' });
    expect(res.status).toBe(422);
    expect(res.body).toMatchObject({ code: 'LAST_ADMIN', details: null });
    expect((await as(admin).get('/api/admin/users')).status).toBe(200);
  });

  it('CA24: com dois administradores ativos, Vagner rebaixa a si mesmo e perde o acesso na proxima requisicao', async () => {
    await e.seedUser(CAST.outroAdmin);
    expect((await edit(idOf(4), { name: 'Vagner', email: 'vagner@exemplo.com', role: 'USER' })).status).toBe(200);
    expect((await as(admin).get('/api/admin/users')).status).toBe(403);
  });
});

describe('U5 POST /api/admin/users/:id/deactivate (RF14, CA20, CA23)', () => {
  it('CA20: encerra todas as sessoes (401 em qualquer navegador), bloqueia o login e preserva os dados; repetir e sucesso', async () => {
    await e.pool.query(`UPDATE users SET status = 'ACTIVE' WHERE id = $1`, [idOf(2)]);
    await insertOwnedCard(e.pool, idOf(2), { n: 5, name: 'Itau' });
    await insertOwnedEntry(e.pool, idOf(2), { n: 5, date: '2026-11-07', amount: '50.00' });
    const s1 = await e.sessionFor(idOf(2));
    const s2 = await e.sessionFor(idOf(2));
    expect((await as(s1).get('/api/summary?month=2026-11')).status).toBe(200);

    const res = await as(admin).post(`/api/admin/users/${idOf(2)}/deactivate`);
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ id: idOf(2), status: 'INACTIVE' });
    for (const t of [s1, s2]) expect((await as(t).get('/api/summary?month=2026-11')).status).toBe(401);
    const attempt = await login('bruno@exemplo.com', 'segredo123');
    expect(attempt.status).toBe(401);
    expect(attempt.body.code).toBe('INVALID_CREDENTIALS');
    expect(await query(e.pool, 'SELECT 1 FROM entries WHERE user_id = $1', [idOf(2)])).toHaveLength(1);
    expect(await query(e.pool, 'SELECT 1 FROM cards WHERE user_id = $1', [idOf(2)])).toHaveLength(1);
    expect((await as(admin).post(`/api/admin/users/${idOf(2)}/deactivate`)).status).toBe(200);
  });

  it('CA23: inativar a si mesmo -> 422 CANNOT_TARGET_SELF (tem precedencia sobre LAST_ADMIN)', async () => {
    const res = await as(admin).post(`/api/admin/users/${idOf(4)}/deactivate`);
    expect(res.status).toBe(422);
    expect(res.body.code).toBe('CANNOT_TARGET_SELF');
  });

  it('404 USER_NOT_FOUND para inexistente e demo; 400 para id malformado', async () => {
    expect((await as(admin).post(`/api/admin/users/${idOf(99)}/deactivate`)).body.code).toBe('USER_NOT_FOUND');
    expect((await as(admin).post(`/api/admin/users/${idOf(90)}/deactivate`)).status).toBe(404);
    expect((await as(admin).post('/api/admin/users/abc/deactivate')).status).toBe(400);
  });
});

describe('U6 POST /api/admin/users/:id/reactivate (RF15, CA21)', () => {
  it('CA21: Bruno volta a entrar com a senha de antes, sem troca obrigatoria, e ve os mesmos dados', async () => {
    await insertOwnedEntry(e.pool, idOf(2), { n: 7, type: 'INCOME', amount: '100.00', date: '2026-11-05' });
    const res = await as(admin).post(`/api/admin/users/${idOf(2)}/reactivate`);
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('ACTIVE');
    const entered = await login('bruno@exemplo.com', 'segredo123');
    expect(entered.status).toBe(200);
    expect(entered.body.user.mustChangePassword).toBe(false);
    const summary = await as(entered.body.session.token).get('/api/summary?month=2026-11');
    expect(summary.body.totals.income).toBe('100.00');
  });

  it('reativar quem ja esta ativo e sucesso', async () => {
    expect((await as(admin).post(`/api/admin/users/${idOf(1)}/reactivate`)).status).toBe(200);
  });
});

describe('U7 POST /api/admin/users/:id/password-reset (RF16, CA22, CA23)', () => {
  const reset = (id: string, body: object = { password: 'Nova1234' }) => as(admin).post(`/api/admin/users/${id}/password-reset`, body);

  it('CA22: encerra todas as sessoes, a senha antiga falha e a nova entra com troca obrigatoria', async () => {
    const s1 = await e.sessionFor(idOf(1));
    const s2 = await e.sessionFor(idOf(1));
    const res = await reset(idOf(1));
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ id: idOf(1), mustChangePassword: true });
    expect(JSON.stringify(res.body)).not.toContain('Nova1234');
    for (const t of [s1, s2]) expect((await as(t).get('/api/auth/me')).status).toBe(401);
    expect((await login('ana@exemplo.com', 'segredo123')).status).toBe(401);
    const entered = await login('ana@exemplo.com', 'Nova1234');
    expect(entered.body.user.mustChangePassword).toBe(true);
    expect((await as(admin).get('/api/admin/users')).body.items.find((u: { id: string }) => u.id === idOf(1)).mustChangePassword).toBe(true);
  });

  it('vale para usuario inativo (a nova senha vale quando for reativado)', async () => {
    expect((await reset(idOf(2))).body).toMatchObject({ status: 'INACTIVE', mustChangePassword: true });
    await as(admin).post(`/api/admin/users/${idOf(2)}/reactivate`);
    expect((await login('bruno@exemplo.com', 'Nova1234')).status).toBe(200);
  });

  it('CA23: redefinir a propria senha pela gestao -> 422 CANNOT_TARGET_SELF', async () => {
    const res = await reset(idOf(4));
    expect(res.status).toBe(422);
    expect(res.body.code).toBe('CANNOT_TARGET_SELF');
  });

  it('400: senha curta, ausente ou campo desconhecido; 404 inexistente', async () => {
    expect(fieldsOf(await reset(idOf(1), { password: '1234567' }))).toEqual(['password:TOO_SHORT']);
    expect(fieldsOf(await reset(idOf(1), {}))).toEqual(['password:REQUIRED']);
    expect(fieldsOf(await reset(idOf(1), { password: 'Nova1234', role: 'ADMIN' }))).toContain('role:UNKNOWN_FIELD');
    expect((await reset(idOf(99))).body.code).toBe('USER_NOT_FOUND');
  });
});

describe('CA24: concorrencia pela API', () => {
  it('Vagner inativa Ana enquanto Ana rebaixa Vagner (20x): no maximo uma acao vence e sobra >= 1 administrador ativo', async () => {
    for (let i = 0; i < 20; i++) {
      await e.resetAll();
      await e.seedUser(CAST.vagner);
      await e.seedUser({ ...CAST.ana, role: 'ADMIN' });
      const v = await e.sessionFor(idOf(4));
      const a = await e.sessionFor(idOf(1));
      const [r1, r2] = await Promise.all([
        as(v).post(`/api/admin/users/${idOf(1)}/deactivate`),
        as(a).put(`/api/admin/users/${idOf(4)}`, { name: 'Vagner', email: 'vagner@exemplo.com', role: 'USER' }),
      ]);
      expect([r1.status, r2.status].filter((s) => s === 200), `iteracao ${i}`).toHaveLength(1);
      expect([r1, r2].filter((r) => r.status !== 200).every((r) => [422, 401, 403].includes(r.status)), `iteracao ${i}`).toBe(true);
      const [{ n }] = await query<{ n: string }>(e.pool, `SELECT count(*) AS n FROM users WHERE role = 'ADMIN' AND status = 'ACTIVE'`);
      expect(Number(n), `iteracao ${i}`).toBeGreaterThanOrEqual(1);
    }
  });
});

describe('CA25 / RF19: o administrador nao ve dados financeiros alheios', () => {
  it('gestao sem campos financeiros; resumo do admin so com os dados dele; fatura de cartao de Ana -> 404', async () => {
    await insertOwnedEntry(e.pool, idOf(4), { n: 1, type: 'INCOME', amount: '1000.00', date: '2026-11-05' });
    await insertOwnedCard(e.pool, idOf(1), { n: 7, name: 'Nubank' });
    await insertOwnedEntry(e.pool, idOf(1), { n: 2, type: 'INCOME', amount: '5000.00', date: '2026-11-05' });
    const list = await as(admin).get('/api/admin/users');
    const detail = await as(admin).get(`/api/admin/users/${idOf(1)}`);
    for (const body of [list.body, detail.body]) expect(JSON.stringify(body)).not.toMatch(/amount|income|balance|card|categor|5000|1000/i);
    expect((await as(admin).get('/api/summary?month=2026-11')).body.totals.income).toBe('1000.00');
    const invoice = await as(admin).get('/api/cards/c0000000-0000-7000-8000-000000000007/invoices/2026-11/entries');
    expect(invoice.status).toBe(404);
    expect(invoice.body.code).toBe('CARD_NOT_FOUND');
  });
});
