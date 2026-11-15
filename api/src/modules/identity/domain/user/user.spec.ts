import { InvariantViolationError } from '@shared/domain/app-error.js';
import { FIRST_ADMIN_ID } from '@shared/domain/well-known-ids.js';
import { NOW, eventNames, pullEvents, thrown } from '@test/support/builders.js';
import { aUser, emailOf, firstAdminMarker, hashOf, userId, userName, userUuid } from '@test/support/identity-builders.js';
import { User } from './user.js';

const LATER = new Date(NOW.getTime() + 60_000);
const EVEN_LATER = new Date(NOW.getTime() + 120_000);
const SENSITIVE = ['Ana Souza', 'ana@exemplo.com', '$fake$'];

describe('User.create (RF12)', () => {
  const make = () =>
    User.create({
      id: userId(userUuid(7)),
      name: userName('Carla Dias'),
      email: emailOf('carla@exemplo.com'),
      role: 'USER',
      temporaryPasswordHash: hashOf('Temp1234'),
      now: NOW,
    });

  it('nasce REGULAR, ACTIVE, com troca obrigatoria e hash temporario', () => {
    const u = make();
    expect(u).toMatchObject({ kind: 'REGULAR', role: 'USER', status: 'ACTIVE', mustChangePassword: true });
    expect(u.passwordHash?.value).toBe('$fake$Temp1234');
    expect(u.createdAt).toEqual(NOW);
    expect(u.updatedAt).toEqual(NOW);
  });

  it('emite UserCreated', () => {
    expect(eventNames(pullEvents(make()))).toEqual(['UserCreated']);
  });
});

describe('User.firstAdmin', () => {
  it('nao existe mais User.demo (ADR 0013, T4)', () => {
    expect((User as unknown as Record<string, unknown>).demo).toBeUndefined();
  });

  it('firstAdmin: id fixo, REGULAR, ADMIN, ACTIVE, troca obrigatoria, evento sem dados legados', () => {
    const u = User.firstAdmin({
      name: userName('Vagner'),
      email: emailOf('admin@exemplo.com'),
      temporaryPasswordHash: hashOf('Inicial123'),
      now: NOW,
    });
    expect(u.id.value).toBe(FIRST_ADMIN_ID);
    expect(u).toMatchObject({ kind: 'REGULAR', role: 'ADMIN', status: 'ACTIVE', mustChangePassword: true });
    const [event] = pullEvents(u) as { constructor: { name: string }; receivedLegacyData: boolean }[];
    expect(event.constructor.name).toBe('FirstAdminBootstrapped');
    expect(event.receivedLegacyData).toBe(false);
  });
});

describe('invariantes de kind/hash/role (ADR 3.2) no restore', () => {
  it('REGULAR sem hash -> violacao', () => {
    expect(thrown(() => aUser({ password: null }))).toBeInstanceOf(InvariantViolationError);
  });
  it('PENDING_FIRST_ADMIN com hash -> violacao', () => {
    expect(thrown(() => firstAdminMarker({ password: 'x1234567' }))).toBeInstanceOf(InvariantViolationError);
  });
  it('PENDING_FIRST_ADMIN com id diferente de FIRST_ADMIN_ID -> violacao', () => {
    expect(thrown(() => firstAdminMarker({ id: userUuid(5) }))).toBeInstanceOf(InvariantViolationError);
  });
  it('updatedAt anterior a createdAt -> violacao', () => {
    expect(thrown(() => aUser({ createdAt: LATER, updatedAt: NOW }))).toBeInstanceOf(InvariantViolationError);
  });
  it('estado valido nao lanca (marcador)', () => {
    expect(() => firstAdminMarker()).not.toThrow();
  });
});

describe('predicados', () => {
  it.each([
    ['regular ativo', () => aUser(), true],
    ['regular inativo', () => aUser({ status: 'INACTIVE' }), false],
    ['marcador do primeiro admin', () => firstAdminMarker(), false],
  ])('canAuthenticate: %s -> %s', (_label, make, expected) => {
    expect(make().canAuthenticate()).toBe(expected);
  });

  it.each([
    ['admin ativo', () => aUser({ role: 'ADMIN' }), true],
    ['admin inativo', () => aUser({ role: 'ADMIN', status: 'INACTIVE' }), false],
    ['usuario comum ativo', () => aUser(), false],
    ['marcador (ADMIN/ACTIVE, mas nao REGULAR)', () => firstAdminMarker(), false],
  ])('isActiveAdmin: %s -> %s', (_label, make, expected) => {
    expect(make().isActiveAdmin()).toBe(expected);
  });

  it('isManageable: so REGULAR (o marcador responde USER_NOT_FOUND)', () => {
    expect(aUser().isManageable()).toBe(true);
    expect(aUser({ status: 'INACTIVE' }).isManageable()).toBe(true);
    expect(firstAdminMarker().isManageable()).toBe(false);
  });
});

