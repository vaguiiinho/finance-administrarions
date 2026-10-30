import { err, ok, type Result } from '@shared/domain/result.js';

export type UserRole = 'ADMIN' | 'USER';

export function parseRole(raw: unknown): Result<UserRole, 'REQUIRED' | 'INVALID_VALUE'> {
  if (raw === undefined || raw === null || raw === '') return err('REQUIRED');
  return raw === 'ADMIN' || raw === 'USER' ? ok(raw) : err('INVALID_VALUE');
}
