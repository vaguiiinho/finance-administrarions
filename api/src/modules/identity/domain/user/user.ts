import { AggregateRoot } from '@shared/domain/aggregate-root.js';
import { InvariantViolationError } from '@shared/domain/app-error.js';
import { FIRST_ADMIN_ID, SHOWCASE_USER_ID } from '@shared/domain/well-known-ids.js';
import { unwrapPersisted } from '@shared/domain/unwrap.js';
import {
  FirstAdminBootstrapped,
  PasswordChanged,
  ShowcaseAccountProvisioned,
  ShowcasePasswordReplaced,
  UserCreated,
  UserDeactivated,
  UserPasswordReset,
  UserReactivated,
  UserUpdated,
  type UserDomainEvent,
} from './events/user-events.js';
import { AuthenticationEligibility } from './authentication-eligibility.js';
import { ShowcaseAccount } from './showcase-account.js';
import { EmailAddress } from './value-objects/email-address.js';
import type { PasswordHash } from './value-objects/password-hash.js';
import { UserId } from './value-objects/user-id.js';
import { UserName } from './value-objects/user-name.js';
import type { UserRole } from './value-objects/user-role.js';
import type { UserKind, UserStatus } from './value-objects/user-status.js';

export interface UserSnapshot {
  id: UserId;
  name: UserName;
  email: EmailAddress;
  passwordHash: PasswordHash | null;
  kind: UserKind;
  role: UserRole;
  status: UserStatus;
  mustChangePassword: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export type UserChangedField = 'name' | 'email' | 'role';

/**
 * Aggregate de usuário (ADR 0005 3.2).
 * Contrato assumido pelos testes: todos os métodos de mudança recebem `now`; os que podem não mudar nada
 * devolvem `boolean`/lista vazia e só emitem evento quando mudaram.
 */
export class User extends AggregateRoot<UserDomainEvent> {
  private state: UserSnapshot;

  private constructor(state: UserSnapshot) {
    super();
    this.state = state;
  }

  static create(p: {
    id: UserId;
    name: UserName;
    email: EmailAddress;
    role: UserRole;
    temporaryPasswordHash: PasswordHash;
    now: Date;
  }): User {
    const user = new User({
      id: p.id,
      name: p.name,
      email: p.email,
      passwordHash: p.temporaryPasswordHash,
      kind: 'REGULAR',
      role: p.role,
      status: 'ACTIVE',
      mustChangePassword: true,
      createdAt: p.now,
      updatedAt: p.now,
    });
    user.record(new UserCreated(p.id.value, p.role, p.now));
    return user;
  }

  static showcase(p: { passwordHash: PasswordHash; now: Date }): User {
    const user = User.restore({
      id: unwrapPersisted(UserId.create(ShowcaseAccount.id), 'wellKnown'),
      name: unwrapPersisted(UserName.create(ShowcaseAccount.name), 'wellKnown'),
      email: unwrapPersisted(EmailAddress.create(ShowcaseAccount.email), 'wellKnown'),
      passwordHash: p.passwordHash,
      kind: 'SHOWCASE',
      role: 'USER',
      status: 'ACTIVE',
      mustChangePassword: false,
      createdAt: p.now,
      updatedAt: p.now,
    });
    user.record(new ShowcaseAccountProvisioned(user.id.value, p.now));
    return user;
  }

  static firstAdmin(p: { name: UserName; email: EmailAddress; temporaryPasswordHash: PasswordHash; now: Date }): User {
    const user = new User({
      id: unwrapPersisted(UserId.create(FIRST_ADMIN_ID), 'wellKnown'),
      name: p.name,
      email: p.email,
      passwordHash: p.temporaryPasswordHash,
      kind: 'REGULAR',
      role: 'ADMIN',
      status: 'ACTIVE',
      mustChangePassword: true,
      createdAt: p.now,
      updatedAt: p.now,
    });
    user.record(new FirstAdminBootstrapped(user.id.value, false, p.now));
    return user;
  }

  /** Reidrata validando as invariantes 1-3 e 7 do ADR (as mesmas dos CHECK do banco). */
  static restore(snapshot: UserSnapshot): User {
    const { kind, passwordHash, role, id, createdAt, updatedAt } = snapshot;
    if (kind === 'REGULAR' && passwordHash === null) throw new InvariantViolationError('User REGULAR exige passwordHash.');
    if (kind === 'PENDING_FIRST_ADMIN' && (passwordHash !== null || id.value !== FIRST_ADMIN_ID)) {
      throw new InvariantViolationError('Marcador do primeiro administrador exige passwordHash nulo e FIRST_ADMIN_ID.');
    }
    if (kind === 'SHOWCASE') {
      const { email, mustChangePassword } = snapshot;
      if (
        passwordHash === null ||
        role !== 'USER' ||
        id.value !== SHOWCASE_USER_ID ||
        email.value !== ShowcaseAccount.email ||
        mustChangePassword
      ) {
        throw new InvariantViolationError('User SHOWCASE exige as constantes da conta de demonstração.');
      }
    }
    if (updatedAt.getTime() < createdAt.getTime()) throw new InvariantViolationError('updatedAt anterior a createdAt.');
    return new User({ ...snapshot });
  }