describe('provisionFirstAdmin (RF20, RF21)', () => {
  const input = () => ({
    name: userName('Vagner'),
    email: emailOf('admin@exemplo.com'),
    temporaryPasswordHash: hashOf('Inicial123'),
    now: LATER,
  });

  it('a partir do marcador: vira administrador real MANTENDO o id (os dados legados ja apontam para ele)', () => {
    const marker = firstAdminMarker();
    marker.provisionFirstAdmin(input());
    expect(marker.id.value).toBe(FIRST_ADMIN_ID);
    expect(marker).toMatchObject({ kind: 'REGULAR', role: 'ADMIN', status: 'ACTIVE', mustChangePassword: true });
    expect(marker.name.value).toBe('Vagner');
    expect(marker.email.value).toBe('admin@exemplo.com');
    expect(marker.passwordHash?.value).toBe('$fake$Inicial123');
    expect(marker.canAuthenticate()).toBe(true);
  });

  it('emite FirstAdminBootstrapped com receivedLegacyData = true', () => {
    const marker = firstAdminMarker();
    marker.provisionFirstAdmin(input());
    const [event] = pullEvents(marker) as { constructor: { name: string }; receivedLegacyData: boolean }[];
    expect(event.constructor.name).toBe('FirstAdminBootstrapped');
    expect(event.receivedLegacyData).toBe(true);
  });

  it('so a partir do marcador: usuario regular -> violacao', () => {
    expect(thrown(() => aUser({ role: 'ADMIN' }).provisionFirstAdmin(input()))).toBeInstanceOf(InvariantViolationError);
  });
});

describe('updateDetails (RF13, P17)', () => {
  it('devolve os campos alterados e emite UserUpdated so com nomes de campos', () => {
    const u = aUser({ name: 'Ana Souza', email: 'ana@exemplo.com' });
    const changed = u.updateDetails({ name: userName('Ana Lima'), email: emailOf('ana.lima@exemplo.com'), role: 'ADMIN' }, LATER);
    expect(changed.sort()).toEqual(['email', 'name', 'role']);
    expect(u).toMatchObject({ role: 'ADMIN', updatedAt: LATER });
    const events = pullEvents(u) as { constructor: { name: string }; changedFields: string[] }[];
    expect(events.map((e) => e.constructor.name)).toEqual(['UserUpdated']);
    expect([...events[0].changedFields].sort()).toEqual(['email', 'name', 'role']);
    const text = JSON.stringify(events);
    expect(text).not.toContain('Ana Lima');
    expect(text).not.toContain('ana.lima@exemplo.com');
  });

  it('so um campo alterado: so ele aparece', () => {
    const u = aUser({ name: 'Ana Souza', email: 'ana@exemplo.com' });
    expect(u.updateDetails({ name: userName('Ana Souza'), email: emailOf('ana@exemplo.com'), role: 'ADMIN' }, LATER)).toEqual(['role']);
  });

  it('sem mudanca: lista vazia, sem evento e updatedAt intacto', () => {
    const u = aUser({ name: 'Ana Souza', email: 'ana@exemplo.com' });
    expect(u.updateDetails({ name: userName('Ana Souza'), email: emailOf('ana@exemplo.com'), role: 'USER' }, LATER)).toEqual([]);
    expect(pullEvents(u)).toEqual([]);
    expect(u.updatedAt).toEqual(NOW);
  });

  it('nao mexe em senha, troca obrigatoria nem situacao', () => {
    const u = carlaLike();
    u.updateDetails({ name: userName('Outro Nome'), email: emailOf('outro@exemplo.com'), role: 'ADMIN' }, LATER);
    expect(u.passwordHash?.value).toBe('$fake$Temp1234');
    expect(u).toMatchObject({ mustChangePassword: true, status: 'ACTIVE' });
  });
});

function carlaLike() {
  return aUser({ name: 'Carla', email: 'carla@exemplo.com', mustChangePassword: true, password: 'Temp1234' });
}

