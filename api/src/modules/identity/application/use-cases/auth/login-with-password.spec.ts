import { DEMO_USER_ID, FIRST_ADMIN_ID } from '@shared/domain/well-known-ids.js';
import { NOW, rejected } from '@test/support/builders.js';
import { ana, bruno, carla, demoUser, firstAdminMarker } from '@test/support/identity-builders.js';
import { buildIdentityHarness, type IdentityHarness } from '@test/support/identity-harness.js';

const IP = '203.0.113.9';
const H24 = 24 * 60 * 60 * 1000;
let h: IdentityHarness;

beforeEach(() => {
  h = buildIdentityHarness();
  h.users.seed(ana());
  h.users.seed(bruno({ status: 'INACTIVE' }));
  h.users.seed(carla());
  h.users.seed(demoUser());
  h.users.seed(firstAdminMarker());
});

const login = (email: unknown, password: unknown) => h.login.execute({ email, password, clientIp: IP });

describe('LoginWithPassword: sucesso (RF01, CA01)', () => {
  it('abre sessao de 24 h, devolve o usuario atual e o token em claro', async () => {
    const result = await login('ana@exemplo.com', 'segredo123');
    expect(result.user).toEqual({
      id: ana().id.value,
      name: 'Ana Souza',
      email: 'ana@exemplo.com',
      role: 'USER',
      mustChangePassword: false,
    });
    expect(result.session.token).toEqual(expect.any(String));
    expect(result.session.expiresAt).toEqual(new Date(NOW.getTime() + H24));
    expect(h.sessions.ofUser(ana().id.value)).toHaveLength(1);
    expect(h.sessions.ofUser(ana().id.value)[0].expiresAt).toEqual(new Date(NOW.getTime() + H24));
  });

  it('a sessao gravada corresponde ao digest do token devolvido (o token em claro nunca e gravado)', async () => {
    const { session } = await login('ana@exemplo.com', 'segredo123');
    const digest = h.tokens.digest(session.token)!;
    const stored = await h.sessions.findActiveByDigest(digest, NOW);
    expect(stored?.userId.value).toBe(ana().id.value);
    expect(JSON.stringify([...h.sessions.store.values()].map((s) => s.toSnapshot()))).not.toContain(session.token);
  });

  it('normaliza o e-mail (trim + minusculas)', async () => {
    const result = await login('  ANA@Exemplo.com ', 'segredo123');
    expect(result.user.email).toBe('ana@exemplo.com');
  });

  it('nunca devolve hash nem senha', async () => {
    const result = await login('ana@exemplo.com', 'segredo123');
    const text = JSON.stringify(result);
    expect(text).not.toContain('fake');
    expect(text).not.toContain('segredo123');
    expect(text).not.toMatch(/passwordHash/i);
  });

  it('auditoria: loginSucceeded com userId e IP; publica SessionOpened', async () => {
    await login('ana@exemplo.com', 'segredo123');
    expect(h.audit.of('loginSucceeded')).toHaveLength(1);
    expect(h.audit.of('loginSucceeded')[0].payload).toMatchObject({ userId: ana().id.value, clientIp: IP });
    expect(h.publisher.names()).toContain('SessionOpened');
  });

  it('sucesso zera as falhas acumuladas do e-mail', async () => {
    for (let i = 0; i < 3; i++) await rejected(login('ana@exemplo.com', 'errada123'));
    expect(h.limiter.failureCount('login-email-failures', 'ana@exemplo.com')).toBe(3);
    await login('ana@exemplo.com', 'segredo123');
    expect(h.limiter.failureCount('login-email-failures', 'ana@exemplo.com')).toBe(0);
  });

  it('RF07: usuario com troca obrigatoria PODE entrar; a resposta traz mustChangePassword = true', async () => {
    const result = await login('carla@exemplo.com', 'Temp1234');
    expect(result.user.mustChangePassword).toBe(true);
    expect(h.sessions.ofUser(carla().id.value)).toHaveLength(1);
  });
});

