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

  it('CA45: o identificador "demo" (sem @) -> INVALID_CREDENTIALS, sem consultar o repositorio (nao ha alias)', async () => {
    const before = h.users.calls.findByEmail;
    const error = await rejected(login('demo', 'demo'));
    expect(error).toMatchObject({ code: 'INVALID_CREDENTIALS', kind: 'unauthenticated' });
    expect(h.users.calls.findByEmail).toBe(before);
    expect(h.sessions.store.size).toBe(0);
  });

  it('CA45: qualquer outro identificador sem @ segue INVALID_CREDENTIALS', async () => {
    for (const id of ['admin', 'ana', 'showcase']) {
      expect(await rejected(login(id, 'segredo123'))).toMatchObject({ code: 'INVALID_CREDENTIALS' });
    }
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
