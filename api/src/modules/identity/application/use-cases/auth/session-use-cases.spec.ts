import { NOW, rejected } from '@test/support/builders.js';
import { ana, bruno, carla, firstAdminMarker, userUuid, vagner } from '@test/support/identity-builders.js';
import { buildIdentityHarness, type IdentityHarness } from '@test/support/identity-harness.js';

const H24 = 24 * 60 * 60 * 1000;
let h: IdentityHarness;
beforeEach(() => {
  h = buildIdentityHarness();
});

describe('AuthenticateSession (RF03, RF04, T16, CA27)', () => {
  it('token valido -> principal com userId, sessionId, nivel e troca obrigatoria', async () => {
    h.users.seed(vagner());
    const { token, sessionId } = h.openSession(vagner());
    const principal = await h.authenticate.execute({ token });
    expect(principal).toEqual({
      userId: vagner().id.value,
      sessionId,
      role: 'ADMIN',
      mustChangePassword: false,
      capabilities: ['CHANGE_OWN_PASSWORD', 'MANAGE_EXPENSES', 'MANAGE_USERS', 'UPDATE_OWN_PROFILE'],
    });
  });

  it.each(['', 'lixo', 'tok-', 'Bearer tok-1', 'tok-999999'])('token invalido ou desconhecido (%j) -> 401 UNAUTHENTICATED', async (token) => {
    h.users.seed(ana());
    h.openSession(ana());
    const error = await rejected(h.authenticate.execute({ token }));
    expect(error).toMatchObject({ code: 'UNAUTHENTICATED', kind: 'unauthenticated', details: null });
  });

  it('CA06: 1 ms antes de 24 h vale; em 24 h exatos -> 401 (sem renovacao por uso)', async () => {
    h.users.seed(ana());
    const { token } = h.openSession(ana());
    h.clock.set(new Date(NOW.getTime() + H24 - 1));
    await expect(h.authenticate.execute({ token })).resolves.toBeDefined();
    await expect(h.authenticate.execute({ token })).resolves.toBeDefined();
    h.clock.set(new Date(NOW.getTime() + H24));
    expect((await rejected(h.authenticate.execute({ token }))).code).toBe('UNAUTHENTICATED');
  });

  it('usuario INATIVO com sessao ainda gravada -> 401 (defesa em profundidade)', async () => {
    h.users.seed(bruno({ status: 'INACTIVE' }));
    const { token } = h.openSession(bruno());
    expect((await rejected(h.authenticate.execute({ token }))).code).toBe('UNAUTHENTICATED');
  });

  it('marcador do primeiro administrador com sessao -> 401 (kind <> REGULAR)', async () => {
    h.users.seed(firstAdminMarker());
    const { token } = h.openSession(firstAdminMarker());
    expect((await rejected(h.authenticate.execute({ token }))).code).toBe('UNAUTHENTICATED');
  });

  it('T16/RNF14: nivel e troca obrigatoria sao lidos a CADA chamada, sem cache', async () => {
    h.users.seed(ana());
    const { token } = h.openSession(ana());
    expect(await h.authenticate.execute({ token })).toMatchObject({ role: 'USER', mustChangePassword: false });

    const promoted = h.users.get(ana().id.value)!;
    promoted.updateDetails({ name: promoted.name, email: promoted.email, role: 'ADMIN' }, NOW);
    h.users.seed(promoted);
    expect(await h.authenticate.execute({ token })).toMatchObject({ role: 'ADMIN' });

    const reset = h.users.get(ana().id.value)!;
    reset.resetPassword(reset.passwordHash!, NOW);
    h.users.seed(reset);
    expect(await h.authenticate.execute({ token })).toMatchObject({ mustChangePassword: true });
    expect(h.lookup.calls).toBe(3);
  });

  it('sessao apagada (inativacao/redefinicao/logout) -> 401', async () => {
    h.users.seed(ana());
    const { token } = h.openSession(ana());
    await h.sessions.deleteAllOfUser(ana().id);
    expect((await rejected(h.authenticate.execute({ token }))).code).toBe('UNAUTHENTICATED');
  });
});

