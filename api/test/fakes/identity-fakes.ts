import type { Clock } from '@shared/application/ports/clock.js';
import { FixedClock } from './simple-fakes.js';
import { Session } from '@identity/domain/session/session.js';
import type { SessionRepository } from '@identity/domain/session/session.repository.js';
import type { SessionId } from '@identity/domain/session/value-objects/session-id.js';
import { SessionTokenDigest } from '@identity/domain/session/value-objects/session-token-digest.js';
import { EmailTakenError } from '@identity/domain/user/errors/user-errors.js';
import { User } from '@identity/domain/user/user.js';
import type { UserRepository } from '@identity/domain/user/user.repository.js';
import type { EmailAddress } from '@identity/domain/user/value-objects/email-address.js';
import { PasswordHash } from '@identity/domain/user/value-objects/password-hash.js';
import type { PlainPassword } from '@identity/domain/user/value-objects/plain-password.js';
import type { UserId } from '@identity/domain/user/value-objects/user-id.js';
import type { AttemptDecision, AttemptKey, AttemptLimiter } from '@identity/application/ports/attempt-limiter.js';
import type { AuditContext, IdentityAuditLog } from '@identity/application/ports/identity-audit-log.js';
import type { IdentityTransactionScope, IdentityUnitOfWork } from '@identity/application/ports/identity-unit-of-work.js';
import type { PasswordHasher } from '@identity/application/ports/password-hasher.js';
import type { SessionPrincipalLookup, SessionPrincipalRecord } from '@identity/application/ports/session-principal-lookup.js';
import type { IssuedSessionToken, SessionTokenIssuer } from '@identity/application/ports/session-token-issuer.js';
import { ATTEMPT_POLICIES } from '@identity/application/policies/attempt-policies.js';
import { unwrap } from '../support/result.js';

const copyUser = (u: User) => User.restore(u.toSnapshot());
const copySession = (s: Session) => Session.restore(s.toSnapshot());

/** Hash fake legivel: `$fake$<senha>`. Conta chamadas e registra a ordem no log compartilhado (hash fora do lock, ADR 5.4). */
export class FakePasswordHasher implements PasswordHasher {
  hashCalls = 0;
  verifyCalls = 0;
  constructor(private readonly log: string[] = []) {}
  async hash(password: PlainPassword): Promise<PasswordHash> {
    this.hashCalls++;
    this.log.push('hash');
    return unwrap<PasswordHash>(PasswordHash.create(`$fake$${password.reveal()}`));
  }
  async verify(password: PlainPassword, hash: PasswordHash | null): Promise<boolean> {
    this.verifyCalls++;
    this.log.push('verify');
    return hash !== null && hash.value === `$fake$${password.reveal()}`;
  }
}

export class InMemoryUserRepository implements UserRepository {
  store = new Map<string, User>();
  calls = { insert: 0, update: 0, findById: 0, findByEmail: 0, countActiveAdminsExcept: 0 };
  /** Quando preenchido, o proximo insert/update falha como corrida de e-mail (users_email_uq). */
  failNextWriteWithEmailTaken = false;
  /** Preenchido pelo UnitOfWork: true enquanto o lockAdminSet da transacao corrente foi adquirido. */
  adminLockHeld = false;
  constructor(private readonly log: string[] = []) {}

  async insert(user: User): Promise<void> {
    this.calls.insert++;
    this.assertEmailFree(user);
    this.store.set(user.id.value, copyUser(user));
  }
  async update(user: User): Promise<void> {
    this.calls.update++;
    this.assertEmailFree(user);
    this.store.set(user.id.value, copyUser(user));
  }
  async findById(id: UserId): Promise<User | null> {
    this.calls.findById++;
    const found = this.store.get(id.value);
    return found ? copyUser(found) : null;
  }
  async findByEmail(email: EmailAddress): Promise<User | null> {
    this.calls.findByEmail++;
    for (const u of this.store.values()) if (u.email.value === email.value) return copyUser(u);
    return null;
  }
  async listManageable(): Promise<User[]> {
    return [...this.store.values()]
      .filter((u) => u.kind === 'REGULAR')
      .sort(
        (a, b) =>
          Number(a.status === 'INACTIVE') - Number(b.status === 'INACTIVE') ||
          a.name.value.localeCompare(b.name.value, 'pt-BR') ||
          a.id.value.localeCompare(b.id.value),
      )
      .map(copyUser);
  }
  async countActiveAdminsExcept(except: UserId): Promise<number> {
    this.calls.countActiveAdminsExcept++;
    this.log.push('count-admins');
    if (!this.adminLockHeld) {
      throw new Error('CONTRATO: countActiveAdminsExcept chamado SEM lockAdminSet antes (T14)');
    }
    return [...this.store.values()].filter(
      (u) => u.kind === 'REGULAR' && u.role === 'ADMIN' && u.status === 'ACTIVE' && u.id.value !== except.value,
    ).length;
  }
  async countRegular(): Promise<number> {
    return [...this.store.values()].filter((u) => u.kind === 'REGULAR').length;
  }
  seed(user: User): void {
    this.store.set(user.id.value, copyUser(user));
  }
  get(id: string): User | undefined {
    const found = this.store.get(id);
    return found ? copyUser(found) : undefined;
  }
  all(): User[] {
    return [...this.store.values()].map(copyUser);
  }
  snapshotState() {
    return new Map([...this.store].map(([k, v]) => [k, copyUser(v)]));
  }
  restoreState(state: Map<string, User>) {
    this.store = state;
  }
  private assertEmailFree(user: User) {
    if (this.failNextWriteWithEmailTaken) {
      this.failNextWriteWithEmailTaken = false;
      throw new EmailTakenError();
    }
    for (const u of this.store.values()) {
      if (u.id.value !== user.id.value && u.email.value === user.email.value) throw new EmailTakenError();
    }
  }
}

