import { createHash } from 'node:crypto';
import { Logger } from '@nestjs/common';
import type { AuditContext, ClientAuditInfo, IdentityAuditLog } from '../application/ports/identity-audit-log.js';
import type { AttemptScope } from '../application/ports/attempt-limiter.js';
import type { EmailAddress } from '../domain/user/value-objects/email-address.js';

/** Trilha de auditoria (RNF13): JSON no Logger do Nest. E-mail só como sha256 truncado; nunca senha nem valores editados. */
export class LoggerIdentityAuditLog implements IdentityAuditLog {
  private readonly logger = new Logger('IdentityAudit');

  loginSucceeded(e: AuditContext & { userId: string; client: ClientAuditInfo }): void {
    this.emit('login.succeeded', e);
  }
  loginFailed(e: AuditContext & { email: EmailAddress | null; userId: string | null; client: ClientAuditInfo }): void {
    this.emit('login.failed', { ...e, email: e.email ? digestOfEmail(e.email.value) : null });
  }
  rateLimited(e: AuditContext & { scope: AttemptScope; userId: string | null }): void {
    this.emit('rate.limited', e);
  }
  passwordChanged(e: AuditContext & { userId: string }): void {
    this.emit('password.changed', e);
  }
  userCreated(e: AuditContext & { actorId: string; userId: string; role: string }): void {
    this.emit('user.created', e);
  }
  userUpdated(e: AuditContext & { actorId: string; userId: string; changedFields: string[] }): void {
    this.emit('user.updated', e);
  }
  userDeactivated(e: AuditContext & { actorId: string; userId: string; revokedSessions: number }): void {
    this.emit('user.deactivated', e);
  }
  userReactivated(e: AuditContext & { actorId: string; userId: string }): void {
    this.emit('user.reactivated', e);
  }
  userPasswordReset(e: AuditContext & { actorId: string; userId: string; revokedSessions: number }): void {
    this.emit('user.password_reset', e);
  }
  firstAdminBootstrapped(e: { userId: string; receivedLegacyData: boolean; at: Date }): void {
    this.emit('first_admin.bootstrapped', e);
  }
  adminRecovered(e: { userId: string; at: Date }): void {
    this.emit('admin.recovered', e);
  }

  private emit(event: string, payload: object): void {
    this.logger.log(JSON.stringify({ event, ...payload }));
  }
}

function digestOfEmail(email: string): string {
  return createHash('sha256').update(email).digest('hex').slice(0, 16);
}
