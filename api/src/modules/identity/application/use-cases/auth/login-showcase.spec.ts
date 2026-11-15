import { NOW, rejected } from '@test/support/builders.js';
import { aUser, ana, userUuid } from '@test/support/identity-builders.js';
import { SHOWCASE_EMAIL, SHOWCASE_ID, showcaseUser } from '@test/support/showcase-builders.js';
import { buildShowcaseHarness, mobileClient, webClient, type ShowcaseHarness } from '@test/support/showcase-harness.js';

const IP = '203.0.113.9';
let h: ShowcaseHarness;

beforeEach(() => {
  h = buildShowcaseHarness();
  h.users.seed(ana());
  h.users.seed(showcaseUser());
});

const login = (email: unknown, password: unknown, client = webClient()) => h.login.execute({ email, password, clientIp: IP, client } as never);

describe('LoginWithPassword: conta de demonstracao (CA44, B5)', () => {
  it('demo@showcase.invalid + demo entra pelo fluxo comum: accountKind SHOWCASE e capacidades da conta', async () => {
    const result = await login(SHOWCASE_EMAIL, 'demo');
    expect(result.user).toMatchObject({
      id: SHOWCASE_ID,
      email: SHOWCASE_EMAIL,
      name: 'Conta de demonstração',
      role: 'USER',
      mustChangePassword: false,
      accountKind: 'SHOWCASE',
      capabilities: ['MANAGE_EXPENSES'],
    });
    expect(h.sessions.ofUser(SHOWCASE_ID)).toHaveLength(1);
  });

  it('normaliza o e-mail da conta (trim + caixa)', async () => {
    await expect(login('  DEMO@Showcase.INVALID ', 'demo')).resolves.toBeDefined();
  });

  it('CA13: o e-mail canonico continua entrando (viaAlias nao muda o resultado)', async () => {
    const result = await login(SHOWCASE_EMAIL, 'demo');
    expect(result.user.email).toBe(SHOWCASE_EMAIL);
  });

  it('senha errada -> INVALID_CREDENTIALS com a mesma mensagem generica', async () => {
    expect(await rejected(login(SHOWCASE_EMAIL, 'errada'))).toMatchObject({ code: 'INVALID_CREDENTIALS', message: 'E-mail ou senha inválidos.' });
  });

  it('conta inativa (interruptor desligado) -> INVALID_CREDENTIALS', async () => {
    h.users.store.clear();
    h.users.seed(showcaseUser({ status: 'INACTIVE' }));
    expect(await rejected(login(SHOWCASE_EMAIL, 'demo'))).toMatchObject({ code: 'INVALID_CREDENTIALS' });
  });
});

