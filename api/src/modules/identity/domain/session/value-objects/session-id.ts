import { err, ok, type Result } from '@shared/domain/result.js';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export class SessionId {
  private constructor(readonly value: string) {}
  static create(raw: string): Result<SessionId, 'INVALID_FORMAT'> {
    return typeof raw === 'string' && UUID.test(raw) ? ok(new SessionId(raw.toLowerCase())) : err('INVALID_FORMAT');
  }
  equals(other: SessionId): boolean {
    return this.value === other.value;
  }
}
