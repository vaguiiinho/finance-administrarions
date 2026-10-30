import { err, ok, type Result } from '@shared/domain/result.js';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Dono (usuário) de cartões e lançamentos. Só o id cruza a fronteira com identity (ADR 0005 2.2). */
export class OwnerId {
  private constructor(readonly value: string) {}

  static create(raw: string): Result<OwnerId, 'INVALID_FORMAT'> {
    return typeof raw === 'string' && UUID.test(raw) ? ok(new OwnerId(raw.toLowerCase())) : err('INVALID_FORMAT');
  }

  equals(other: OwnerId): boolean {
    return this.value === other.value;
  }

  toString(): string {
    return this.value;
  }
}
