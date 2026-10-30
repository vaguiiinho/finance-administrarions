import { NOW, rejected } from '@test/support/builders.js';
import { ana, carla, userUuid } from '@test/support/identity-builders.js';
import { buildIdentityHarness, type IdentityHarness } from '@test/support/identity-harness.js';

const IP = '203.0.113.9';
let h: IdentityHarness;
beforeEach(() => {
  h = buildIdentityHarness();
});

const change = (userId: string, sessionId: string, currentPassword: unknown, newPassword: unknown) =>
  h.changePassword.execute({ userId, sessionId, currentPassword, newPassword, clientIp: IP });
const fieldsOf = (e: { details?: any }) => (e.details.fields as { field: string; code: string }[]).map((f) => `${f.field}:${f.code}`).sort();

describe('ChangeOwnPassword (RF08, CA09, CA10)', () => {
  it('CA09: sucesso troca o hash, desliga a troca obrigatoria e devolve o usuario atual', async () => {
    h.users.seed(carla());
    const current = h.openSession(carla());
    const view = await change(carla().id.value, current.sessionId, 'Temp1234', 'MinhaSenha9');
    expect(view).toMatchObject({ id: carla().id.value, mustChangePassword: false });
    const stored = h.users.get(carla().id.value)!;
    expect(stored.passwordHash?.value).toBe('$fake$MinhaSenha9');
    expect(stored.mustChangePassword).toBe(false);
  });

  it('P16: encerra as OUTRAS sessoes e mantem a atual', async () => {
    h.users.seed(carla());
    h.users.seed(ana());
    const other = h.openSession(carla());
    const current = h.openSession(carla());
    const anas = h.openSession(ana());
    await change(carla().id.value, current.sessionId, 'Temp1234', 'MinhaSenha9');
    expect(h.sessions.ofUser(carla().id.value).map((s) => s.id.value)).toEqual([current.sessionId]);
    expect(h.sessions.ofUser(ana().id.value).map((s) => s.id.value)).toEqual([anas.sessionId]);
    expect((await rejected(h.authenticate.execute({ token: other.token }))).code).toBe('UNAUTHENTICATED');
    await expect(h.authenticate.execute({ token: current.token })).resolves.toBeDefined();
  });

  it('usuario sem troca pendente tambem pode trocar (opcional)', async () => {
    h.users.seed(ana());
    const { sessionId } = h.openSession(ana());
    await change(ana().id.value, sessionId, 'segredo123', 'OutraSenha1');
    expect(h.users.get(ana().id.value)!.passwordHash?.value).toBe('$fake$OutraSenha1');
  });

  it('hash e sessoes mudam na mesma transacao; auditoria passwordChanged sem senhas; PasswordChanged publicado', async () => {
    h.users.seed(ana());
    const { sessionId } = h.openSession(ana());
    await change(ana().id.value, sessionId, 'segredo123', 'OutraSenha1');
    expect(h.uow.runs).toBe(1);
    expect(h.audit.of('passwordChanged')[0].payload).toMatchObject({ userId: ana().id.value, clientIp: IP });
    const text = JSON.stringify(h.audit.calls) + JSON.stringify(h.publisher.published);
    expect(text).not.toContain('segredo123');
    expect(text).not.toContain('OutraSenha1');
    expect(h.publisher.names()).toContain('PasswordChanged');
  });

  it('CA10: senha atual errada -> 400 currentPassword: INCORRECT; nada muda; conta como falha', async () => {
    h.users.seed(ana());
    const { sessionId } = h.openSession(ana());
    const error = await rejected(change(ana().id.value, sessionId, 'errada1234', 'OutraSenha1'));
    expect(error).toMatchObject({ code: 'VALIDATION_ERROR', kind: 'validation' });
    expect(fieldsOf(error)).toEqual(['currentPassword:INCORRECT']);
    expect(h.users.get(ana().id.value)!.passwordHash?.value).toBe('$fake$segredo123');
    expect(h.limiter.failureCount('password-change-user-failures', ana().id.value)).toBe(1);
    expect(h.sessions.ofUser(ana().id.value)).toHaveLength(1);
  });

  it('CA10: nova igual a atual -> newPassword: SAME_AS_CURRENT; senha nao muda', async () => {
    h.users.seed(ana());
    const { sessionId } = h.openSession(ana());
    const error = await rejected(change(ana().id.value, sessionId, 'segredo123', 'segredo123'));
    expect(fieldsOf(error)).toEqual(['newPassword:SAME_AS_CURRENT']);
    expect(h.users.get(ana().id.value)!.passwordHash?.value).toBe('$fake$segredo123');
  });

  it('CA10: "1234567" -> newPassword: TOO_SHORT, SEM verificar a senha atual', async () => {
    h.users.seed(ana());
    const { sessionId } = h.openSession(ana());
    const error = await rejected(change(ana().id.value, sessionId, 'segredo123', '1234567'));
    expect(fieldsOf(error)).toEqual(['newPassword:TOO_SHORT']);
    expect(h.hasher.verifyCalls).toBe(0);
  });

  it('73 caracteres -> TOO_LONG; ausentes -> REQUIRED; acumula os dois campos', async () => {
    h.users.seed(ana());
    const { sessionId } = h.openSession(ana());
    expect(fieldsOf(await rejected(change(ana().id.value, sessionId, 'segredo123', 'a'.repeat(73))))).toEqual(['newPassword:TOO_LONG']);
    expect(fieldsOf(await rejected(change(ana().id.value, sessionId, undefined, '1234567')))).toEqual([
      'currentPassword:REQUIRED',
      'newPassword:TOO_SHORT',
    ]);
    expect(fieldsOf(await rejected(change(ana().id.value, sessionId, 'segredo123', undefined)))).toEqual(['newPassword:REQUIRED']);
  });

  it('CA10: apos 5 senhas atuais erradas, a 6a (mesmo correta) -> 429 TOO_MANY_ATTEMPTS, sem verificar hash', async () => {
    h.users.seed(ana());
    const { sessionId } = h.openSession(ana());
    for (let i = 0; i < 5; i++) await rejected(change(ana().id.value, sessionId, 'errada1234', 'OutraSenha1'));
    const verifyBefore = h.hasher.verifyCalls;
    const error = await rejected(change(ana().id.value, sessionId, 'segredo123', 'OutraSenha1'));
    expect(error).toMatchObject({ code: 'TOO_MANY_ATTEMPTS', kind: 'rate_limited' });
    expect(error.details.retryAfterSeconds).toBeGreaterThan(0);
    expect(h.hasher.verifyCalls).toBe(verifyBefore);
    expect(h.users.get(ana().id.value)!.passwordHash?.value).toBe('$fake$segredo123');
    expect(h.audit.of('rateLimited')[0].payload).toMatchObject({ scope: 'password-change-user-failures' });
  });

  it('o limite e por usuario: Ana bloqueada nao bloqueia Carla', async () => {
    h.users.seed(ana());
    h.users.seed(carla());
    const a = h.openSession(ana());
    const c = h.openSession(carla());
    for (let i = 0; i < 5; i++) await rejected(change(ana().id.value, a.sessionId, 'errada1234', 'OutraSenha1'));
    await expect(change(carla().id.value, c.sessionId, 'Temp1234', 'MinhaSenha9')).resolves.toBeDefined();
  });

  it('precedencia: 400 de forma vence o 429', async () => {
    h.users.seed(ana());
    const { sessionId } = h.openSession(ana());
    for (let i = 0; i < 5; i++) await rejected(change(ana().id.value, sessionId, 'errada1234', 'OutraSenha1'));
    const error = await rejected(change(ana().id.value, sessionId, 'segredo123', '1234567'));
    expect(error.code).toBe('VALIDATION_ERROR');
  });

  it('sucesso zera as falhas da senha atual', async () => {
    h.users.seed(ana());
    const { sessionId } = h.openSession(ana());
    await rejected(change(ana().id.value, sessionId, 'errada1234', 'OutraSenha1'));
    await change(ana().id.value, sessionId, 'segredo123', 'OutraSenha1');
    expect(h.limiter.failureCount('password-change-user-failures', ana().id.value)).toBe(0);
  });

  it('usuario inexistente -> 401', async () => {
    const error = await rejected(change(userUuid(99), userUuid(98), 'segredo123', 'OutraSenha1'));
    expect(error.code).toBe('UNAUTHENTICATED');
  });
});

