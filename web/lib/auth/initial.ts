/** CA45 / ADR 9.7: primeiro grafema do nome normalizado, em maiuscula (pt-BR). */
export function userInitial(name: string): string {
  const trimmed = name.trim();
  if (trimmed === "") return "";
  const first = new Intl.Segmenter("pt-BR", { granularity: "grapheme" }).segment(trimmed)[Symbol.iterator]().next().value;
  return (first?.segment ?? "").toLocaleUpperCase("pt-BR");
}
