import { CAST, bearer, concretePath, idOf, listRoutes, startIdentityE2e, type IdentityE2e } from '../support/identity-e2e.js';

let e: IdentityE2e;
let tokens: { ana: string; carla: string; vagner: string; expired: string; adulterado: string; loggedOut: string };
beforeAll(async () => {
  e = await startIdentityE2e();
});
afterAll(() => e.close());
beforeEach(async () => {
  await e.resetAll();
  await e.seedUser(CAST.ana);
  await e.seedUser(CAST.carla);
  await e.seedUser(CAST.vagner);
  const ana = await e.sessionFor(idOf(1));
  tokens = {
    ana,
    carla: await e.sessionFor(idOf(3)),
    vagner: await e.sessionFor(idOf(4)),
    expired: await e.sessionFor(idOf(1), { createdAtOffsetMs: -25 * 3_600_000, expiresAtOffsetMs: -3_600_000 }),
    adulterado: `${ana.slice(0, -2)}xx`,
    loggedOut: await e.sessionFor(idOf(1)),
  };
  await e.http().post('/api/auth/logout').set(bearer(tokens.loggedOut));
});

/** Rotas esperadas (ADR 0005 6.2, 6.3; ADR 0013 6.1: a demonstracao publica foi removida). Se alguem adicionar uma rota, este teste forca decidir se ela e publica. */
const PUBLIC = [
  'POST /api/auth/login',
  'POST /api/auth/logout',
].sort();
const ALLOWED_DURING_PASSWORD_CHANGE = ['GET /api/auth/me', 'PUT /api/account/password'].sort();
const ADMIN_ROUTES = [
  'GET /api/admin/users',
  'GET /api/admin/users/:id',
  'POST /api/admin/users',
  'PUT /api/admin/users/:id',
  'POST /api/admin/users/:id/deactivate',
  'POST /api/admin/users/:id/reactivate',
  'POST /api/admin/users/:id/password-reset',
].sort();
// B6 (ADR 0011): editar/excluir lancamento exige a capacidade MANAGE_EXPENSES, que toda conta autenticada tem;
// o escopo por dono (404) e coberto em entries-manage-authz.e2e-spec.ts. Deixam de ser rotas exclusivas de ADMIN.
const PROTECTED_FINANCE = [
  'POST /api/entries',
  'POST /api/entries/installments',
  'GET /api/entries/expenses',
  'GET /api/entries/incomes',
  'GET /api/entries/initial-month',
  'POST /api/entries/pay',
  'POST /api/entries/:id/pay',
  'PUT /api/entries/:id',
  'DELETE /api/entries/:id',
  'GET /api/categories',
  'POST /api/cards',
  'GET /api/cards',
  'PUT /api/cards/:id',
  'GET /api/invoices',
  'GET /api/cards/:cardId/invoices/:referenceMonth/entries',
  'POST /api/cards/:cardId/invoices/:referenceMonth/pay',
  'GET /api/summary',
  'GET /api/dashboard/monthly-series',
  'GET /api/dashboard/category-distribution',
];
const label = (r: { method: string; path: string }) => `${r.method} ${r.path}`;
const routes = () => listRoutes(e.app);
const call = (r: { method: string; path: string }, token?: string, body: object = { lixo: true }) => {
  const req = (e.http() as any)[r.method.toLowerCase()](concretePath(r.path)).set('X-Forwarded-For', e.freshIp());
  if (token) req.set(bearer(token));
  return ['POST', 'PUT', 'PATCH'].includes(r.method) ? req.send(body) : req;
};
const protectedRoutes = () => routes().filter((r) => !PUBLIC.includes(label(r)));

describe('inventario de rotas (seguro por padrao)', () => {
  it('as rotas publicas sao EXATAMENTE login e logout (nenhuma rota de leitura sem autenticacao, ADR 0013)', () => {
    const all = routes().map(label);
    expect(all.filter((r) => PUBLIC.includes(r)).sort()).toEqual(PUBLIC);
  });

  it('as rotas protegidas conhecidas existem e nao ha rota de cadastro', () => {
    const all = routes().map(label);
    for (const r of [...PROTECTED_FINANCE, ...ADMIN_ROUTES, ...ALLOWED_DURING_PASSWORD_CHANGE, 'PUT /api/account/profile']) expect(all).toContain(r);
    expect(all.some((r) => /register|signup/i.test(r))).toBe(false);
  });
});

describe('CA27 / RF22: 401 UNAUTHENTICATED antes de qualquer validacao, em TODA rota protegida', () => {
  const variants: [string, () => string | undefined][] = [
    ['sem credencial', () => undefined],
    ['token adulterado', () => tokens.adulterado],
    ['token aleatorio', () => 'nao-e-um-token'],
    ['sessao expirada', () => tokens.expired],
    ['sessao encerrada por logout', () => tokens.loggedOut],
  ];
  it.each(variants)('%s', async (_name, token) => {
    for (const r of protectedRoutes()) {
      const res = await call(r, token());
      expect(res.status, label(r)).toBe(401);
      expect(res.body, label(r)).toEqual({ code: 'UNAUTHENTICATED', message: expect.any(String), details: null });
      expect(res.headers['www-authenticate'], label(r)).toBe('Bearer');
    }
  });

  it('esquema diferente de Bearer (Basic) tambem e 401', async () => {
    const res = await e.http().get('/api/summary?month=2026-10').set('Authorization', 'Basic YW5hOnNlZ3JlZG8=');
    expect(res.status).toBe(401);
  });

  it('D12: JSON malformado sai antes do 401 (body parser roda antes dos guards)', async () => {
    const res = await e.http().post('/api/cards').set('Content-Type', 'application/json').send('{"name":');
    expect(res.status).toBe(400);
    expect(res.body.code).toBe('MALFORMED_JSON');
  });

  it('rota inexistente continua 404 ROUTE_NOT_FOUND (inclusive sem sessao)', async () => {
    const res = await e.http().post('/api/nao-existe').send({});
    expect(res.status).toBe(404);
    expect(res.body.code).toBe('ROUTE_NOT_FOUND');
  });
});

