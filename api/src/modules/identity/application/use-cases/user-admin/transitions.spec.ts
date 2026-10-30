import { rejected } from '@test/support/builders.js';
import { actorOf, ana, bruno, carla, outroAdmin, vagner } from '@test/support/identity-builders.js';
import { buildIdentityHarness, type IdentityHarness } from '@test/support/identity-harness.js';

let h: IdentityHarness;
beforeEach(() => {
  h = buildIdentityHarness();
  h.users.seed(vagner());
  h.users.seed(outroAdmin());
  h.users.seed(ana());
});
const admin = () => actorOf(vagner());

describe('DeactivateUser (RF14, CA20)', () => {
  it('inativa, encerra TODAS as sessoes do alvo na mesma transacao e preserva as dos outros', async () => {
    h.users.seed(bruno());
    const b1 = h.openSession(bruno());
    h.openSession(bruno());
    const anas = h.openSession(ana());
    const view = await h.deactivateUser.execute({ actor: admin(), id: bruno().id.value });
    expect(view).toMatchObject({ id: bruno().id.value, status: 'INACTIVE' });
    expect(h.users.get(bruno().id.value)!.status).toBe('INACTIVE');
    expect(h.sessions.ofUser(bruno().id.value)).toEqual([]);
    expect(h.sessions.ofUser(ana().id.value).map((s) => s.id.value)).toEqual([anas.sessionId]);
    expect((await rejected(h.authenticate.execute({ token: b1.token }))).code).toBe('UNAUTHENTICATED');
  });

  it('publica UserDeactivated e UserSessionsRevoked; audita com a quantidade de sessoes encerradas', async () => {
    h.users.seed(bruno());
    h.openSession(bruno());
    h.openSession(bruno());
    await h.deactivateUser.execute({ actor: admin(), id: bruno().id.value });
    expect(h.publisher.names()).toEqual(expect.arrayContaining(['UserDeactivated', 'UserSessionsRevoked']));
    const revoked = h.publisher.published.find((e) => e.constructor.name === 'UserSessionsRevoked') as { reason: string; count: number };
    expect(revoked).toMatchObject({ reason: 'deactivated', count: 2 });
    expect(h.audit.of('userDeactivated')[0].payload).toMatchObject({
      actorId: vagner().id.value,
      userId: bruno().id.value,
      revokedSessions: 2,
    });
  });

  it('P18/CA20: inativar quem ja esta inativo e sucesso sem mudar nada (sem evento, sem auditoria, sem apagar sessoes)', async () => {
    h.users.seed(bruno({ status: 'INACTIVE' }));
    const view = await h.deactivateUser.execute({ actor: admin(), id: bruno().id.value });
    expect(view.status).toBe('INACTIVE');
    expect(h.publisher.published).toEqual([]);
    expect(h.audit.of('userDeactivated')).toEqual([]);
    expect(h.users.calls.update).toBe(0);
    expect(h.sessions.calls.deleteAllOfUser).toBe(0);
  });

  it('CA23: inativar a si mesmo -> 422 CANNOT_TARGET_SELF; nada muda', async () => {
    const own = h.openSession(vagner());
    const error = await rejected(h.deactivateUser.execute({ actor: admin(), id: vagner().id.value }));
    expect(error).toMatchObject({ code: 'CANNOT_TARGET_SELF', kind: 'business_rule' });
    expect(h.users.get(vagner().id.value)!.status).toBe('ACTIVE');
    expect(h.sessions.ofUser(vagner().id.value).map((s) => s.id.value)).toEqual([own.sessionId]);
  });

  it('CA24: o unico administrador ativo se inativando -> CANNOT_TARGET_SELF tem precedencia sobre LAST_ADMIN', async () => {
    h.users.seed(outroAdmin({ status: 'INACTIVE' }));
    const error = await rejected(h.deactivateUser.execute({ actor: admin(), id: vagner().id.value }));
    expect(error.code).toBe('CANNOT_TARGET_SELF');
  });

  it('admin pode inativar outro admin quando o ator continua ativo (ainda ha 1 admin ativo)', async () => {
    const view = await h.deactivateUser.execute({ actor: admin(), id: outroAdmin().id.value });
    expect(view.status).toBe('INACTIVE');
  });

  it('os dados do usuario (nome, e-mail, hash, nivel) nao sao alterados (RF14)', async () => {
    h.users.seed(bruno());
    const before = h.users.get(bruno().id.value)!;
    await h.deactivateUser.execute({ actor: admin(), id: bruno().id.value });
    const after = h.users.get(bruno().id.value)!;
    expect([after.name.value, after.email.value, after.passwordHash?.value, after.role]).toEqual([
      before.name.value,
      before.email.value,
      before.passwordHash?.value,
      before.role,
    ]);
  });
});

