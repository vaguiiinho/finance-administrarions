import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, resolve } from 'node:path';

const SRC = resolve(process.cwd(), 'src');

function walk(dir: string): string[] {
  try {
    return readdirSync(dir).flatMap((name) => {
      const full = join(dir, name);
      return statSync(full).isDirectory() ? walk(full) : [full];
    });
  } catch {
    return [];
  }
}

const sourceFiles = (layer: string) =>
  walk(SRC).filter((f) => f.includes(`/${layer}/`) && f.endsWith('.ts') && !/\.(spec|int-spec|e2e-spec)\.ts$/.test(f));

const importsOf = (file: string): string[] =>
  [...readFileSync(file, 'utf8').matchAll(/(?:from|import)\s*\(?\s*['"]([^'"]+)['"]/g)].map((m) => m[1]);

const FORBIDDEN_IN_DOMAIN = [/^@nestjs\//, /^@prisma\//, /^zod/, /^uuid/, /^pg$/, /^express/, /^rxjs/, /prisma/i];
const FORBIDDEN_IN_APPLICATION = [/^@nestjs\//, /^@prisma\//, /^zod/, /^pg$/, /^express/, /prisma/i, /\/infrastructure\//, /\/presentation\//];

describe('regras de arquitetura (CLAUDE.md): dependencias apontam para dentro', () => {
  it('existe codigo em domain/ e application/ para ser verificado', () => {
    expect(sourceFiles('domain').length).toBeGreaterThan(10);
    expect(sourceFiles('application').length).toBeGreaterThan(5);
  });

  it('domain nao importa NestJS, Prisma, zod, uuid nem nada externo', () => {
    const offenders = sourceFiles('domain').flatMap((file) =>
      importsOf(file)
        .filter((spec) => FORBIDDEN_IN_DOMAIN.some((re) => re.test(spec)) || /\/(application|infrastructure|presentation)\//.test(spec))
        .map((spec) => `${file.replace(SRC, 'src')} -> ${spec}`),
    );
    expect(offenders).toEqual([]);
  });

  it('domain so importa relativos ou node:* (nenhum pacote npm)', () => {
    const offenders = sourceFiles('domain').flatMap((file) =>
      importsOf(file)
        .filter((spec) => !spec.startsWith('.') && !spec.startsWith('node:') && !spec.startsWith('@shared/') && !spec.startsWith('@finance/'))
        .map((spec) => `${file.replace(SRC, 'src')} -> ${spec}`),
    );
    expect(offenders).toEqual([]);
  });

  it('application nao importa Nest, Prisma, infrastructure nem presentation', () => {
    const offenders = sourceFiles('application').flatMap((file) =>
      importsOf(file)
        .filter((spec) => FORBIDDEN_IN_APPLICATION.some((re) => re.test(spec)))
        .map((spec) => `${file.replace(SRC, 'src')} -> ${spec}`),
    );
    expect(offenders).toEqual([]);
  });

  it('Prisma so aparece em infrastructure', () => {
    const offenders = walk(SRC)
      .filter((f) => f.endsWith('.ts') && !/\.(spec|int-spec|e2e-spec)\.ts$/.test(f))
      .filter((f) => !f.includes('/infrastructure/') && !f.endsWith('app.module.ts') && !f.includes('/generated/'))
      .filter((f) => importsOf(f).some((spec) => /prisma/i.test(spec)))
      .map((f) => f.replace(SRC, 'src'));
    expect(offenders).toEqual([]);
  });
});
