import { unwrap, violationOf } from '@test/support/result.js';
import { AppVersion } from './app-version.js';

const v = (raw: string) => unwrap<AppVersion>(AppVersion.create(raw));

describe('AppVersion (ADR 0011 3.1)', () => {
  it.each(['1.0.0', '0.0.1', '12.34.56', '1.10.0', '9999.9999.9999'])('aceita %s', (raw) => {
    expect(AppVersion.create(raw).ok).toBe(true);
  });

  it.each(['', '1', '1.0', '1.0.0.0', 'v1.0.0', '1.0.x', '1.0.0-beta', ' 1.0.0', '1.0.0 ', '-1.0.0', '10000.0.0', '1..0'])(
    'rejeita %j',
    (raw) => {
      expect(AppVersion.create(raw).ok).toBe(false);
    },
  );

  it('compara numericamente por segmento: 1.10.0 > 1.9.0 (nao lexicografico)', () => {
    expect(v('1.10.0').compare(v('1.9.0'))).toBe(1);
    expect(v('1.9.0').compare(v('1.10.0'))).toBe(-1);
  });

  it('igualdade -> 0; maior/menor em cada segmento', () => {
    expect(v('1.2.3').compare(v('1.2.3'))).toBe(0);
    expect(v('2.0.0').compare(v('1.99.99'))).toBe(1);
    expect(v('1.2.4').compare(v('1.2.3'))).toBe(1);
    expect(v('1.2.3').compare(v('1.3.0'))).toBe(-1);
  });

  it('devolve um erro (nao lanca) para entrada invalida', () => {
    expect(typeof violationOf(AppVersion.create('lixo'))).toBe('string');
  });
});
