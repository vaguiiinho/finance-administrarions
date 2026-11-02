import type { CurrentUserDto } from '@/lib/api/types';

/** "E a conta demo?" so por `accountKind` (P-ADR5); nunca pelo e-mail. */
export function isDemoAccount(me: Pick<CurrentUserDto, 'accountKind'>): boolean {
  return me.accountKind === 'SHOWCASE';
}