describe('LoginWithPassword: credenciais invalidas sem enumeracao (CA03, RNF05)', () => {
  const cases: [string, string, string][] = [
    ['senha errada de usuaria ativa', 'ana@exemplo.com', 'errada123'],
    ['e-mail inexistente', 'naoexiste@exemplo.com', 'segredo123'],
    ['usuario inativo com a senha correta', 'bruno@exemplo.com', 'segredo123'],
    ['usuario demo', 'demo@finance.invalid', 'segredo123'],
    ['marcador do primeiro administrador', 'first-admin@finance.invalid', 'segredo123'],
  ];

  it.each(cases)('%s -> 401 INVALID_CREDENTIALS, 1 verificacao de hash, nenhuma sessao', async (_l, email, password) => {
    const error = await rejected(login(email, password));
    expect(error).toMatchObject({ code: 'INVALID_CREDENTIALS', kind: 'unauthenticated', message: 'E-mail ou senha inválidos.', details: null });
    expect(h.hasher.verifyCalls).toBe(1);
    expect(h.sessions.store.size).toBe(0);
    expect(h.audit.of('loginFailed')).toHaveLength(1);
  });

  it('as respostas sao indistinguiveis entre si (mesma message e mesmos details)', async () => {
    const errors = [];
    for (const [, email, password] of cases) errors.push(await rejected(login(email, password)));
    expect(new Set(errors.map((e) => e.message)).size).toBe(1);
    expect(new Set(errors.map((e) => JSON.stringify(e.details))).size).toBe(1);
    expect(new Set(errors.map((e) => e.code)).size).toBe(1);
  });

  it('falha registra tentativa por e-mail (inclusive para e-mail inexistente)', async () => {
    await rejected(login('naoexiste@exemplo.com', 'x12345678'));
    expect(h.limiter.failureCount('login-email-failures', 'naoexiste@exemplo.com')).toBe(1);
  });

  it('auditoria nao recebe a senha', async () => {
    await rejected(login('ana@exemplo.com', 'errada123'));
    expect(JSON.stringify(h.audit.calls)).not.toContain('errada123');
  });
});

describe('LoginWithPassword: limite de tentativas (CA04, RNF04)', () => {
  it('apos 5 falhas, a 6a tentativa ainda com senha CORRETA -> 429 com retryAfterSeconds > 0, sem verificar hash', async () => {
    for (let i = 0; i < 5; i++) await rejected(login('ana@exemplo.com', 'errada123'));
    const verifyBefore = h.hasher.verifyCalls;
    const error = await rejected(login('ana@exemplo.com', 'segredo123'));
    expect(error).toMatchObject({ code: 'TOO_MANY_ATTEMPTS', kind: 'rate_limited' });
    expect(error.details.retryAfterSeconds).toBeGreaterThan(0);
    expect(h.hasher.verifyCalls).toBe(verifyBefore);
    expect(h.sessions.store.size).toBe(0);
    expect(h.audit.of('rateLimited')[0].payload).toMatchObject({ scope: 'login-email-failures', clientIp: IP });
  });

  it('4 falhas ainda permitem entrar com a senha correta', async () => {
    for (let i = 0; i < 4; i++) await rejected(login('ana@exemplo.com', 'errada123'));
    await expect(login('ana@exemplo.com', 'segredo123')).resolves.toBeDefined();
  });

  it('o limite e por e-mail: bloquear Ana nao bloqueia Carla', async () => {
    for (let i = 0; i < 5; i++) await rejected(login('ana@exemplo.com', 'errada123'));
    await expect(login('carla@exemplo.com', 'Temp1234')).resolves.toBeDefined();
  });
});

describe('LoginWithPassword: validacao (D13)', () => {
  it.each([
    ['senha ausente', 'ana@exemplo.com', undefined, 'password'],
    ['senha nao string', 'ana@exemplo.com', 123, 'password'],
    ['e-mail ausente', undefined, 'segredo123', 'email'],
    ['e-mail nao string', 42, 'segredo123', 'email'],
  ])('%s -> 400 VALIDATION_ERROR (REQUIRED) em %s, sem tocar no hash', async (_l, email, password, field) => {
    const error = await rejected(login(email, password));
    expect(error).toMatchObject({ code: 'VALIDATION_ERROR', kind: 'validation' });
    expect(error.details.fields).toContainEqual(expect.objectContaining({ field, code: 'REQUIRED' }));
    expect(h.hasher.verifyCalls).toBe(0);
  });

  it('D13: e-mail com formato invalido NAO e 400: cai em INVALID_CREDENTIALS (sem terceira resposta distinguivel)', async () => {
    const error = await rejected(login('ana@', 'segredo123'));
    expect(error.code).toBe('INVALID_CREDENTIALS');
  });

  it('senha curta no login tambem e INVALID_CREDENTIALS (regras de senha so valem ao DEFINIR)', async () => {
    const error = await rejected(login('ana@exemplo.com', 'abc'));
    expect(error.code).toBe('INVALID_CREDENTIALS');
  });

  it('precedencia 400 > 429: corpo invalido vence o bloqueio', async () => {
    for (let i = 0; i < 5; i++) await rejected(login('ana@exemplo.com', 'errada123'));
    const error = await rejected(login('ana@exemplo.com', undefined));
    expect(error.code).toBe('VALIDATION_ERROR');
  });
});

describe('ids reservados', () => {
  it('o usuario demo nunca autentica, mesmo existindo no repositorio', async () => {
    expect(DEMO_USER_ID).toBeDefined();
    expect(FIRST_ADMIN_ID).toBeDefined();
    const error = await rejected(login('demo@finance.invalid', 'qualquer123'));
    expect(error.code).toBe('INVALID_CREDENTIALS');
  });
});
