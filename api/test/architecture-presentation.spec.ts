import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, resolve } from 'node:path';

const SRC = resolve(process.cwd(), 'src');
const walk = (dir: string): string[] =>
  readdirSync(dir).flatMap((name) => {
    const full = join(dir, name);
    return statSync(full).isDirectory() ? walk(full) : [full];
  });

describe('regras de arquitetura: presentation nao depende de infrastructure', () => {
  it('nenhum arquivo de presentation importa infrastructure', () => {
    const offenders = walk(SRC)
      .filter((f) => f.includes('/presentation/') && f.endsWith('.ts') && !/\.(spec|int-spec|e2e-spec)\.ts$/.test(f))
      .filter((f) =>
        [...readFileSync(f, 'utf8').matchAll(/(?:from|import)\s*\(?\s*['"]([^'"]+)['"]/g)].some((m) => /\/infrastructure\//.test(m[1]!)),
      )
      .map((f) => f.replace(SRC, 'src'));
    expect(offenders).toEqual([]);
  });
});