describe('LoginWithPassword: alias "demo" (ADR 0013, B1, RF11, CA12, CA14)', () => {
  it.each(['demo', 'Demo', ' demo ', 'DEMO'])('CA12: %j + senha demo entra na conta demo; a resposta traz o e-mail canonico', async (alias) => {
    const result = await login(alias, 'demo');
    expect(result.user).toMatchObject({ id: SHOWCASE_ID, email: SHOWCASE_EMAIL, name: 'Conta de demonstração', accountKind: 'SHOWCASE' });
    expect(h.sessions.ofUser(SHOWCASE_ID)).toHaveLength(1);
  });

  it('CA12: alias com senha errada -> INVALID_CREDENTIALS generico (mesma mensagem de qualquer credencial invalida)', async () => {
    const error = await rejected(login('demo', 'errada'));
    expect(error).toMatchObject({ code: 'INVALID_CREDENTIALS', kind: 'unauthenticated', message: 'E-mail ou senha inválidos.' });
    expect(h.sessions.store.size).toBe(0);
  });

  it.each(['admin', 'ana', 'demo2', 'showcase', 'de mo'])('CA14: %j (sem @) + qualquer senha -> INVALID_CREDENTIALS, sem sessao', async (id) => {
    for (const password of ['demo', 'segredo123']) {
      expect(await rejected(login(id, password))).toMatchObject({ code: 'INVALID_CREDENTIALS', message: 'E-mail ou senha inválidos.' });
    }
    expect(h.sessions.store.size).toBe(0);
  });

  it('CA14: identificador invalido responde igual a senha errada (nao enumera) e ainda executa a verificacao do hash (RNF05)', async () => {
    const before = h.hasher.verifyCalls;
    const invalid = await rejected(login('admin', 'demo'));
    const wrong = await rejected(login('ana@exemplo.com', 'errada1234'));
    expect({ code: invalid.code, message: invalid.message, kind: invalid.kind }).toEqual({ code: wrong.code, message: wrong.message, kind: wrong.kind });
    expect(h.hasher.verifyCalls).toBe(before + 2);
  });

  it('RF11: com a conta demo INATIVA, demo/demo -> INVALID_CREDENTIALS (como qualquer credencial invalida)', async () => {
    h.users.store.clear();
    h.users.seed(showcaseUser({ status: 'INACTIVE' }));
    expect(await rejected(login('demo', 'demo'))).toMatchObject({ code: 'INVALID_CREDENTIALS' });
    expect(h.sessions.store.size).toBe(0);
  });

  it('RF11/CA11: com a conta demo AUSENTE, demo/demo -> INVALID_CREDENTIALS', async () => {
    h.users.store.clear();
    h.users.seed(ana());
    expect(await rejected(login('demo', 'demo'))).toMatchObject({ code: 'INVALID_CREDENTIALS' });
  });

  it('o alias so vale para a conta demo: um REGULAR com e-mail "demo@exemplo.com" nao e alcancado por "demo"', async () => {
    h.users.seed(aUser({ id: userUuid(60), name: 'Outra Demo', email: 'demo@exemplo.com', password: 'segredo123' }));
    expect(await rejected(login('demo', 'segredo123'))).toMatchObject({ code: 'INVALID_CREDENTIALS' });
  });

  it('auditoria: loginSucceeded e loginFailed pelo alias registram o e-mail canonico (nao o texto digitado); sem senha', async () => {
    await login('Demo', 'demo');
    await rejected(login('demo', 'errada-secreta'));
    expect(h.audit.of('loginSucceeded')[0].payload).toMatchObject({ userId: SHOWCASE_ID });
    expect(h.audit.of('loginFailed')[0].payload).toMatchObject({ email: { value: SHOWCASE_EMAIL }, userId: SHOWCASE_ID });
    expect(JSON.stringify(h.audit.calls)).not.toContain('errada-secreta');
  });
});

describe('LoginWithPassword: limite de tentativas com o alias (RF11, T3)', () => {
  it('a conta demo segue isenta do limite por identificador pelo alias: 6 erros e o 7o login correto passa', async () => {
    for (let i = 0; i < 6; i++) await rejected(login('demo', 'errada'));
    expect(h.limiter.failureCount('login-email-failures', SHOWCASE_EMAIL)).toBe(0);
    expect(h.limiter.failureCount('login-email-failures', 'demo')).toBe(0);
    await expect(login('demo', 'demo')).resolves.toBeDefined();
  });

  it('alias e e-mail canonico contam como a MESMA chave: REGULAR com o e-mail reservado, 3 falhas por "demo" + 2 pelo e-mail = bloqueio', async () => {
    h.users.store.clear();
    h.users.seed(aUser({ id: userUuid(77), name: 'Intruso', email: SHOWCASE_EMAIL, password: 'segredo123' }));
    for (let i = 0; i < 3; i++) await rejected(login('demo', 'errada123'));
    for (let i = 0; i < 2; i++) await rejected(login(SHOWCASE_EMAIL, 'errada123'));
    expect(h.limiter.failureCount('login-email-failures', SHOWCASE_EMAIL)).toBe(5);
    expect(h.limiter.failureCount('login-email-failures', 'demo')).toBe(0);
    expect(await rejected(login('demo', 'segredo123'))).toMatchObject({ code: 'TOO_MANY_ATTEMPTS', kind: 'rate_limited' });
    expect(await rejected(login(SHOWCASE_EMAIL, 'segredo123'))).toMatchObject({ code: 'TOO_MANY_ATTEMPTS' });
  });

  it('identificador sem @ invalido: a chave e o texto normalizado (trim + minusculas), igual em qualquer grafia', async () => {
    await rejected(login(' Admin ', 'x'));
    await rejected(login('ADMIN', 'x'));
    expect(h.limiter.failureCount('login-email-failures', 'admin')).toBe(2);
  });

  it('e-mail comum: normalizacao da chave inalterada (regressao)', async () => {
    await rejected(login(' ANA@Exemplo.com ', 'errada123'));
    expect(h.limiter.failureCount('login-email-failures', 'ana@exemplo.com')).toBe(1);
  });
});

