import type { UserRole } from './value-objects/user-role.js';
import type { UserKind } from './value-objects/user-status.js';

export type Capability = 'MANAGE_USERS' | 'MANAGE_EXPENSES' | 'CHANGE_OWN_PASSWORD' | 'UPDATE_OWN_PROFILE';

/** O que cada conta pode fazer (ADR 0011 3.4). Política pura; só contas que autenticam têm capacidades. */
export const AccountCapabilities = {
  of(account: { kind: UserKind; role: UserRole }): ReadonlySet<Capability> {
    if (account.kind === 'REGULAR') {
      const caps: Capability[] = ['MANAGE_EXPENSES', 'CHANGE_OWN_PASSWORD', 'UPDATE_OWN_PROFILE'];
      if (account.role === 'ADMIN') caps.push('MANAGE_USERS');
      return new Set(caps);
    }
    if (account.kind === 'SHOWCASE') return new Set<Capability>(['MANAGE_EXPENSES']);
    return new Set<Capability>();
  },
};
