import { NOW, rejected } from '@test/support/builders.js';
import {
  actorOf,
  ana,
  bruno,
  demoUser,
  firstAdminMarker,
  outroAdmin,
  userUuid,
  vagner,
} from '@test/support/identity-builders.js';
import { buildIdentityHarness, type IdentityHarness } from '@test/support/identity-harness.js';
import type { Actor } from '@identity/application/views.js';

/**
 * Regras comuns dos use cases de escrita da gestao de usuarios (ADR 0005 5.4, esqueleto 1-6):
 * 400 -> ator (401/403, revalidado DENTRO da transacao) -> 404 -> 422 -> 409.
 */
type Op = { name: string; run: (h: IdentityHarness, actor: Actor, id: string) => Promise<unknown> };
const ops: Op[] = [
  { name: 'UpdateUser', run: (h, actor, id) => h.updateUser.execute({ actor, id, name: 'Novo Nome', email: 'novo@exemplo.com', role: 'USER' }) },
  { name: 'DeactivateUser', run: (h, actor, id) => h.deactivateUser.execute({ actor, id }) },
  { name: 'ReactivateUser', run: (h, actor, id) => h.reactivateUser.execute({ actor, id }) },
  { name: 'ResetUserPassword', run: (h, actor, id) => h.resetPassword.execute({ actor, id, password: 'Nova1234' }) },
];

let h: IdentityHarness;
beforeEach(() => {
  h = buildIdentityHarness();
  h.users.seed(vagner());
  h.users.seed(outroAdmin());
  h.users.seed(ana());
  h.users.seed(bruno({ status: 'INACTIVE' }));
});

describe.each(ops)('$name: autorizacao do ator e alvo', (op) => {
  it('ator USER -> 403 FORBIDDEN (o 403 existe tambem dentro do use case, nao so no guard)', async () => {
    const error = await rejected(op.run(h, actorOf(ana()), bruno().id.value));
    expect(error).toMatchObject({ code: 'FORBIDDEN', kind: 'forbidden' });
    expect((error as { details: unknown }).details).toEqual({});
  });

  it('ator INATIVO -> 401 UNAUTHENTICATED', async () => {
    h.users.seed(vagner({ status: 'INACTIVE' }));
    const error = await rejected(op.run(h, actorOf(vagner()), ana().id.value));
    expect(error).toMatchObject({ code: 'UNAUTHENTICATED', kind: 'unauthenticated' });
  });

  it('ator inexistente -> 401', async () => {
    const error = await rejected(op.run(h, { userId: userUuid(77), clientIp: '203.0.113.9' }, ana().id.value));
    expect(error.code).toBe('UNAUTHENTICATED');
  });

  it('ator demo -> 401 (kind <> REGULAR nunca age)', async () => {
    h.users.seed(demoUser());
    const error = await rejected(op.run(h, actorOf(demoUser()), ana().id.value));
    expect(error.code).toBe('UNAUTHENTICATED');
  });

  it('CA26: alvo inexistente -> 404 USER_NOT_FOUND com details.id', async () => {
    const id = userUuid(99);
    const error = await rejected(op.run(h, actorOf(vagner()), id));
    expect(error).toMatchObject({ code: 'USER_NOT_FOUND', kind: 'not_found', details: { id } });
  });

  it.each([
    ['demo', () => demoUser()],
    ['marcador do primeiro administrador', () => firstAdminMarker()],
  ])('CA26: alvo %s -> 404 USER_NOT_FOUND (nao e gerenciavel)', async (_l, make) => {
    h.users.seed(make());
    const error = await rejected(op.run(h, actorOf(vagner()), make().id.value));
    expect(error.code).toBe('USER_NOT_FOUND');
  });

  it('id malformado -> 400 VALIDATION_ERROR (antes de qualquer outra regra)', async () => {
    const error = await rejected(op.run(h, actorOf(vagner()), 'abc'));
    expect(error).toMatchObject({ code: 'VALIDATION_ERROR', kind: 'validation' });
  });

  it('403 vence 404: ator comum com alvo inexistente -> FORBIDDEN', async () => {
    h.users.seed(ana({ n: 6, id: userUuid(6), email: 'comum@exemplo.com' }));
    const error = await rejected(op.run(h, actorOf(ana({ n: 6, id: userUuid(6) })), userUuid(99)));
    expect(error.code).toBe('FORBIDDEN');
  });

  it('T14: o lock do conjunto de administradores e adquirido (uma transacao) antes de qualquer contagem de admins', async () => {
    await op.run(h, actorOf(vagner()), ana().id.value).catch(() => undefined);
    expect(h.uow.runs).toBe(1);
    expect(h.uow.adminLocks).toBe(1);
    const lock = h.log.indexOf('lock:admin');
    const count = h.log.indexOf('count-admins');
    expect(lock).toBeGreaterThan(-1);
    if (count !== -1) expect(lock).toBeLessThan(count);
  });

  it('erro => rollback: nada fica gravado nem publicado', async () => {
    const before = JSON.stringify(h.users.all().map((u) => u.toSnapshot()));
    await rejected(op.run(h, actorOf(vagner()), userUuid(99)));
    expect(JSON.stringify(h.users.all().map((u) => u.toSnapshot()))).toBe(before);
    expect(h.publisher.published).toEqual([]);
    expect(h.audit.calls).toEqual([]);
    void NOW;
  });
});
