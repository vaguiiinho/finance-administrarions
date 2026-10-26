import { err, ok, type Result } from '@shared/domain/result.js';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** UUID bem formado (qualquer versão), normalizado em minúsculas. Ids gerados são v7 (port IdGenerator). */
export class EntryId {
  private constructor(readonly value: string) {}

  static create(raw: string): Result<EntryId, 'INVALID_FORMAT'> {
    return UUID.test(raw) ? ok(new EntryId(raw.toLowerCase())) : err('INVALID_FORMAT');
  }

  equals(other: EntryId): boolean {
    return this.value === other.value;
  }

  toString(): string {
    return this.value;
  }
}