describe('rename (RF09)', () => {
  it('muda so o nome, emite UserUpdated[name]', () => {
    const u = aUser();
    expect(u.rename(userName('ana lima'), LATER)).toBe(true);
    expect(u.name.value).toBe('ana lima');
    const [event] = pullEvents(u) as { changedFields: string[] }[];
    expect(event.changedFields).toEqual(['name']);
  });
  it('mesmo nome: false e sem evento', () => {
    const u = aUser({ name: 'Ana Souza' });
    expect(u.rename(userName('Ana Souza'), LATER)).toBe(false);
    expect(pullEvents(u)).toEqual([]);
  });
});

describe('deactivate / reactivate (RF14, RF15, P18)', () => {
  it('deactivate: ACTIVE -> INACTIVE, true, UserDeactivated', () => {
    const u = aUser();
    expect(u.deactivate(LATER)).toBe(true);
    expect(u).toMatchObject({ status: 'INACTIVE', updatedAt: LATER });
    expect(eventNames(pullEvents(u))).toEqual(['UserDeactivated']);
  });

  it('deactivate e idempotente: segunda vez false, sem novo evento, updatedAt intacto', () => {
    const u = aUser({ status: 'INACTIVE' });
    expect(u.deactivate(LATER)).toBe(false);
    expect(pullEvents(u)).toEqual([]);
    expect(u.updatedAt).toEqual(NOW);
  });

  it('reactivate: INACTIVE -> ACTIVE, true, UserReactivated', () => {
    const u = aUser({ status: 'INACTIVE' });
    expect(u.reactivate(LATER)).toBe(true);
    expect(u.status).toBe('ACTIVE');
    expect(eventNames(pullEvents(u))).toEqual(['UserReactivated']);
  });

  it('reactivate e idempotente em usuario ativo', () => {
    const u = aUser();
    expect(u.reactivate(LATER)).toBe(false);
    expect(pullEvents(u)).toEqual([]);
  });

  it('CA21/P16: reactivate nao liga nem desliga a troca obrigatoria e nao toca na senha', () => {
    const withPending = aUser({ status: 'INACTIVE', mustChangePassword: true });
    withPending.reactivate(LATER);
    expect(withPending.mustChangePassword).toBe(true);
    const without = aUser({ status: 'INACTIVE', mustChangePassword: false });
    without.reactivate(LATER);
    expect(without.mustChangePassword).toBe(false);
    expect(without.passwordHash?.value).toBe('$fake$segredo123');
  });
});

describe('resetPassword / changePassword (RF08, RF16)', () => {
  it('resetPassword: novo hash, liga a troca obrigatoria, UserPasswordReset', () => {
    const u = aUser();
    u.resetPassword(hashOf('Nova1234'), LATER);
    expect(u.passwordHash?.value).toBe('$fake$Nova1234');
    expect(u.mustChangePassword).toBe(true);
    expect(eventNames(pullEvents(u))).toEqual(['UserPasswordReset']);
  });

  it('resetPassword vale para usuario INATIVO e nao o reativa', () => {
    const u = aUser({ status: 'INACTIVE' });
    u.resetPassword(hashOf('Nova1234'), LATER);
    expect(u).toMatchObject({ status: 'INACTIVE', mustChangePassword: true });
    expect(u.passwordHash?.value).toBe('$fake$Nova1234');
  });

  it('changePassword: novo hash, desliga a troca obrigatoria, PasswordChanged', () => {
    const u = carlaLike();
    u.changePassword(hashOf('MinhaSenha9'), LATER);
    expect(u.passwordHash?.value).toBe('$fake$MinhaSenha9');
    expect(u.mustChangePassword).toBe(false);
    expect(u.updatedAt).toEqual(LATER);
    expect(eventNames(pullEvents(u))).toEqual(['PasswordChanged']);
  });

  it('eventos nunca carregam nome, e-mail nem hash (sem PII)', () => {
    const u = aUser({ name: 'Ana Souza', email: 'ana@exemplo.com' });
    u.updateDetails({ name: userName('Ana Lima'), email: emailOf('novo@exemplo.com'), role: 'ADMIN' }, LATER);
    u.deactivate(EVEN_LATER);
    u.resetPassword(hashOf('Nova1234'), EVEN_LATER);
    u.changePassword(hashOf('Outra1234'), EVEN_LATER);
    const text = JSON.stringify(pullEvents(u));
    for (const secret of [...SENSITIVE, 'Nova1234', 'Outra1234', 'novo@exemplo.com', 'Ana Lima']) {
      expect(text).not.toContain(secret);
    }
  });
});
