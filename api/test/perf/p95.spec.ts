import { percentile } from './p95.js';

describe('percentile (nearest-rank) - ADR 0002 T4', () => {
  const oneToHundred = Array.from({ length: 100 }, (_, i) => i + 1);

  it('p95 de 1..100 e 95 (nearest-rank: ceil(0,95 * n)-esimo menor valor)', () => {
    expect(percentile(oneToHundred, 0.95)).toBe(95);
  });

  it('p95 de 50 amostras e a 48a menor (ceil(47,5) = 48)', () => {
    const samples = Array.from({ length: 50 }, (_, i) => (i + 1) * 10);
    expect(percentile(samples, 0.95)).toBe(480);
  });

  it('n = 1: qualquer percentil devolve a unica amostra', () => {
    expect(percentile([42], 0.95)).toBe(42);
    expect(percentile([42], 0.5)).toBe(42);
    expect(percentile([42], 1)).toBe(42);
  });

  it('nao depende da ordem de entrada e nao muta o array recebido', () => {
    const shuffled = [...oneToHundred].reverse();
    const copy = [...shuffled];
    expect(percentile(shuffled, 0.95)).toBe(95);
    expect(shuffled).toEqual(copy);
  });

  it('empates: valores repetidos nao deslocam o rank', () => {
    expect(percentile([5, 5, 5, 5, 5, 5, 5, 5, 5, 100], 0.95)).toBe(100); // ceil(9,5) = 10o
    expect(percentile([5, 5, 5, 5, 5, 5, 5, 5, 5, 5], 0.95)).toBe(5);
  });

  it('p50 e p100 (maximo) seguem a mesma regra', () => {
    expect(percentile(oneToHundred, 0.5)).toBe(50);
    expect(percentile(oneToHundred, 1)).toBe(100);
  });

  it('amostras vazias ou percentil fora de (0, 1] sao erro (sem NaN silencioso)', () => {
    expect(() => percentile([], 0.95)).toThrow();
    expect(() => percentile([1, 2, 3], 0)).toThrow();
    expect(() => percentile([1, 2, 3], 1.1)).toThrow();
  });
});
