import type { DomainEvent } from '@shared/domain/domain-event.js';

export class UserCreated implements DomainEvent {
  constructor(readonly userId: string, readonly role: string, readonly occurredAt: Date) {}
}
export class UserUpdated implements DomainEvent {
  constructor(readonly userId: string, readonly changedFields: readonly string[], readonly occurredAt: Date) {}
}
export class UserDeactivated implements DomainEvent {
  constructor(readonly userId: string, readonly occurredAt: Date) {}
}
export class UserReactivated implements DomainEvent {
  constructor(readonly userId: string, readonly occurredAt: Date) {}
}
export class UserPasswordReset implements DomainEvent {
  constructor(readonly userId: string, readonly occurredAt: Date) {}
}
export class PasswordChanged implements DomainEvent {
  constructor(readonly userId: string, readonly occurredAt: Date) {}
}
export class FirstAdminBootstrapped implements DomainEvent {
  constructor(readonly userId: string, readonly receivedLegacyData: boolean, readonly occurredAt: Date) {}
}
export type UserDomainEvent =
  | UserCreated
  | UserUpdated
  | UserDeactivated
  | UserReactivated
  | UserPasswordReset
  | PasswordChanged
  | FirstAdminBootstrapped;
