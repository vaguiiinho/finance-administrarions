import { CAST, bearer, idOf, startIdentityE2e, type IdentityE2e } from '../support/identity-e2e.js';
import { query } from '../support/db.js';
import { ATTEMPT_LIMITER } from '@identity/application/ports/attempt-limiter.js';
import { InMemoryAttemptLimiter } from '@identity/infrastructure/in-memory-attempt-limiter.js';

let e: IdentityE2e;
beforeAll(async () => {
  e = await startIdentityE2e();
});
afterAll(() => e.close());
beforeEach(async () => {
  await e.resetAll();
  // O limitador (ADR D7) e em memoria e vive o arquivo todo: zera para nao vazar falhas entre testes.
  (e.app.get(ATTEMPT_LIMITER) as InMemoryAttemptLimiter).clear();
  await e.seedUser(CAST.ana);
  await e.seedUser({ ...CAST.bruno, status: 'INACTIVE' });
  await e.seedUser(CAST.carla);
  await e.seedUser({ n: 90, kind: 'DEMO', name: 'Demonstração', email: 'demo@finance.invalid' });
});

const login = (email: string, password: string, ip = e.freshIp()) =>
  e.http().post('/api/auth/login').set('X-Forwarded-For', ip).send({ email, password });
// B6 (ADR 0011 3.4): USER comum tem MANAGE_EXPENSES; capacidades vem ordenadas.
const USER_CAPS = ['CHANGE_OWN_PASSWORD', 'MANAGE_EXPENSES', 'UPDATE_OWN_PROFILE'];
const fields = (res: { body: any }) => res.body.details.fields as { field: string; code: string }[];

describe('A1 POST /api/auth/login', () => {
  it('CA01: 200 com usuario e sessao de 24 h; sem cookie e sem hash', async () => {
    const res = await login('ana@exemplo.com', 'segredo123');
    expect(res.status).toBe(200);
    expect(res.body).toEqual({
      user: { id: idOf(1), name: 'Ana Souza', email: 'ana@exemplo.com', role: 'USER', mustChangePassword: false, accountKind: 'REGULAR', capabilities: USER_CAPS },
      session: { token: expect.any(String), expiresAt: '2026-10-06T13:00:00.000Z' },
    });
    expect(res.headers['set-cookie']).toBeUndefined();
    expect(JSON.stringify(res.body)).not.toMatch(/hash|argon|segredo123/i);
  });

  it('o token devolvido autentica as demais rotas (Bearer)', async () => {
    const { body } = await login('ana@exemplo.com', 'segredo123');
    const me = await e.http().get('/api/auth/me').set(bearer(body.session.token));
    expect(me.status).toBe(200);
    expect(me.body.id).toBe(idOf(1));
  });

  it('normaliza o e-mail (trim + caixa)', async () => {
    expect((await login('  ANA@Exemplo.com ', 'segredo123')).status).toBe(200);
  });

  it('RF07: usuario com troca obrigatoria entra e recebe mustChangePassword = true', async () => {
    const res = await login('carla@exemplo.com', 'Temp1234');
    expect(res.status).toBe(200);
    expect(res.body.user.mustChangePassword).toBe(true);
  });

  it('CA03/RNF05: senha errada, e-mail inexistente, inativo com senha correta e demo -> 4x 401 INVALID_CREDENTIALS identicos', async () => {
    const responses = [
      await login('ana@exemplo.com', 'errada1234'),
      await login('naoexiste@exemplo.com', 'segredo123'),
      await login('bruno@exemplo.com', 'segredo123'),
      await login('demo@finance.invalid', 'segredo123'),
    ];
    for (const r of responses) {
      expect(r.status).toBe(401);
      expect(r.body).toEqual({ code: 'INVALID_CREDENTIALS', message: 'E-mail ou senha inválidos.', details: null });
    }
    expect(responses[0].headers['www-authenticate']).toBe('Bearer');
  });

  it('CA04: 5 falhas para o mesmo e-mail (de IPs diferentes) e a 6a, mesmo com a senha correta, -> 429 com Retry-After', async () => {
    for (let i = 0; i < 5; i++) expect((await login('ana@exemplo.com', 'errada1234')).status).toBe(401);
    const res = await login('ana@exemplo.com', 'segredo123');
    expect(res.status).toBe(429);
    expect(res.body).toMatchObject({ code: 'TOO_MANY_ATTEMPTS', message: expect.any(String) });
    expect(res.body.details.retryAfterSeconds).toBeGreaterThan(0);
    expect(Number(res.headers['retry-after'])).toBeGreaterThan(0);
  });

  it('RNF04: 21a requisicao do mesmo IP em 1 minuto -> 429 antes de qualquer validacao', async () => {
    const ip = e.freshIp();
    for (let i = 0; i < 20; i++) expect((await login(`ninguem${i}@exemplo.com`, 'segredo123', ip)).status).toBe(401);
    const res = await login('ana@exemplo.com', 'segredo123', ip);
    expect(res.status).toBe(429);
    expect(res.body.code).toBe('TOO_MANY_ATTEMPTS');
  });

  it('400 VALIDATION_ERROR so para presenca/tipo; formato de e-mail invalido vira 401 (D13)', async () => {
    const missing = await e.http().post('/api/auth/login').set('X-Forwarded-For', e.freshIp()).send({ email: 'ana@exemplo.com' });
    expect(missing.status).toBe(400);
    expect(fields(missing)).toContainEqual(expect.objectContaining({ field: 'password', code: 'REQUIRED' }));
    const unknown = await e.http().post('/api/auth/login').set('X-Forwarded-For', e.freshIp()).send({ email: 'a@b.com', password: 'x', role: 'ADMIN' });
    expect(unknown.status).toBe(400);
    expect(fields(unknown)).toContainEqual(expect.objectContaining({ field: 'role', code: 'UNKNOWN_FIELD' }));
    expect((await login('ana@', 'segredo123')).status).toBe(401);
  });

  it('CA07: nao existe cadastro: POST em qualquer caminho de cadastro -> 404 ROUTE_NOT_FOUND', async () => {
    for (const path of ['/api/auth/register', '/api/register', '/api/auth/signup', '/api/users']) {
      const res = await e.http().post(path).send({ name: 'X', email: 'x@exemplo.com', password: 'segredo123' });
      expect(res.status, path).toBe(404);
      expect(res.body.code, path).toBe('ROUTE_NOT_FOUND');
    }
    expect(await query(e.pool, `SELECT 1 FROM users WHERE email = 'x@exemplo.com'`)).toHaveLength(0);
  });
});

