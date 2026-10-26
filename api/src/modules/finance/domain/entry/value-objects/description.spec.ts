import { isOk, unwrap, violationOf } from '@test/support/result.js';
import { Description } from './description.js';

describe('Description (CA16)', () => {
  it('normaliza com trim', () => {
    expect(unwrap<Description>(Description.create('  Aluguel  ')).value).toBe('Aluguel');
  });

  it('normaliza para NFC', () => {
    const nfd = 'Café'; // e + acento combinante
    expect(unwrap<Description>(Description.create(nfd)).value).toBe('Café');
  });

  it.each([[''], ['   '], ['\t\n']])('rejeita vazio/so espacos %j com REQUIRED', (v) => {
    expect(violationOf(Description.create(v))).toBe('REQUIRED');
  });

  it('aceita exatamente 120 caracteres e rejeita 121 com TOO_LONG', () => {
    expect(unwrap<Description>(Description.create('a'.repeat(120))).value).toHaveLength(120);
    expect(violationOf(Description.create('a'.repeat(121)))).toBe('TOO_LONG');
  });

  it('conta code points: 120 emojis valem 120, 121 sao demais', () => {
    expect(isOk(Description.create('😀'.repeat(120)))).toBe(true);
    expect(violationOf(Description.create('😀'.repeat(121)))).toBe('TOO_LONG');
  });

  it('o limite e aplicado depois do trim', () => {
    expect(isOk(Description.create(` ${'a'.repeat(120)} `))).toBe(true);
  });
});
