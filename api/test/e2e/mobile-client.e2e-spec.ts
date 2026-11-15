import { EnsureShowcaseAccount } from '@identity/application/use-cases/bootstrap/ensure-showcase-account.js';
import { CAST, bearer, idOf, startIdentityE2e, type IdentityE2e } from '../support/identity-e2e.js';

let e: IdentityE2e;
let ana: string;
const prevMin = process.env.MOBILE_MIN_VERSION;
const prevStore = process.env.MOBILE_STORE_URL;
beforeAll(async () => {
  process.env.MOBILE_MIN_VERSION = '1.2.0';
  process.env.MOBILE_STORE_URL = 'https://apps.apple.com/br/app/id1234567890';
  e = await startIdentityE2e();
});
afterAll(async () => {
  await e.close();
  if (prevMin === undefined) delete process.env.MOBILE_MIN_VERSION;
  else process.env.MOBILE_MIN_VERSION = prevMin;
  if (prevStore === undefined) delete process.env.MOBILE_STORE_URL;
  else process.env.MOBILE_STORE_URL = prevStore;
});
beforeEach(async () => {
  await e.resetAll();
  await e.seedUser(CAST.ana);
  ana = await e.sessionFor(idOf(1));
});

const OLD = 'mobile/1.1.9';
const UPDATE_BODY = {
  code: 'APP_UPDATE_REQUIRED',
  message: 'Atualize o aplicativo para continuar.',
  details: { minimumVersion: '1.2.0', storeUrl: 'https://apps.apple.com/br/app/id1234567890' },
};
const ip = () => e.freshIp();

describe('X-Client: ausente ou valido (RNF11)', () => {
  it('sem X-Client o web segue funcionando (WEB)', async () => {
    const res = await e.http().post('/api/auth/login').set('X-Forwarded-For', ip()).send({ email: 'ana@exemplo.com', password: 'segredo123' });
    expect(res.status).toBe(200);
  });

  it('mobile/1.2.0 (igual a minima) entra', async () => {
    const res = await e.http().post('/api/auth/login').set('X-Forwarded-For', ip()).set('X-Client', 'mobile/1.2.0').send({ email: 'ana@exemplo.com', password: 'segredo123' });
    expect(res.status).toBe(200);
  });

  it('mobile/1.10.0 passa (comparacao numerica, nao lexicografica)', async () => {
    const res = await e.http().get('/api/auth/me').set(bearer(ana)).set('X-Client', 'mobile/1.10.0');
    expect(res.status).toBe(200);
  });
});

describe('X-Client malformado -> 400 VALIDATION_ERROR (antes de tudo)', () => {
  it.each(['lixo', 'mobile/abc', 'mobile/1.2', 'android/1.0.0'])('%j', async (value) => {
    const res = await e.http().get('/api/auth/me').set(bearer(ana)).set('X-Client', value);
    expect(res.status).toBe(400);
    expect(res.body).toMatchObject({ code: 'VALIDATION_ERROR', details: { fields: [{ field: 'header.X-Client', code: 'INVALID_FORMAT' }] } });
  });

  it('o 400 vem antes do 401 (sem token)', async () => {
    const res = await e.http().get('/api/auth/me').set('X-Client', 'lixo');
    expect(res.status).toBe(400);
  });
});

