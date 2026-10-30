import { plain } from '@test/support/identity-builders.js';
import { Argon2PasswordHasher } from './argon2-password-hasher.js';

describe('Argon2PasswordHasher (ADR D2, RNF01, RNF05)', () => {
  const hasher = new Argon2PasswordHasher();

  it('hash gera PHC argon2id com salt (mesma senha -> hashes diferentes) e verify confere', async () => {
    const a = await hasher.hash(plain('segredo123'));
    const b = await hasher.hash(plain('segredo123'));
    expect(a.value).toMatch(/^\$argon2id\$/);
    expect(a.value).not.toBe(b.value);
    expect(a.value).not.toContain('segredo123');
    expect(await hasher.verify(plain('segredo123'), a)).toBe(true);
    expect(await hasher.verify(plain('errada1234'), a)).toBe(false);
  });

  it('senha de 72 caracteres e verificada por inteiro', async () => {
    const h = await hasher.hash(plain('a'.repeat(72)));
    expect(await hasher.verify(plain('a'.repeat(72)), h)).toBe(true);
    expect(await hasher.verify(plain(`${'a'.repeat(71)}b`), h)).toBe(false);
  });

  it('RNF05: verify com hash null devolve false e leva tempo comparavel ao de um hash real', async () => {
    const real = await hasher.hash(plain('segredo123'));
    const time = async (fn: () => Promise<unknown>) => {
      const t = performance.now();
      await fn();
      return performance.now() - t;
    };
    await hasher.verify(plain('x1234567'), null); // aquecimento
    const withHash = await time(() => hasher.verify(plain('errada1234'), real));
    const withNull = await time(() => hasher.verify(plain('errada1234'), null));
    expect(await hasher.verify(plain('segredo123'), null)).toBe(false);
    expect(withNull).toBeGreaterThan(withHash * 0.5);
  });

  it('RNF07: login p95 < 500 ms inclui o hash (20 verificacoes)', async () => {
    const h = await hasher.hash(plain('segredo123'));
    const samples: number[] = [];
    for (let i = 0; i < 20; i++) {
      const t = performance.now();
      await hasher.verify(plain('segredo123'), h);
      samples.push(performance.now() - t);
    }
    samples.sort((x, y) => x - y);
    expect(samples[Math.ceil(samples.length * 0.95) - 1]).toBeLessThan(500);
  });
});
