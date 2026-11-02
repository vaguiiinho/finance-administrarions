import { unwrap, violationOf } from '@test/support/result.js';
import { PlainPassword } from './plain-password.js';

describe('PlainPassword.forShowcaseAccount (ADR 0011 3.5)', () => {
  it('aceita "demo" (4 caracteres, sem minimo de 8)', () => {
    expect(unwrap<PlainPassword>(PlainPassword.forShowcaseAccount('demo')).reveal()).toBe('demo');
  });

  it('aceita 1 e 72 code points', () => {
    expect(PlainPassword.forShowcaseAccount('x').ok).toBe(true);
    expect(PlainPassword.forShowcaseAccount('a'.repeat(72)).ok).toBe(true);
  });

  it('vazio -> REQUIRED; mais de 72 code points -> TOO_LONG', () => {
    expect(violationOf(PlainPassword.forShowcaseAccount(''))).toBe('REQUIRED');
    expect(violationOf(PlainPassword.forShowcaseAccount('a'.repeat(73)))).toBe('TOO_LONG');
  });

  it('conta code points, nao unidades UTF-16 (72 emojis passam, 73 nao)', () => {
    expect(PlainPassword.forShowcaseAccount('😀'.repeat(72)).ok).toBe(true);
    expect(violationOf(PlainPassword.forShowcaseAccount('😀'.repeat(73)))).toBe('TOO_LONG');
  });

  it('o valor continua mascarado em toString/JSON', () => {
    const p = unwrap<PlainPassword>(PlainPassword.forShowcaseAccount('demo'));
    expect(String(p)).not.toContain('demo');
    expect(JSON.stringify(p)).not.toContain('demo');
  });
});

describe('PlainPassword.create: regra geral NAO muda (CA45)', () => {
  it('"demo" continua TOO_SHORT ao definir senha', () => {
    expect(violationOf(PlainPassword.create('demo'))).toBe('TOO_SHORT');
  });
  it('7 caracteres seguem TOO_SHORT; 8 passam', () => {
    expect(violationOf(PlainPassword.create('1234567'))).toBe('TOO_SHORT');
    expect(PlainPassword.create('12345678').ok).toBe(true);
  });
});