describe('426 APP_UPDATE_REQUIRED: roda antes da autenticacao (ADR 0011 6.3)', () => {
  it('login: 426 mesmo com credenciais corretas, e nenhuma sessao e aberta', async () => {
    const res = await e.http().post('/api/auth/login').set('X-Forwarded-For', ip()).set('X-Client', OLD).send({ email: 'ana@exemplo.com', password: 'segredo123' });
    expect(res.status).toBe(426);
    expect(res.body).toEqual(UPDATE_BODY);
    const { rows } = await e.pool.query('SELECT count(*)::int AS c FROM sessions WHERE user_id = $1::uuid', [idOf(1)]);
    expect(rows[0].c).toBe(1); // so a sessao criada no beforeEach
  });

  it('login com corpo invalido -> 426 (vence o 400 de corpo)', async () => {
    const res = await e.http().post('/api/auth/login').set('X-Forwarded-For', ip()).set('X-Client', OLD).send({});
    expect(res.status).toBe(426);
  });

  it('logout (publica) tambem responde 426', async () => {
    const res = await e.http().post('/api/auth/logout').set('X-Client', OLD).set(bearer(ana));
    expect(res.status).toBe(426);
  });

  it('me SEM token: 426, nao 401', async () => {
    const res = await e.http().get('/api/auth/me').set('X-Client', OLD);
    expect(res.status).toBe(426);
    expect(res.body.code).toBe('APP_UPDATE_REQUIRED');
  });

  it('me com token invalido: 426, nao 401', async () => {
    const res = await e.http().get('/api/auth/me').set('X-Client', OLD).set(bearer('invalido'));
    expect(res.status).toBe(426);
  });

  it('rota do finance (com e sem token) -> 426', async () => {
    expect((await e.http().get('/api/summary?month=2026-10').set('X-Client', OLD).set(bearer(ana))).status).toBe(426);
    expect((await e.http().get('/api/summary?month=2026-10').set('X-Client', OLD)).status).toBe(426);
  });

  it('/api/demo/* (removida, ADR 0013) -> 404 ROUTE_NOT_FOUND, sem passar pela checagem de versao', async () => {
    const res = await e.http().get('/api/demo/categories').set('X-Client', OLD);
    expect(res.status).toBe(404);
    expect(res.body.code).toBe('ROUTE_NOT_FOUND');
  });

  it('rota sem casamento continua 404 ROUTE_NOT_FOUND (sem guards)', async () => {
    const res = await e.http().get('/api/nao-existe').set('X-Client', OLD);
    expect(res.status).toBe(404);
    expect(res.body.code).toBe('ROUTE_NOT_FOUND');
  });

  it('o web (sem X-Client) nunca recebe 426, nem em rota inexistente', async () => {
    expect((await e.http().get('/api/demo/categories')).status).toBe(404);
  });
});

describe('Cache-Control e contrato aditivo (6.1, 6.2, RNF11)', () => {
  it('login e me respondem Cache-Control: no-store', async () => {
    const login = await e.http().post('/api/auth/login').set('X-Forwarded-For', ip()).send({ email: 'ana@exemplo.com', password: 'segredo123' });
    expect(login.headers['cache-control']).toContain('no-store');
    const me = await e.http().get('/api/auth/me').set(bearer(ana));
    expect(me.headers['cache-control']).toContain('no-store');
  });

  it('AuthResponse: so campos ACRESCENTADOS (accountKind, capabilities) sobre o contrato anterior', async () => {
    const res = await e.http().post('/api/auth/login').set('X-Forwarded-For', ip()).send({ email: 'ana@exemplo.com', password: 'segredo123' });
    expect(Object.keys(res.body).sort()).toEqual(['session', 'user']);
    expect(Object.keys(res.body.user).sort()).toEqual(['accountKind', 'capabilities', 'email', 'id', 'mustChangePassword', 'name', 'role']);
    expect(Object.keys(res.body.session).sort()).toEqual(['expiresAt', 'token']);
  });

  it.each(['demo@showcase.invalid', 'demo'])('CA30: AuthResponse da conta demo (%s / senha demo) com X-Client mobile/1.2.3 mantem as chaves do contrato', async (identifier) => {
    await e.app.get(EnsureShowcaseAccount).execute({ password: 'demo' });
    const res = await e.http().post('/api/auth/login').set('X-Forwarded-For', ip()).set('X-Client', 'mobile/1.2.3').send({ email: identifier, password: 'demo' });
    expect(res.status).toBe(200);
    expect(Object.keys(res.body).sort()).toEqual(['session', 'user']);
    expect(Object.keys(res.body.user).sort()).toEqual(['accountKind', 'capabilities', 'email', 'id', 'mustChangePassword', 'name', 'role']);
    expect(Object.keys(res.body.session).sort()).toEqual(['expiresAt', 'token']);
    expect(res.body.user).toMatchObject({ email: 'demo@showcase.invalid', accountKind: 'SHOWCASE', capabilities: ['MANAGE_EXPENSES'] });
  });

  it('me de USER comum: accountKind REGULAR e MANAGE_EXPENSES (B6), sem MANAGE_USERS', async () => {
    const res = await e.http().get('/api/auth/me').set(bearer(ana));
    expect(res.body.accountKind).toBe('REGULAR');
    expect(res.body.capabilities).toContain('MANAGE_EXPENSES');
    expect(res.body.capabilities).not.toContain('MANAGE_USERS');
  });

  it('401 continua com WWW-Authenticate: Bearer (RNF10)', async () => {
    const res = await e.http().get('/api/auth/me');
    expect(res.status).toBe(401);
    expect(res.headers['www-authenticate']).toMatch(/Bearer/);
  });
});