export class InMemorySessionRepository implements SessionRepository {
  store = new Map<string, Session>();
  calls = { deleteAllOfUser: 0, deleteAllOfUserExcept: 0, delete: 0 };
  async insert(session: Session): Promise<void> {
    this.store.set(session.id.value, copySession(session));
  }
  async findActiveByDigest(digest: SessionTokenDigest, now: Date): Promise<Session | null> {
    for (const s of this.store.values()) {
      if (s.tokenDigest.value === digest.value && s.expiresAt.getTime() > now.getTime()) return copySession(s);
    }
    return null;
  }
  async delete(id: SessionId): Promise<void> {
    this.calls.delete++;
    this.store.delete(id.value);
  }
  async deleteAllOfUser(userId: UserId): Promise<number> {
    this.calls.deleteAllOfUser++;
    return this.removeWhere((s) => s.userId.value === userId.value);
  }
  async deleteAllOfUserExcept(userId: UserId, keep: SessionId): Promise<number> {
    this.calls.deleteAllOfUserExcept++;
    return this.removeWhere((s) => s.userId.value === userId.value && s.id.value !== keep.value);
  }
  async deleteExpired(now: Date): Promise<number> {
    return this.removeWhere((s) => s.expiresAt.getTime() <= now.getTime());
  }
  seed(session: Session): void {
    this.store.set(session.id.value, copySession(session));
  }
  ofUser(userId: string): Session[] {
    return [...this.store.values()].filter((s) => s.userId.value === userId).map(copySession);
  }
  snapshotState() {
    return new Map([...this.store].map(([k, v]) => [k, copySession(v)]));
  }
  restoreState(state: Map<string, Session>) {
    this.store = state;
  }
  private removeWhere(predicate: (s: Session) => boolean): number {
    let removed = 0;
    for (const [id, s] of [...this.store]) {
      if (predicate(s)) {
        this.store.delete(id);
        removed++;
      }
    }
    return removed;
  }
}

/** Unit of work em memoria: snapshot antes, rollback se `work` lancar. Registra `tx:begin`, `lock:admin`, `lock:first-admin`. */
export class InMemoryIdentityUnitOfWork implements IdentityUnitOfWork {
  runs = 0;
  rollbacks = 0;
  adminLocks = 0;
  firstAdminLocks = 0;
  constructor(
    private readonly users: InMemoryUserRepository,
    private readonly sessions: InMemorySessionRepository,
    private readonly log: string[] = [],
  ) {}
  async run<T>(work: (scope: IdentityTransactionScope) => Promise<T>): Promise<T> {
    this.runs++;
    this.log.push('tx:begin');
    const usersState = this.users.snapshotState();
    const sessionsState = this.sessions.snapshotState();
    this.users.adminLockHeld = false;
    try {
      return await work({
        users: this.users,
        sessions: this.sessions,
        lockAdminSet: async () => {
          this.adminLocks++;
          this.log.push('lock:admin');
          this.users.adminLockHeld = true;
        },
        lockFirstAdminBootstrap: async () => {
          this.firstAdminLocks++;
          this.log.push('lock:first-admin');
        },
      });
    } catch (error) {
      this.rollbacks++;
      this.users.restoreState(usersState);
      this.sessions.restoreState(sessionsState);
      throw error;
    } finally {
      this.users.adminLockHeld = false;
      this.log.push('tx:end');
    }
  }
}

const hex64 = (n: number) => n.toString(16).padStart(64, '0');
const digestOf = (n: number) => unwrap<SessionTokenDigest>(SessionTokenDigest.create(hex64(n)));