describe('A2 POST /api/auth/logout', () => {
  it('CA05: 204; o token deixa de valer; as outras sessoes continuam', async () => {
    const t1 = await e.sessionFor(idOf(1));
    const t2 = await e.sessionFor(idOf(1));
    expect((await e.http().post('/api/auth/logout').set(bearer(t1))).status).toBe(204);
    expect((await e.http().get('/api/auth/me').set(bearer(t1))).status).toBe(401);
    expect((await e.http().get('/api/auth/me').set(bearer(t2))).status).toBe(200);
  });

  it('e idempotente e publico: sem token, token invalido ou repetido -> 204', async () => {
    const t = await e.sessionFor(idOf(1));
    await e.http().post('/api/auth/logout').set(bearer(t));
    expect((await e.http().post('/api/auth/logout').set(bearer(t))).status).toBe(204);
    expect((await e.http().post('/api/auth/logout')).status).toBe(204);
    expect((await e.http().post('/api/auth/logout').set(bearer('lixo'))).status).toBe(204);
  });

  it('RNF08: logout nao pode ser disparado por GET', async () => {
    const res = await e.http().get('/api/auth/logout');
    expect(res.status).toBe(404);
    expect(res.body.code).toBe('ROUTE_NOT_FOUND');
  });

  it('usuario com troca obrigatoria tambem consegue sair', async () => {
    const t = await e.sessionFor(idOf(3));
    expect((await e.http().post('/api/auth/logout').set(bearer(t))).status).toBe(204);
  });
});

describe('A3 GET /api/auth/me', () => {
  it('RF03: 200 com id, nome, e-mail, nivel e mustChangePassword; sem hash', async () => {
    const res = await e.http().get('/api/auth/me').set(bearer(await e.sessionFor(idOf(1))));
    expect(res.body).toEqual({ id: idOf(1), name: 'Ana Souza', email: 'ana@exemplo.com', role: 'USER', mustChangePassword: false, accountKind: 'REGULAR', capabilities: USER_CAPS });
  });

  it('liberada na troca obrigatoria', async () => {
    const res = await e.http().get('/api/auth/me').set(bearer(await e.sessionFor(idOf(3))));
    expect(res.status).toBe(200);
    expect(res.body.mustChangePassword).toBe(true);
  });

  it('CA06: sessao com 23:59:59 vale; expirada -> 401', async () => {
    const almost = await e.sessionFor(idOf(1), { createdAtOffsetMs: -(24 * 3_600_000 - 1000), expiresAtOffsetMs: 1000 });
    const expired = await e.sessionFor(idOf(1), { createdAtOffsetMs: -25 * 3_600_000, expiresAtOffsetMs: -3_600_000 });
    expect((await e.http().get('/api/auth/me').set(bearer(almost))).status).toBe(200);
    expect((await e.http().get('/api/auth/me').set(bearer(expired))).status).toBe(401);
  });
});