describe('ReactivateUser (RF15, CA21)', () => {
  it('reativa sem tocar em senha nem troca obrigatoria; as sessoes continuam apagadas', async () => {
    h.users.seed(bruno({ status: 'INACTIVE', mustChangePassword: false }));
    const view = await h.reactivateUser.execute({ actor: admin(), id: bruno().id.value });
    expect(view).toMatchObject({ status: 'ACTIVE', mustChangePassword: false });
    expect(h.users.get(bruno().id.value)!.passwordHash?.value).toBe('$fake$segredo123');
    expect(h.sessions.calls.deleteAllOfUser).toBe(0);
    expect(h.publisher.names()).toContain('UserReactivated');
    expect(h.audit.of('userReactivated')[0].payload).toMatchObject({ actorId: vagner().id.value, userId: bruno().id.value });
  });

  it('P16: troca obrigatoria pendente permanece pendente apos reativar', async () => {
    h.users.seed(carla({ status: 'INACTIVE' }));
    expect(await h.reactivateUser.execute({ actor: admin(), id: carla().id.value })).toMatchObject({ mustChangePassword: true });
  });

  it('P18: reativar quem ja esta ativo e sucesso sem mudar nada', async () => {
    const view = await h.reactivateUser.execute({ actor: admin(), id: ana().id.value });
    expect(view.status).toBe('ACTIVE');
    expect(h.publisher.published).toEqual([]);
    expect(h.audit.of('userReactivated')).toEqual([]);
    expect(h.users.calls.update).toBe(0);
  });

  it('CA21: depois de reativado o login volta a funcionar com a senha de antes', async () => {
    h.users.seed(bruno({ status: 'INACTIVE' }));
    await h.reactivateUser.execute({ actor: admin(), id: bruno().id.value });
    await expect(h.login.execute({ email: 'bruno@exemplo.com', password: 'segredo123', clientIp: '203.0.113.9' })).resolves.toBeDefined();
  });
});

describe('ResetUserPassword (RF16, CA22)', () => {
  it('novo hash, troca obrigatoria ligada e TODAS as sessoes encerradas', async () => {
    const s1 = h.openSession(ana());
    h.openSession(ana());
    const view = await h.resetPassword.execute({ actor: admin(), id: ana().id.value, password: 'Nova1234' });
    expect(view).toMatchObject({ id: ana().id.value, mustChangePassword: true, status: 'ACTIVE' });
    const stored = h.users.get(ana().id.value)!;
    expect(stored.passwordHash?.value).toBe('$fake$Nova1234');
    expect(stored.mustChangePassword).toBe(true);
    expect(h.sessions.ofUser(ana().id.value)).toEqual([]);
    expect((await rejected(h.authenticate.execute({ token: s1.token }))).code).toBe('UNAUTHENTICATED');
  });

  it('CA22: a senha antiga deixa de valer e a nova leva a troca obrigatoria', async () => {
    await h.resetPassword.execute({ actor: admin(), id: ana().id.value, password: 'Nova1234' });
    const ip = '203.0.113.9';
    expect((await rejected(h.login.execute({ email: 'ana@exemplo.com', password: 'segredo123', clientIp: ip }))).code).toBe('INVALID_CREDENTIALS');
    expect((await h.login.execute({ email: 'ana@exemplo.com', password: 'Nova1234', clientIp: ip })).user.mustChangePassword).toBe(true);
  });

  it('vale tambem para usuario INATIVO e nao o reativa', async () => {
    h.users.seed(bruno({ status: 'INACTIVE' }));
    const view = await h.resetPassword.execute({ actor: admin(), id: bruno().id.value, password: 'Nova1234' });
    expect(view).toMatchObject({ status: 'INACTIVE', mustChangePassword: true });
    expect(h.users.get(bruno().id.value)!.passwordHash?.value).toBe('$fake$Nova1234');
  });

  it('publica UserPasswordReset + UserSessionsRevoked; audita com quantidade, sem a senha', async () => {
    h.openSession(ana());
    await h.resetPassword.execute({ actor: admin(), id: ana().id.value, password: 'Nova1234' });
    expect(h.publisher.names()).toEqual(expect.arrayContaining(['UserPasswordReset', 'UserSessionsRevoked']));
    expect(h.audit.of('userPasswordReset')[0].payload).toMatchObject({ actorId: vagner().id.value, userId: ana().id.value, revokedSessions: 1 });
    const text = JSON.stringify(h.audit.calls) + JSON.stringify(h.publisher.published);
    expect(text).not.toContain('Nova1234');
  });

  it('CA23: redefinir a PROPRIA senha pela gestao -> 422 CANNOT_TARGET_SELF; nada muda', async () => {
    const error = await rejected(h.resetPassword.execute({ actor: admin(), id: vagner().id.value, password: 'Nova1234' }));
    expect(error).toMatchObject({ code: 'CANNOT_TARGET_SELF', kind: 'business_rule' });
    expect(h.users.get(vagner().id.value)!.passwordHash?.value).toBe('$fake$segredo123');
    expect(h.users.calls.update).toBe(0);
  });

  it('senha invalida -> 400 password: TOO_SHORT e o hash nem e calculado', async () => {
    const error = await rejected(h.resetPassword.execute({ actor: admin(), id: ana().id.value, password: '1234567' }));
    expect(error).toMatchObject({ code: 'VALIDATION_ERROR' });
    expect(error.details.fields).toContainEqual(expect.objectContaining({ field: 'password', code: 'TOO_SHORT' }));
    expect(h.hasher.hashCalls).toBe(0);
  });

  it('73 caracteres -> password: TOO_LONG; ausente -> REQUIRED', async () => {
    expect((await rejected(h.resetPassword.execute({ actor: admin(), id: ana().id.value, password: 'a'.repeat(73) }))).details.fields).toContainEqual(
      expect.objectContaining({ field: 'password', code: 'TOO_LONG' }),
    );
    expect((await rejected(h.resetPassword.execute({ actor: admin(), id: ana().id.value, password: undefined }))).details.fields).toContainEqual(
      expect.objectContaining({ field: 'password', code: 'REQUIRED' }),
    );
  });

  it('o hash e calculado ANTES da transacao (fora do lock)', async () => {
    await h.resetPassword.execute({ actor: admin(), id: ana().id.value, password: 'Nova1234' });
    expect(h.log.indexOf('hash')).toBeLessThan(h.log.indexOf('tx:begin'));
  });
});
