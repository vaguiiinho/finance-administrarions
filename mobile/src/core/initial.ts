/** Inicial do usuario sem `Intl.Segmenter` (ausente no Hermes): NFC + primeiro code point + maiuscula pt-BR. */
export function userInitial(name: string): string {
  const trimmed = name.trim().normalize('NFC');
  if (!trimmed) return '?';
  const first = String.fromCodePoint(trimmed.codePointAt(0)!);
  return first.toLocaleUpperCase('pt-BR');
}