describe('A4 PUT /api/account/password', () => {
  const change = (token: string, body: object, ip = e.freshIp()) =>
    e.http().put('/api/account/password').set(bearer(token)).set('X-Forwarded-For', ip).send(body);

  it('CA09: Carla na troca obrigatoria troca a senha: 200, outra sessao -> 401, atual continua, login novo sem troca obrigatoria', async () => {
    const other = await e.sessionFor(idOf(3));
    const current = await e.sessionFor(idOf(3));
    const res = await change(current, { currentPassword: 'Temp1234', newPassword: 'MinhaSenha9' });
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ id: idOf(3), name: 'Carla Dias', email: 'carla@exemplo.com', role: 'USER', mustChangePassword: false, accountKind: 'REGULAR', capabilities: USER_CAPS });
    expect((await e.http().get('/api/auth/me').set(bearer(other))).status).toBe(401);
    expect((await e.http().get('/api/auth/me').set(bearer(current))).status).toBe(200);
    expect((await login('carla@exemplo.com', 'Temp1234')).status).toBe(401);
    const again = await login('carla@exemplo.com', 'MinhaSenha9');
    expect(again.status).toBe(200);
    expect(again.body.user.mustChangePassword).toBe(false);
    expect((await e.http().get('/api/summary?month=2026-10').set(bearer(current))).status).toBe(200);
  });

  it('CA10: senha atual errada / igual a atual / curta -> 400 com o codigo certo; a senha nao muda', async () => {
    const t = await e.sessionFor(idOf(1));
    const wrong = await change(t, { currentPassword: 'errada1234', newPassword: 'OutraSenha1' });
    expect(wrong.status).toBe(400);
    expect(wrong.body.code).toBe('VALIDATION_ERROR');
    expect(fields(wrong)).toContainEqual(expect.objectContaining({ field: 'currentPassword', code: 'INCORRECT' }));
    expect(fields(await change(t, { currentPassword: 'segredo123', newPassword: 'segredo123' }))).toContainEqual(
      expect.objectContaining({ field: 'newPassword', code: 'SAME_AS_CURRENT' }),
    );
    expect(fields(await change(t, { currentPassword: 'segredo123', newPassword: '1234567' }))).toContainEqual(
      expect.objectContaining({ field: 'newPassword', code: 'TOO_SHORT' }),
    );
    expect((await login('ana@exemplo.com', 'segredo123')).status).toBe(200);
  });

  it('CA10: a 6a senha atual errada em 15 min -> 429 TOO_MANY_ATTEMPTS', async () => {
    const t = await e.sessionFor(idOf(1));
    for (let i = 0; i < 5; i++) expect((await change(t, { currentPassword: 'errada1234', newPassword: 'OutraSenha1' })).status).toBe(400);
    const res = await change(t, { currentPassword: 'errada1234', newPassword: 'OutraSenha1' });
    expect(res.status).toBe(429);
    expect(res.body.details.retryAfterSeconds).toBeGreaterThan(0);
  });

  it('corpo estrito: campo desconhecido -> 400 UNKNOWN_FIELD; sem sessao -> 401', async () => {
    const t = await e.sessionFor(idOf(1));
    expect(fields(await change(t, { currentPassword: 'segredo123', newPassword: 'OutraSenha1', userId: idOf(2) }))).toContainEqual(
      expect.objectContaining({ field: 'userId', code: 'UNKNOWN_FIELD' }),
    );
    expect((await e.http().put('/api/account/password').send({})).status).toBe(401);
  });
});

describe('A5 PUT /api/account/profile', () => {
  const profile = (token: string, body: object) => e.http().put('/api/account/profile').set(bearer(token)).send(body);

  it('CA11: normaliza o nome e devolve o usuario atual', async () => {
    const res = await profile(await e.sessionFor(idOf(1)), { name: '  ana   lima ' });
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ id: idOf(1), name: 'ana lima', email: 'ana@exemplo.com', role: 'USER' });
  });

  it('CA11: email ou role no corpo -> 400 UNKNOWN_FIELD nesses campos e nada muda', async () => {
    const res = await profile(await e.sessionFor(idOf(1)), { name: 'Ana', email: 'x@exemplo.com', role: 'ADMIN' });
    expect(res.status).toBe(400);
    expect(fields(res)).toEqual(expect.arrayContaining([expect.objectContaining({ field: 'email', code: 'UNKNOWN_FIELD' }), expect.objectContaining({ field: 'role', code: 'UNKNOWN_FIELD' })]));
    const [row] = await query<{ name: string; role: string; email: string }>(e.pool, 'SELECT name, role, email FROM users WHERE id = $1', [idOf(1)]);
    expect(row).toEqual({ name: 'Ana Souza', role: 'USER', email: 'ana@exemplo.com' });
  });

  it('nome vazio -> 400 name: REQUIRED; troca obrigatoria pendente -> 403 PASSWORD_CHANGE_REQUIRED', async () => {
    expect(fields(await profile(await e.sessionFor(idOf(1)), { name: '' }))).toContainEqual(expect.objectContaining({ field: 'name', code: 'REQUIRED' }));
    const res = await profile(await e.sessionFor(idOf(3)), { name: 'Carla' });
    expect(res.status).toBe(403);
    expect(res.body.code).toBe('PASSWORD_CHANGE_REQUIRED');
  });
});