describe('RF07 / T13: troca obrigatoria de senha (403 PASSWORD_CHANGE_REQUIRED)', () => {
  it('toda rota protegida, exceto GET /api/auth/me e PUT /api/account/password, responde 403 antes de validar corpo ou query', async () => {
    for (const r of protectedRoutes()) {
      const res = await call(r, tokens.carla);
      if (ALLOWED_DURING_PASSWORD_CHANGE.includes(label(r))) {
        expect(res.status, label(r)).not.toBe(403);
      } else {
        expect(res.status, label(r)).toBe(403);
        expect(res.body, label(r)).toEqual({ code: 'PASSWORD_CHANGE_REQUIRED', message: 'Defina uma nova senha para continuar.', details: null });
      }
    }
  });

  it('CA08: GET /api/summary com query invalida ainda e 403 PASSWORD_CHANGE_REQUIRED (nao 400)', async () => {
    const res = await e.http().get('/api/summary?month=invalido').set(bearer(tokens.carla));
    expect(res.status).toBe(403);
    expect(res.body.code).toBe('PASSWORD_CHANGE_REQUIRED');
  });

  it('usuario atual, trocar senha e logout funcionam durante a troca obrigatoria', async () => {
    expect((await e.http().get('/api/auth/me').set(bearer(tokens.carla))).status).toBe(200);
    expect((await e.http().put('/api/account/password').set(bearer(tokens.carla)).send({ currentPassword: 'Temp1234', newPassword: 'MinhaSenha9' })).status).toBe(200);
    expect((await e.http().post('/api/auth/logout').set(bearer(tokens.carla))).status).toBe(204);
  });
});

describe('RF10: 403 FORBIDDEN nas rotas de gestao (nivel verificado a cada requisicao)', () => {
  it('USER com corpo/id invalido em TODAS as rotas de gestao -> 403 FORBIDDEN, nunca 400/404', async () => {
    for (const r of ADMIN_ROUTES.map((l) => ({ method: l.split(' ')[0], path: l.split(' ')[1] }))) {
      const res = await call(r, tokens.ana);
      expect(res.status, label(r)).toBe(403);
      expect(res.body, label(r)).toEqual({ code: 'FORBIDDEN', message: 'Você não tem permissão para esta ação.', details: {} });
    }
  });

  it('nenhuma outra rota exige nivel ADMIN: Ana nunca recebe FORBIDDEN fora de /api/admin/users*', async () => {
    for (const r of protectedRoutes().filter((x) => !ADMIN_ROUTES.includes(label(x)))) {
      const res = await call(r, tokens.ana);
      expect(res.body?.code, label(r)).not.toBe('FORBIDDEN');
    }
  });

  it('o administrador passa do guard (vira 400/404/200 conforme a regra de cada rota)', async () => {
    for (const r of ADMIN_ROUTES.map((l) => ({ method: l.split(' ')[0], path: l.split(' ')[1] }))) {
      const res = await call(r, tokens.vagner);
      expect([401, 403], label(r)).not.toContain(res.status);
    }
  });
});

describe('precedencia: 401 > 403 PASSWORD_CHANGE_REQUIRED > 403 FORBIDDEN > 400 > 404', () => {
  it('sem sessao + corpo invalido em rota de admin -> 401', async () => {
    expect((await e.http().post('/api/admin/users').send({})).status).toBe(401);
  });

  it('troca obrigatoria + rota de admin -> PASSWORD_CHANGE_REQUIRED (vence FORBIDDEN)', async () => {
    const res = await e.http().post('/api/admin/users').set(bearer(tokens.carla)).send({});
    expect(res.body.code).toBe('PASSWORD_CHANGE_REQUIRED');
  });

  it('USER + corpo invalido -> FORBIDDEN (vence 400); ADMIN + corpo invalido -> 400', async () => {
    expect((await e.http().post('/api/admin/users').set(bearer(tokens.ana)).send({})).body.code).toBe('FORBIDDEN');
    const admin = await e.http().post('/api/admin/users').set(bearer(tokens.vagner)).send({});
    expect(admin.status).toBe(400);
    expect(admin.body.code).toBe('VALIDATION_ERROR');
  });

  it('ADMIN + id malformado -> 400; id inexistente -> 404 USER_NOT_FOUND', async () => {
    expect((await e.http().get('/api/admin/users/abc').set(bearer(tokens.vagner))).status).toBe(400);
    const missing = await e.http().get('/api/admin/users/0a000000-0000-7000-8000-0000000000ee').set(bearer(tokens.vagner));
    expect(missing.status).toBe(404);
    expect(missing.body.code).toBe('USER_NOT_FOUND');
  });

  it('todos os erros seguem { code, message, details }', async () => {
    for (const res of [await call({ method: 'GET', path: '/api/summary' }), await call({ method: 'POST', path: '/api/admin/users' }, tokens.ana)]) {
      expect(Object.keys(res.body).sort()).toEqual(['code', 'details', 'message']);
    }
  });
});
