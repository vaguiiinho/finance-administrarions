import { isDemoAccount } from '@/core/account-kind';
import { isAccountEmpty } from '@/core/account-empty';

describe('isDemoAccount (P-ADR5)', () => {
  it('so por accountKind', () => expect(isDemoAccount({ accountKind: 'SHOWCASE' })).toBe(true));
  it('REGULAR com e-mail demo@showcase.invalid NAO e demo', () =>
    expect(isDemoAccount({ accountKind: 'REGULAR', email: 'demo@showcase.invalid' } as never)).toBe(false));
});

describe('isAccountEmpty (ADR 0011 10.13)', () => {
  it('[] -> true; lista -> false; undefined -> undefined', () => {
    expect(isAccountEmpty([])).toBe(true);
    expect(isAccountEmpty(['Moradia'])).toBe(false);
    expect(isAccountEmpty(undefined)).toBeUndefined();
  });
});
