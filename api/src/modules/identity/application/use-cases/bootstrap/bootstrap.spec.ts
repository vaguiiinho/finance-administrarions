import { DEMO_USER_ID, FIRST_ADMIN_ID } from '@shared/domain/well-known-ids.js';
import { rejected } from '@test/support/builders.js';
import { ana, demoUser, firstAdminMarker, userUuid, vagner } from '@test/support/identity-builders.js';
import { buildIdentityHarness, type IdentityHarness } from '@test/support/identity-harness.js';

const ENV = { ADMIN_NAME: 'Vagner', ADMIN_EMAIL: 'Admin@Exemplo.com', ADMIN_PASSWORD: 'Inicial123' };
let h: IdentityHarness;
beforeEach(() => {
  h = buildIdentityHarness();
});

describe('BootstrapFirstAdmin (RF20, CA12, CA13, CA14)', () => {
  it('CA12: banco sem usuarios -> created: ADMIN ativo, com troca obrigatoria, e-mail normalizado, id fixo', async () => {
    expect(await h.bootstrap.execute(ENV)).toEqual({ status: 'created' });
    const created = h.users.get(FIRST_ADMIN_ID)!;
    expect(created).toMatchObject({ kind: 'REGULAR', role: 'ADMIN', status: 'ACTIVE', mustChangePassword: true });
    expect(created.name.value).toBe('Vagner');
    expect(created.email.value).toBe('admin@exemplo.com');
    expect(created.passwordHash?.value).toBe('$fake$Inicial123');
    expect(h.audit.of('firstAdminBootstrapped')[0].payload).toMatchObject({ userId: FIRST_ADMIN_ID, receivedLegacyData: false });
    expect(h.publisher.names()).toContain('FirstAdminBootstrapped');
  });

  it('CA12: o login com a senha inicial entra com troca obrigatoria', async () => {
    await h.bootstrap.execute(ENV);
    const result = await h.login.execute({ email: 'admin@exemplo.com', password: 'Inicial123', clientIp: '203.0.113.9' });
    expect(result.user).toMatchObject({ role: 'ADMIN', mustChangePassword: true });
  });

  it('roda sob lockFirstAdminBootstrap, dentro de uma transacao', async () => {
    await h.bootstrap.execute(ENV);
    expect(h.uow.firstAdminLocks).toBe(1);
    expect(h.uow.runs).toBe(1);
  });

  it('CA14: com o marcador (dados legados) -> provisioned: MESMO id, vira administrador real', async () => {
    h.users.seed(firstAdminMarker());
    expect(await h.bootstrap.execute(ENV)).toEqual({ status: 'provisioned' });
    const provisioned = h.users.get(FIRST_ADMIN_ID)!;
    expect(provisioned).toMatchObject({ kind: 'REGULAR', role: 'ADMIN', status: 'ACTIVE', mustChangePassword: true });
    expect(provisioned.email.value).toBe('admin@exemplo.com');
    expect(h.users.all()).toHaveLength(1);
    expect(h.audit.of('firstAdminBootstrapped')[0].payload).toMatchObject({ userId: FIRST_ADMIN_ID, receivedLegacyData: true });
  });

  it('o usuario demo nao conta: banco so com o demo ainda cria o administrador', async () => {
    h.users.seed(demoUser());
    expect(await h.bootstrap.execute(ENV)).toEqual({ status: 'created' });
    expect(h.users.get(DEMO_USER_ID)).toBeDefined();
  });

  it('CA12/CA13: se ja existe algum usuario REGULAR -> skipped, SEM validar as variaveis, sem hash, sem auditoria', async () => {
    h.users.seed(ana());
    expect(await h.bootstrap.execute({})).toEqual({ status: 'skipped' });
    expect(await h.bootstrap.execute({ ADMIN_EMAIL: 'admin@' })).toEqual({ status: 'skipped' });
    expect(h.users.all()).toHaveLength(1);
    expect(h.hasher.hashCalls).toBe(0);
    expect(h.audit.calls).toEqual([]);
  });

  it('CA12: subir de novo com outro e-mail/senha nao cria nem altera nada (idempotente)', async () => {
    await h.bootstrap.execute(ENV);
    const before = JSON.stringify(h.users.get(FIRST_ADMIN_ID)!.toSnapshot());
    expect(await h.bootstrap.execute({ ADMIN_NAME: 'Outro', ADMIN_EMAIL: 'outro@exemplo.com', ADMIN_PASSWORD: 'OutraSenha9' })).toEqual({
      status: 'skipped',
    });
    expect(JSON.stringify(h.users.get(FIRST_ADMIN_ID)!.toSnapshot())).toBe(before);
    expect(h.users.all()).toHaveLength(1);
  });

  it('a senha ja trocada continua valendo apos novo boot', async () => {
    await h.bootstrap.execute(ENV);
    const { sessionId } = h.openSession(h.users.get(FIRST_ADMIN_ID)!);
    await h.changePassword.execute({ userId: FIRST_ADMIN_ID, sessionId, currentPassword: 'Inicial123', newPassword: 'Trocada123', clientIp: '203.0.113.9' });
    await h.bootstrap.execute(ENV);
    expect(h.users.get(FIRST_ADMIN_ID)!.passwordHash?.value).toBe('$fake$Trocada123');
  });

  it('CA13: ADMIN_PASSWORD ausente -> FirstAdminConfigError apontando a variavel; nada criado', async () => {
    const error = await rejected(h.bootstrap.execute({ ADMIN_NAME: 'Vagner', ADMIN_EMAIL: 'a@b.com' }));
    expect(error).toMatchObject({ code: 'FIRST_ADMIN_CONFIG_INVALID' });
    expect(error.details.variables).toEqual([{ name: 'ADMIN_PASSWORD', code: 'REQUIRED' }]);
    expect(h.users.all()).toEqual([]);
  });

  it('CA13: ADMIN_EMAIL="admin@" -> INVALID_FORMAT em ADMIN_EMAIL', async () => {
    const error = await rejected(h.bootstrap.execute({ ...ENV, ADMIN_EMAIL: 'admin@' }));
    expect(error.details.variables).toEqual([{ name: 'ADMIN_EMAIL', code: 'INVALID_FORMAT' }]);
  });

  it('CA13: a senha nunca aparece no erro; com marcador e variaveis invalidas ele continua pendente', async () => {
    h.users.seed(firstAdminMarker());
    const error = await rejected(h.bootstrap.execute({ ...ENV, ADMIN_EMAIL: 'x', ADMIN_PASSWORD: 'curta' }));
    expect(JSON.stringify(error.details) + error.message).not.toContain('curta');
    expect(h.users.get(FIRST_ADMIN_ID)!.kind).toBe('PENDING_FIRST_ADMIN');
  });

  it('duas execucoes em sequencia (instancias concorrentes serializadas pelo lock): created e skipped', async () => {
    const results = [await h.bootstrap.execute(ENV), await h.bootstrap.execute(ENV)];
    expect(results.map((r) => r.status)).toEqual(['created', 'skipped']);
    expect(h.hasher.hashCalls).toBe(1);
  });
});

