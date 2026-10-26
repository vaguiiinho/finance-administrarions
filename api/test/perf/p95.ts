/** Percentil por nearest-rank: o ceil(q * n)-esimo menor valor. Nao muta a entrada (ADR 0002 T4). */
export function percentile(samples: readonly number[], q: number): number {
  if (samples.length === 0) throw new Error('percentile: amostras vazias');
  if (!(q > 0 && q <= 1)) throw new Error(`percentile: q fora de (0, 1]: ${q}`);
  const sorted = [...samples].sort((a, b) => a - b);
  const rank = Math.max(1, Math.ceil(q * sorted.length - 1e-9));
  return sorted[rank - 1];
}
