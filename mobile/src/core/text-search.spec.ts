import { matchCategories, normalizeSearch } from '@/core/text-search';

describe('normalizeSearch', () => {
  it('remove acentos, caixa e espacos nas pontas', () => expect(normalizeSearch('  AlimentAÇÃO  ')).toBe('alimentacao'));
  it('vazio permanece vazio', () => expect(normalizeSearch('')).toBe(''));
  it('so espacos vira vazio', () => expect(normalizeSearch('   ')).toBe(''));
  it('preserva espacos internos', () => expect(normalizeSearch('Casa e Jardim')).toBe('casa e jardim'));
});

describe('matchCategories', () => {
  const all = ['Alimentação', 'Alimentos', 'Transporte', 'Educação', 'Saúde', 'Lazer', 'Moradia', 'Mercado', 'Mercearia'];
  it('busca vazia lista as primeiras (limite padrao 6)', () => expect(matchCategories(all, '')).toEqual(all.slice(0, 6)));
  it('ignora acento e caixa', () => expect(matchCategories(all, 'SAUD')).toEqual(['Saúde']));
  it('casa por trecho no meio do nome', () => expect(matchCategories(all, 'cao')).toEqual(['Alimentação', 'Educação']));
  it('exclui a categoria identica ao que foi digitado', () => expect(matchCategories(all, 'lazer')).toEqual([]));
  it('identica por acento/caixa tambem e excluida, mas parecidas ficam', () => {
    expect(matchCategories(all, 'alimentacao')).toEqual([]);
    expect(matchCategories(all, 'alimento')).toEqual(['Alimentos']);
  });
  it('respeita o limite informado', () => expect(matchCategories(all, 'a', 2)).toHaveLength(2));
  it('sem correspondencia -> vazio', () => expect(matchCategories(all, 'zzz')).toEqual([]));
  it('lista vazia -> vazio', () => expect(matchCategories([], 'a')).toEqual([]));
  it('trata busca so com espacos como vazia', () => expect(matchCategories(all, '   ')).toEqual(all.slice(0, 6)));
});