describe('RecoverAdminAccess (T15, D17)', () => {
  it('promove a ADMIN, reativa, redefine a senha (troca obrigatoria) e encerra todas as sessoes', async () => {
    h.users.seed(ana({ status: 'INACTIVE' }));
    h.openSession(ana());
    h.openSession(ana());
    const result = await h.recover.execute({ email: ' ANA@exemplo.com ', temporaryPassword: 'Temp1234' });
    expect(result).toEqual({ userId: ana().id.value });
    const stored = h.users.get(ana().id.value)!;
    expect(stored).toMatchObject({ role: 'ADMIN', status: 'ACTIVE', mustChangePassword: true });
    expect(stored.passwordHash?.value).toBe('$fake$Temp1234');
    expect(h.sessions.ofUser(ana().id.value)).toEqual([]);
    expect(h.audit.of('adminRecovered')[0].payload).toMatchObject({ userId: ana().id.value });
    expect(h.uow.adminLocks).toBe(1);
  });

  it('e-mail inexistente, do demo ou do marcador -> 404 USER_NOT_FOUND', async () => {
    h.users.seed(demoUser());
    h.users.seed(firstAdminMarker());
    for (const email of ['naoexiste@exemplo.com', 'demo@finance.invalid', 'first-admin@finance.invalid']) {
      expect((await rejected(h.recover.execute({ email, temporaryPassword: 'Temp1234' }))).code).toBe('USER_NOT_FOUND');
    }
  });

  it('senha temporaria invalida -> 400 e nada muda', async () => {
    h.users.seed(ana());
    const error = await rejected(h.recover.execute({ email: 'ana@exemplo.com', temporaryPassword: 'curta' }));
    expect(error.code).toBe('VALIDATION_ERROR');
    expect(h.users.get(ana().id.value)!.role).toBe('USER');
  });

  it('nao ha efeito colateral em outros usuarios', async () => {
    h.users.seed(ana());
    h.users.seed(vagner());
    const s = h.openSession(vagner());
    await h.recover.execute({ email: 'ana@exemplo.com', temporaryPassword: 'Temp1234' });
    expect(h.sessions.ofUser(vagner().id.value).map((x) => x.id.value)).toEqual([s.sessionId]);
    expect(userUuid(1)).toBeDefined();
  });
});

describe('EnsureDemoUser', () => {
  it('cria o usuario demo reservado uma unica vez (idempotente)', async () => {
    expect(await h.ensureDemo.execute({})).toEqual({ created: true });
    expect(await h.ensureDemo.execute({})).toEqual({ created: false });
    const demo = h.users.get(DEMO_USER_ID)!;
    expect(demo).toMatchObject({ kind: 'DEMO', role: 'USER', passwordHash: null });
    expect(h.users.all()).toHaveLength(1);
  });
});
