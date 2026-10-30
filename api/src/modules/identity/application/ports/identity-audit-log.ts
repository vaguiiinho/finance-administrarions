import type { EmailAddress } from '../../domain/user/value-objects/email-address.js';
import type { AttemptScope } from './attempt-limiter.js';

export interface AuditContext {
  clientIp: string;
  at: Date;
}
export interface IdentityAuditLog {
  loginSucceeded(e: AuditContext & { userId: string }): void;
  loginFailed(e: AuditContext & { email: EmailAddress | null; userId: string | null }): void;
  rateLimited(e: AuditContext & { scope: AttemptScope; userId: string | null }): void;
  passwordChanged(e: AuditContext & { userId: string }): void;
  userCreated(e: AuditContext & { actorId: string; userId: string; role: string }): void;
  userUpdated(e: AuditContext & { actorId: string; userId: string; changedFields: string[] }): void;
  userDeactivated(e: AuditContext & { actorId: string; userId: string; revokedSessions: number }): void;
  userReactivated(e: AuditContext & { actorId: string; userId: string }): void;
  userPasswordReset(e: AuditContext & { actorId: string; userId: string; revokedSessions: number }): void;
  firstAdminBootstrapped(e: { userId: string; receivedLegacyData: boolean; at: Date }): void;
  adminRecovered(e: { userId: string; at: Date }): void;
}
export const IDENTITY_AUDIT_LOG = Symbol('IDENTITY_AUDIT_LOG');