describe('GetCurrentUser (RF03)', () => {
  it('devolve id, nome, e-mail, nivel e troca obrigatoria, sem hash', async () => {
    h.users.seed(carla());
    const view = await h.currentUser.execute({ userId: carla().id.value });
    expect(view).toEqual({
      id: carla().id.value,
      name: 'Carla Dias',
      email: 'carla@exemplo.com',
      role: 'USER',
      mustChangePassword: true,
      accountKind: 'REGULAR',
      capabilities: ['CHANGE_OWN_PASSWORD', 'MANAGE_EXPENSES', 'UPDATE_OWN_PROFILE'],
    });
  });

  it('usuario inexistente -> 401, nunca 404', async () => {
    const error = await rejected(h.currentUser.execute({ userId: userUuid(99) }));
    expect(error).toMatchObject({ code: 'UNAUTHENTICATED', kind: 'unauthenticated' });
  });
});

describe('Logout (RF02, CA05)', () => {
  it('encerra so a sessao do token informado', async () => {
    h.users.seed(ana());
    const a = h.openSession(ana());
    const b = h.openSession(ana());
    await h.logout.execute({ token: a.token });
    expect(h.sessions.ofUser(ana().id.value).map((s) => s.id.value)).toEqual([b.sessionId]);
    expect((await rejected(h.authenticate.execute({ token: a.token }))).code).toBe('UNAUTHENTICATED');
    await expect(h.authenticate.execute({ token: b.token })).resolves.toBeDefined();
  });

  it('publica SessionRevoked', async () => {
    h.users.seed(ana());
    const { token } = h.openSession(ana());
    await h.logout.execute({ token });
    expect(h.publisher.names()).toContain('SessionRevoked');
  });

  it.each([null, '', 'lixo', 'tok-999'])('e idempotente: token %j nao falha nem apaga nada', async (token) => {
    h.users.seed(ana());
    h.openSession(ana());
    await expect(h.logout.execute({ token })).resolves.toBeUndefined();
    expect(h.sessions.store.size).toBe(1);
  });

  it('chamar duas vezes com o mesmo token nao falha', async () => {
    h.users.seed(ana());
    const { token } = h.openSession(ana());
    await h.logout.execute({ token });
    await expect(h.logout.execute({ token })).resolves.toBeUndefined();
  });
});

describe('CheckAuthRequestQuota (RNF04: 20 por IP por minuto)', () => {
  it('as 20 primeiras requisicoes passam; a 21a -> 429 com retryAfterSeconds > 0 e auditoria', async () => {
    for (let i = 0; i < 20; i++) await h.quota.execute({ clientIp: '198.51.100.7' });
    const error = await rejected(h.quota.execute({ clientIp: '198.51.100.7' }));
    expect(error).toMatchObject({ code: 'TOO_MANY_ATTEMPTS', kind: 'rate_limited' });
    expect(error.details.retryAfterSeconds).toBeGreaterThan(0);
    expect(h.audit.of('rateLimited')[0].payload).toMatchObject({ scope: 'auth-ip', clientIp: '198.51.100.7' });
  });

  it('IPs diferentes tem contadores independentes', async () => {
    for (let i = 0; i < 20; i++) await h.quota.execute({ clientIp: '198.51.100.7' });
    await expect(h.quota.execute({ clientIp: '198.51.100.8' })).resolves.toBeUndefined();
  });
});

describe('PurgeExpiredSessions', () => {
  it('apaga so as expiradas e devolve a quantidade', async () => {
    h.users.seed(ana());
    h.openSession(ana(), new Date(NOW.getTime() - 2 * H24));
    h.openSession(ana(), new Date(NOW.getTime() - 3 * H24));
    const valid = h.openSession(ana());
    expect(await h.purge.execute({})).toEqual({ deleted: 2 });
    expect(h.sessions.ofUser(ana().id.value).map((s) => s.id.value)).toEqual([valid.sessionId]);
  });
});
