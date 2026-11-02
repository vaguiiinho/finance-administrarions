import { rejected } from '@test/support/builders.js';
import { SHOWCASE_ID, showcaseUser } from '@test/support/showcase-builders.js';
import { buildShowcaseHarness, type ShowcaseHarness } from '@test/support/showcase-harness.js';

const IP = '203.0.113.9';
let h: ShowcaseHarness;
let sessionId: string;
beforeEach(() => {
  h = buildShowcaseHarness();
  h.users.seed(showcaseUser());
  sessionId = h.openSession(showcaseUser()).sessionId;
});

const change = (currentPassword: unknown, newPassword: unknown) =>
  h.changePassword.execute({ userId: SHOWCASE_ID, sessionId, currentPassword, newPassword, clientIp: IP });

describe('ChangeOwnPassword: conta demo (B8, CA48)', () => {
  it('senha atual CORRETA -> ForbiddenError (FORBIDDEN, 403)', async () => {
    expect(await rejected(change('demo', 'OutraSenha9'))).toMatchObject({ code: 'FORBIDDEN', kind: 'forbidden' });
  });

  it('senha atual ERRADA tambem -> FORBIDDEN (nao INCORRECT)', async () => {
    const error = await rejected(change('errada', 'OutraSenha9'));
    expect(error.code).toBe('FORBIDDEN');
  });

  it('corpo invalido (nova senha curta, atual ausente) tambem -> FORBIDDEN: o 403 vem antes da validacao', async () => {
    expect((await rejected(change(undefined, 'x'))).code).toBe('FORBIDDEN');
    expect((await rejected(change('demo', 'curta'))).code).toBe('FORBIDDEN');
  });

  it('nao chama o hasher, nao consulta nem alimenta password-change-user-failures', async () => {
    for (let i = 0; i < 7; i++) await rejected(change('errada', 'OutraSenha9'));
    expect(h.hasher.verifyCalls).toBe(0);
    expect(h.hasher.hashCalls).toBe(0);
    expect(h.limiter.failureCount('password-change-user-failures', SHOWCASE_ID)).toBe(0);
  });

  it('7 tentativas seguidas continuam FORBIDDEN (nunca TOO_MANY_ATTEMPTS)', async () => {
    for (let i = 0; i < 7; i++) expect((await rejected(change('errada', 'OutraSenha9'))).code).toBe('FORBIDDEN');
  });

  it('a senha continua "demo", a sessao atual e as demais continuam abertas, nada publicado', async () => {
    const other = h.openSession(showcaseUser());
    await rejected(change('demo', 'OutraSenha9'));
    expect(h.users.get(SHOWCASE_ID)!.passwordHash?.value).toBe('$fake$demo');
    expect(h.sessions.ofUser(SHOWCASE_ID)).toHaveLength(2);
    expect(other.token).toBeDefined();
    expect(h.publisher.names()).not.toContain('PasswordChanged');
    expect(h.uow.runs).toBe(0);
  });
});

describe('UpdateOwnProfile: conta demo (B8, mantido)', () => {
  it('renomear -> ForbiddenError e o nome nao muda', async () => {
    const error = await rejected(h.updateProfile.execute({ userId: SHOWCASE_ID, name: 'Texto ofensivo' } as never));
    expect(error).toMatchObject({ code: 'FORBIDDEN', kind: 'forbidden' });
    expect(h.users.get(SHOWCASE_ID)!.name.value).toBe('Conta de demonstração');
  });
});
