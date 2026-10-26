import { err, ok, type Result } from '@shared/domain/result.js';

export type EntryType = 'INCOME' | 'EXPENSE';

export function parseEntryType(raw: string): Result<EntryType, 'INVALID_VALUE'> {
  return raw === 'INCOME' || raw === 'EXPENSE' ? ok(raw) : err('INVALID_VALUE');
}