describe('LoginWithPassword: sem bloqueio por e-mail para a conta demo (ADR 0011 3.4)', () => {
  it('6 erros seguidos e o 7o login correto passa; nada alimenta login-email-failures', async () => {
    for (let i = 0; i < 6; i++) await rejected(login(SHOWCASE_EMAIL, 'errada'));
    expect(h.limiter.failureCount('login-email-failures', SHOWCASE_EMAIL)).toBe(0);
    await expect(login(SHOWCASE_EMAIL, 'demo')).resolves.toBeDefined();
  });

  it('I4: um REGULAR com o e-mail reservado (criado direto no banco) continua bloqueado apos 5 falhas', async () => {
    h.users.store.clear();
    h.users.seed(aUser({ id: userUuid(77), name: 'Intruso', email: SHOWCASE_EMAIL, password: 'segredo123' }));
    for (let i = 0; i < 5; i++) await rejected(login(SHOWCASE_EMAIL, 'errada123'));
    expect(h.limiter.failureCount('login-email-failures', SHOWCASE_EMAIL)).toBe(5);
    expect(await rejected(login(SHOWCASE_EMAIL, 'segredo123'))).toMatchObject({ code: 'TOO_MANY_ATTEMPTS', kind: 'rate_limited' });
    expect(h.hasher.verifyCalls).toBe(5);
  });

  it('a verificacao do hash continua em todas as tentativas (RNF05)', async () => {
    await rejected(login(SHOWCASE_EMAIL, 'errada'));
    await login(SHOWCASE_EMAIL, 'demo');
    expect(h.hasher.verifyCalls).toBe(2);
  });

  it('regressao: e-mail comum continua bloqueando apos 5 falhas (429), mesmo com a senha correta', async () => {
    for (let i = 0; i < 5; i++) await rejected(login('ana@exemplo.com', 'errada123'));
    expect(await rejected(login('ana@exemplo.com', 'segredo123'))).toMatchObject({ code: 'TOO_MANY_ATTEMPTS', kind: 'rate_limited' });
  });
});

describe('LoginWithPassword: tipo de cliente na auditoria (RNF13)', () => {
  it('web: loginSucceeded com client WEB e sem versao', async () => {
    await login('ana@exemplo.com', 'segredo123', webClient());
    expect(h.audit.of('loginSucceeded')[0].payload).toMatchObject({ client: { kind: 'WEB', appVersion: null } });
  });

  it('mobile: loginSucceeded com client MOBILE e a versao', async () => {
    await login('ana@exemplo.com', 'segredo123', mobileClient('1.4.0'));
    expect(h.audit.of('loginSucceeded')[0].payload).toMatchObject({ client: { kind: 'MOBILE', appVersion: '1.4.0' } });
  });

  it('loginFailed tambem registra o cliente, sem senha', async () => {
    await rejected(login('ana@exemplo.com', 'errada123', mobileClient('1.4.0')));
    const call = h.audit.of('loginFailed')[0];
    expect(call.payload).toMatchObject({ client: { kind: 'MOBILE', appVersion: '1.4.0' } });
    expect(JSON.stringify(h.audit.calls)).not.toContain('errada123');
  });

  it('a sessao do app dura 24 h, igual a do web (B2)', async () => {
    const r = await login('ana@exemplo.com', 'segredo123', mobileClient());
    expect(r.session.expiresAt).toEqual(new Date(NOW.getTime() + 24 * 3_600_000));
  });
});

describe('LoginWithPassword: usuario REGULAR traz accountKind e capacidades (P-ADR5, B6)', () => {
  it('USER comum: accountKind REGULAR e MANAGE_EXPENSES', async () => {
    const r = await login('ana@exemplo.com', 'segredo123');
    expect(r.user.accountKind).toBe('REGULAR');
    expect([...r.user.capabilities].sort()).toEqual(['CHANGE_OWN_PASSWORD', 'MANAGE_EXPENSES', 'UPDATE_OWN_PROFILE']);
  });
});
