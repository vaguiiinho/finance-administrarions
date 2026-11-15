import { AccountCapabilities } from './account-capabilities.js';

const caps = (kind: string, role: string) => [...AccountCapabilities.of({ kind, role } as never)].sort();

describe('AccountCapabilities.of (ADR 0011 3.4)', () => {
  it('REGULAR + ADMIN: todas as quatro', () => {
    expect(caps('REGULAR', 'ADMIN')).toEqual(['CHANGE_OWN_PASSWORD', 'MANAGE_EXPENSES', 'MANAGE_USERS', 'UPDATE_OWN_PROFILE']);
  });

  it('REGULAR + USER: MANAGE_EXPENSES (B6), CHANGE_OWN_PASSWORD, UPDATE_OWN_PROFILE; sem MANAGE_USERS', () => {
    expect(caps('REGULAR', 'USER')).toEqual(['CHANGE_OWN_PASSWORD', 'MANAGE_EXPENSES', 'UPDATE_OWN_PROFILE']);
  });

  it('SHOWCASE (USER): so MANAGE_EXPENSES (B6/B8: sem senha nem perfil)', () => {
    expect(caps('SHOWCASE', 'USER')).toEqual(['MANAGE_EXPENSES']);
  });

  it.each(['PENDING_FIRST_ADMIN'])('%s nao autentica: nenhuma capacidade', (kind) => {
    expect(caps(kind, 'USER')).toEqual([]);
    expect(caps(kind, 'ADMIN')).toEqual([]);
  });

  it('SHOWCASE nunca administra usuarios, nem se o role vier ADMIN por engano', () => {
    expect(caps('SHOWCASE', 'ADMIN')).not.toContain('MANAGE_USERS');
  });
});
