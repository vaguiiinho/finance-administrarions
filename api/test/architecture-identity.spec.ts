import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, resolve } from 'node:path';

const SRC = resolve(process.cwd(), 'src');
const walk = (dir: string): string[] => {
  try {
    return readdirSync(dir).flatMap((n) => {
      const f = join(dir, n);
      return statSync(f).isDirectory() ? walk(f) : [f];
    });
  } catch {
    return [];
  }
};
const prod = (root: string) => walk(join(SRC, root)).filter((f) => f.endsWith('.ts') && !/\.(spec|int-spec|e2e-spec)\.ts$/.test(f));
const importsOf = (file: string) => [...readFileSync(file, 'utf8').matchAll(/(?:from|import)\s*\(?\s*['"]([^'"]+)['"]/g)].map((m) => m[1]);
const rel = (f: string) => f.replace(SRC, 'src');

describe('arquitetura do contexto identity (ADR 0005 10, RNF11)', () => {
  it('existe codigo em identity/domain e identity/application', () => {
    expect(prod('modules/identity/domain').length).toBeGreaterThan(10);
    expect(prod('modules/identity/application').length).toBeGreaterThan(10);
  });

  it('finance nao importa identity e identity nao importa finance', () => {
    const offenders = [
      ...prod('modules/finance').flatMap((f) => importsOf(f).filter((s) => /identity/.test(s)).map((s) => `${rel(f)} -> ${s}`)),
      ...prod('modules/identity').flatMap((f) => importsOf(f).filter((s) => /finance/.test(s)).map((s) => `${rel(f)} -> ${s}`)),
    ];
    expect(offenders).toEqual([]);
  });

  it('identity/domain nao importa nada externo (argon2, node:crypto, Nest, Prisma)', () => {
    const offenders = prod('modules/identity/domain').flatMap((f) =>
      importsOf(f)
        .filter((s) => /argon2|^node:crypto$|^crypto$|^@nestjs|prisma|^zod|^uuid/.test(s) || /\/(application|infrastructure|presentation)\//.test(s))
        .map((s) => `${rel(f)} -> ${s}`),
    );
    expect(offenders).toEqual([]);
  });

  it('identity/application nao importa infrastructure nem presentation', () => {
    const offenders = prod('modules/identity/application').flatMap((f) =>
      importsOf(f).filter((s) => /\/(infrastructure|presentation)\//.test(s) || /^@nestjs|prisma/.test(s)).map((s) => `${rel(f)} -> ${s}`),
    );
    expect(offenders).toEqual([]);
  });

  it('RNF06: nenhuma query de identity/infrastructure referencia as tabelas financeiras', () => {
    const offenders = prod('modules/identity/infrastructure').filter((f) =>
      /\b(cards|entries|prisma\.(card|entry)\b|\.card\.|\.entry\.)/.test(readFileSync(f, 'utf8').replace(/\/\*[\s\S]*?\*\/|\/\/.*$/gm, '')),
    );
    expect(offenders.map(rel)).toEqual([]);
  });

  it('so bootstrap/, main.ts e app.module.ts conhecem os dois modulos', () => {
    const bothKnown = walk(SRC)
      .filter((f) => f.endsWith('.ts') && !/\.(spec|int-spec|e2e-spec)\.ts$/.test(f))
      .filter((f) => {
        const imps = importsOf(f);
        return imps.some((s) => /modules\/identity|@identity\//.test(s)) && imps.some((s) => /modules\/finance|@finance\//.test(s));
      })
      .map(rel);
    for (const f of bothKnown) expect(f).toMatch(/^src\/(bootstrap\/|main\.ts|app\.module\.ts)/);
  });
});
