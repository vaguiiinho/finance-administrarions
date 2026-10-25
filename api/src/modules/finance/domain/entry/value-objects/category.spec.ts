import { isOk, unwrap, violationOf } from '@test/support/result.js';
import { Category } from './category.js';

const cat = (v: string) => unwrap<Category>(Category.create(v));

describe('Category (CA20, CA56)', () => {
  it('normaliza NFC, trim e colapsa espacos internos', () => {
    expect(cat('  Alimentação   fora  de casa ').value).toBe('Alimentação fora de casa');
    expect(cat('Alimentação').value).toBe('Alimentação');
  });

  it('key e case-insensitive (pt-BR)', () => {
    expect(cat('  alimentação ').key).toBe(cat('Alimentação').key);
    expect(cat('MORADIA').key).toBe('moradia');
    expect(cat('Moradia').equals(cat('moradia'))).toBe(true);
  });

  it('acentos diferenciam (P04)', () => {
    expect(cat('Alimentacao').equals(cat('Alimentação'))).toBe(false);
    expect(cat('Alimentacao').key).not.toBe(cat('Alimentação').key);
  });

  it('colapso de espacos entra na key', () => {
    expect(cat('Casa   e  Jardim').key).toBe(cat('casa e jardim').key);
  });

  it.each([[''], ['   ']])('rejeita vazio %j com REQUIRED', (v) => {
    expect(violationOf(Category.create(v))).toBe('REQUIRED');
  });

  it('50 code points ok, 51 TOO_LONG, emoji conta 1', () => {
    expect(isOk(Category.create('a'.repeat(50)))).toBe(true);
    expect(violationOf(Category.create('a'.repeat(51)))).toBe('TOO_LONG');
    expect(isOk(Category.create('😀'.repeat(50)))).toBe(true);
  });
});
