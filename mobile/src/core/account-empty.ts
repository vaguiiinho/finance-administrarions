/**
 * Sinal de "conta sem dados" (ADR 0011 10.13): `GET /api/categories` vazio. `undefined` enquanto carrega ou em erro
 * (as telas usam o layout normal).
 */
export function isAccountEmpty(categories: readonly string[] | undefined): boolean | undefined {
  if (categories === undefined) return undefined;
  return categories.length === 0;
}
