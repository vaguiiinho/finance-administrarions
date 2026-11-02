import { userInitial } from '@/core/initial';

describe('inicial do usuario sem Intl.Segmenter', () => {
  it.each([
    ['  álvaro lima', 'Á'],
    ['ana', 'A'],
    ['', '?'],
  ])('%j -> %j', (n, i) => expect(userInitial(n)).toBe(i));
});
