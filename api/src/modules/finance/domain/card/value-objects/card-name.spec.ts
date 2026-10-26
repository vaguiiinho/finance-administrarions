import { isOk, unwrap, violationOf } from '@test/support/result.js';
import { CardName } from './card-name.js';

const name = (v: string) => unwrap<CardName>(CardName.create(v));

describe('CardName (CA02, CA03)', () => {
  it('CA03: " nubank " tem a mesma key de "Nubank"', () => {
    expect(name(' nubank ').key).toBe(name('Nubank').key);
    expect(name(' nubank ').value).toBe('nubank');
  });

  it('colapsa espacos e normaliza NFC', () => {
    expect(name('Banco   do  Brasil').value).toBe('Banco do Brasil');
    expect(name('Ita\u00fa').equals(name('Itau\u0301'))).toBe(true);
  });

  it('acentos diferenciam (P18)', () => {
    expect(name('Itau').key).not.toBe(name('Itaú').key);
  });

  it('CA02: vazio -> REQUIRED; 51 -> TOO_LONG; 50 ok', () => {
    expect(violationOf(CardName.create(''))).toBe('REQUIRED');
    expect(violationOf(CardName.create('   '))).toBe('REQUIRED');
    expect(violationOf(CardName.create('a'.repeat(51)))).toBe('TOO_LONG');
    expect(isOk(CardName.create('a'.repeat(50)))).toBe(true);
  });
});