/** Tokens `tok-<n>`; digest = n em hex com 64 casas. Qualquer outro formato -> null. */
export class FixedTokenIssuer implements SessionTokenIssuer {
  private counter = 0;
  issue(): IssuedSessionToken {
    this.counter++;
    return { token: `tok-${this.counter}`, digest: digestOf(this.counter) };
  }
  digest(token: string): SessionTokenDigest | null {
    const m = /^tok-(\d+)$/.exec(token ?? '');
    return m ? digestOf(Number(m[1])) : null;
  }
}

/** Le o estado ATUAL de users/sessions a cada chamada (sem cache), como o adapter real (T16). */
export class InMemorySessionPrincipalLookup implements SessionPrincipalLookup {
  calls = 0;
  constructor(
    private readonly users: InMemoryUserRepository,
    private readonly sessions: InMemorySessionRepository,
  ) {}
  async findByDigest(digest: SessionTokenDigest, now: Date): Promise<SessionPrincipalRecord | null> {
    this.calls++;
    const session = await this.sessions.findActiveByDigest(digest, now);
    if (!session) return null;
    const user = this.users.get(session.userId.value);
    if (!user) return null;
    return {
      sessionId: session.id.value,
      userId: user.id.value,
      kind: user.kind,
      role: user.role,
      status: user.status,
      mustChangePassword: user.mustChangePassword,
    };
  }
}

/** Limitador de teste com a semantica do ADR: `peek` bloqueia ao atingir o limite de falhas; `consume` conta requisicoes. */
export class CountingAttemptLimiter implements AttemptLimiter {
  private failures = new Map<string, number>();
  private requests = new Map<string, number>();
  private k = (key: AttemptKey) => `${key.scope}:${key.value}`;
  failureCount(scope: AttemptKey['scope'], value: string): number {
    return this.failures.get(`${scope}:${value}`) ?? 0;
  }
  async consume(key: AttemptKey): Promise<AttemptDecision> {
    const n = (this.requests.get(this.k(key)) ?? 0) + 1;
    this.requests.set(this.k(key), n);
    const policy = ATTEMPT_POLICIES[key.scope];
    return n > policy.limit ? { allowed: false, retryAfterSeconds: policy.windowSeconds } : { allowed: true };
  }
  async peek(key: AttemptKey): Promise<AttemptDecision> {
    const policy = ATTEMPT_POLICIES[key.scope];
    return (this.failures.get(this.k(key)) ?? 0) >= policy.limit
      ? { allowed: false, retryAfterSeconds: policy.windowSeconds }
      : { allowed: true };
  }
  async recordFailure(key: AttemptKey): Promise<void> {
    this.failures.set(this.k(key), (this.failures.get(this.k(key)) ?? 0) + 1);
  }
  async reset(key: AttemptKey): Promise<void> {
    this.failures.delete(this.k(key));
  }
}

type AuditCall = { event: string; payload: Record<string, unknown> };

export class SpyIdentityAuditLog implements IdentityAuditLog {
  calls: AuditCall[] = [];
  private rec(event: string, payload: object) {
    this.calls.push({ event, payload: payload as Record<string, unknown> });
  }
  of(event: string): AuditCall[] {
    return this.calls.filter((c) => c.event === event);
  }
  loginSucceeded(e: AuditContext & { userId: string }) {
    this.rec('loginSucceeded', e);
  }
  loginFailed(e: AuditContext & { email: EmailAddress | null; userId: string | null }) {
    this.rec('loginFailed', e);
  }
  rateLimited(e: AuditContext & { scope: string; userId: string | null }) {
    this.rec('rateLimited', e);
  }
  passwordChanged(e: AuditContext & { userId: string }) {
    this.rec('passwordChanged', e);
  }
  userCreated(e: AuditContext & { actorId: string; userId: string; role: string }) {
    this.rec('userCreated', e);
  }
  userUpdated(e: AuditContext & { actorId: string; userId: string; changedFields: string[] }) {
    this.rec('userUpdated', e);
  }
  userDeactivated(e: AuditContext & { actorId: string; userId: string; revokedSessions: number }) {
    this.rec('userDeactivated', e);
  }
  userReactivated(e: AuditContext & { actorId: string; userId: string }) {
    this.rec('userReactivated', e);
  }
  userPasswordReset(e: AuditContext & { actorId: string; userId: string; revokedSessions: number }) {
    this.rec('userPasswordReset', e);
  }
  firstAdminBootstrapped(e: { userId: string; receivedLegacyData: boolean; at: Date }) {
    this.rec('firstAdminBootstrapped', e);
  }
  adminRecovered(e: { userId: string; at: Date }) {
    this.rec('adminRecovered', e);
  }
}

export type { Clock, FixedClock };
