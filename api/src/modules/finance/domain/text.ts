/** NFC + trim. */
export function normalizeText(raw: string): string {
  return raw.normalize('NFC').trim();
}

/** NFC + trim + colapso de qualquer sequência de espaços em um espaço. */
export function normalizeLabel(raw: string): string {
  return normalizeText(raw).replace(/\s+/g, ' ');
}

/** Comprimento em code points (emoji conta 1). */
export function codePointLength(value: string): number {
  let count = 0;
  for (const _ of value) count++;
  return count;
}

/** Chave de comparação case-insensitive (acentos diferenciam). */
export function labelKey(value: string): string {
  return value.toLocaleLowerCase('pt-BR');
}
