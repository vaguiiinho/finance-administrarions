/**
 * Único ponto de acesso ao formato de `Result<T, E>` (shared/domain/result.ts).
 * Contrato assumido: união discriminada `{ ok: true; value: T } | { ok: false; error: E }`.
 * Se a implementação usar outro formato, ajuste APENAS este arquivo.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyResult = any;

export function unwrap<T = any>(result: AnyResult): T {
  if (!result.ok) {
    throw new Error(`Esperava Result ok, mas veio erro: ${JSON.stringify(result.error)}`);
  }
  return result.value as T;
}

export function violationOf(result: AnyResult): string {
  if (result.ok) {
    throw new Error(`Esperava Result com erro, mas veio ok: ${String(result.value)}`);
  }
  return result.error as string;
}

export function isOk(result: AnyResult): boolean {
  return result.ok === true;
}
