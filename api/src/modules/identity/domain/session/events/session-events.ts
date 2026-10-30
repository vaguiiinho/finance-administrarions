import type { DomainEvent } from '@shared/domain/domain-event.js';

export class SessionOpened implements DomainEvent {
  constructor(readonly sessionId: string, readonly userId: string, readonly occurredAt: Date) {}
}
export class SessionRevoked implements DomainEvent {
  constructor(readonly sessionId: string, readonly userId: string, readonly occurredAt: Date) {}
}
export class UserSessionsRevoked implements DomainEvent {
  constructor(
    readonly userId: string,
    readonly reason: 'deactivated' | 'password-reset' | 'password-changed',
    readonly count: number,
    readonly occurredAt: Date,
  ) {}
}
export type SessionDomainEvent = SessionOpened | SessionRevoked | UserSessionsRevoked;