  /** Só a partir de `PENDING_FIRST_ADMIN`; mantém o id. */
  provisionFirstAdmin(p: { name: UserName; email: EmailAddress; temporaryPasswordHash: PasswordHash; now: Date }): void {
    if (this.state.kind !== 'PENDING_FIRST_ADMIN') {
      throw new InvariantViolationError('provisionFirstAdmin só vale para o marcador do primeiro administrador.');
    }
    this.state = {
      ...this.state,
      name: p.name,
      email: p.email,
      passwordHash: p.temporaryPasswordHash,
      kind: 'REGULAR',
      role: 'ADMIN',
      status: 'ACTIVE',
      mustChangePassword: true,
      updatedAt: p.now,
    };
    this.record(new FirstAdminBootstrapped(this.state.id.value, true, p.now));
  }

  updateDetails(p: { name: UserName; email: EmailAddress; role: UserRole }, now: Date): UserChangedField[] {
    const changed: UserChangedField[] = [];
    if (p.name.value !== this.state.name.value) changed.push('name');
    if (!p.email.equals(this.state.email)) changed.push('email');
    if (p.role !== this.state.role) changed.push('role');
    if (changed.length === 0) return changed;
    this.state = { ...this.state, name: p.name, email: p.email, role: p.role, updatedAt: now };
    this.record(new UserUpdated(this.state.id.value, [...changed], now));
    return changed;
  }

  rename(name: UserName, now: Date): boolean {
    this.assertNotShowcase('rename');
    if (name.value === this.state.name.value) return false;
    this.state = { ...this.state, name, updatedAt: now };
    this.record(new UserUpdated(this.state.id.value, ['name'], now));
    return true;
  }

  deactivate(now: Date): boolean {
    if (this.state.status === 'INACTIVE') return false;
    this.state = { ...this.state, status: 'INACTIVE', updatedAt: now };
    this.record(new UserDeactivated(this.state.id.value, now));
    return true;
  }

  reactivate(now: Date): boolean {
    if (this.state.status === 'ACTIVE') return false;
    this.state = { ...this.state, status: 'ACTIVE', updatedAt: now };
    this.record(new UserReactivated(this.state.id.value, now));
    return true;
  }

  resetPassword(hash: PasswordHash, now: Date): void {
    this.state = { ...this.state, passwordHash: hash, mustChangePassword: true, updatedAt: now };
    this.record(new UserPasswordReset(this.state.id.value, now));
  }

  /** Só para SHOWCASE: usado pelo seed quando a senha configurada muda. Não mexe em status. */
  replaceShowcasePassword(hash: PasswordHash, now: Date): void {
    if (this.state.kind !== 'SHOWCASE') throw new InvariantViolationError('replaceShowcasePassword só vale para a conta de demonstração.');
    this.state = { ...this.state, passwordHash: hash, updatedAt: now };
    this.record(new ShowcasePasswordReplaced(this.state.id.value, now));
  }

  changePassword(hash: PasswordHash, now: Date): void {
    this.assertNotShowcase('changePassword');
    this.state = { ...this.state, passwordHash: hash, mustChangePassword: false, updatedAt: now };
    this.record(new PasswordChanged(this.state.id.value, now));
  }

  canAuthenticate(): boolean {
    return AuthenticationEligibility.canAuthenticate(this.state.kind, this.state.status);
  }

  private assertNotShowcase(operation: string): void {
    if (this.state.kind === 'SHOWCASE') throw new InvariantViolationError(`${operation} não vale para a conta de demonstração.`);
  }

  isActiveAdmin(): boolean {
    return this.state.kind === 'REGULAR' && this.state.role === 'ADMIN' && this.state.status === 'ACTIVE';
  }

  isManageable(): boolean {
    return this.state.kind === 'REGULAR';
  }

  get id(): UserId {
    return this.state.id;
  }
  get name(): UserName {
    return this.state.name;
  }
  get email(): EmailAddress {
    return this.state.email;
  }
  get passwordHash(): PasswordHash | null {
    return this.state.passwordHash;
  }
  get kind(): UserKind {
    return this.state.kind;
  }
  get role(): UserRole {
    return this.state.role;
  }
  get status(): UserStatus {
    return this.state.status;
  }
  get mustChangePassword(): boolean {
    return this.state.mustChangePassword;
  }
  get createdAt(): Date {
    return this.state.createdAt;
  }
  get updatedAt(): Date {
    return this.state.updatedAt;
  }

  toSnapshot(): UserSnapshot {
    return { ...this.state };
  }
}