describe('UpdateOwnProfile (RF09, CA11)', () => {
  it('CA11: "  ana   lima " -> "ana lima"; devolve o usuario atual; publica UserUpdated[name]', async () => {
    h.users.seed(ana());
    const view = await h.updateProfile.execute({ userId: ana().id.value, name: '  ana   lima ' });
    expect(view).toMatchObject({ id: ana().id.value, name: 'ana lima', email: 'ana@exemplo.com', role: 'USER' });
    expect(h.users.get(ana().id.value)!.name.value).toBe('ana lima');
    const [event] = h.publisher.published as { changedFields?: string[] }[];
    expect(h.publisher.names()).toEqual(['UserUpdated']);
    expect(event.changedFields).toEqual(['name']);
  });

  it('nao altera e-mail, nivel, senha nem situacao', async () => {
    h.users.seed(ana());
    await h.updateProfile.execute({ userId: ana().id.value, name: 'Outro' });
    const stored = h.users.get(ana().id.value)!;
    expect(stored).toMatchObject({ role: 'USER', status: 'ACTIVE' });
    expect(stored.email.value).toBe('ana@exemplo.com');
    expect(stored.passwordHash?.value).toBe('$fake$segredo123');
  });

  it('mesmo nome: sem escrita nem evento', async () => {
    h.users.seed(ana());
    await h.updateProfile.execute({ userId: ana().id.value, name: 'Ana Souza' });
    expect(h.users.calls.update).toBe(0);
    expect(h.publisher.published).toEqual([]);
  });

  it.each([
    ['vazio', '', 'REQUIRED'],
    ['so espacos', '   ', 'REQUIRED'],
    ['61 caracteres', 'a'.repeat(61), 'TOO_LONG'],
    ['ausente', undefined, 'REQUIRED'],
  ])('%s -> 400 name: %s', async (_l, name, code) => {
    h.users.seed(ana());
    const error = await rejected(h.updateProfile.execute({ userId: ana().id.value, name }));
    expect(error).toMatchObject({ code: 'VALIDATION_ERROR' });
    expect(error.details.fields).toContainEqual(expect.objectContaining({ field: 'name', code }));
    expect(h.users.get(ana().id.value)!.name.value).toBe('Ana Souza');
  });

  it('usuario inexistente -> 401', async () => {
    expect((await rejected(h.updateProfile.execute({ userId: userUuid(99), name: 'X' }))).code).toBe('UNAUTHENTICATED');
  });

  void NOW;
});
