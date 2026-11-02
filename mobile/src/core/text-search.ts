/** Busca sem diferenciar acento e caixa (tela de categoria). */
export function normalizeSearch(value: string): string {
  return value.normalize('NFD').replace(/[̀-ͯ]/g, '').toLocaleLowerCase('pt-BR').trim();
}

export function matchCategories(all: readonly string[], query: string, limit = 6): string[] {
  const q = normalizeSearch(query);
  return all.filter((c) => normalizeSearch(c) !== q && (q === '' || normalizeSearch(c).includes(q))).slice(0, limit);
}
