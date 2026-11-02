import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, resolve } from 'node:path';

const SRC = resolve(process.cwd(), 'src');
const walk = (dir: string): string[] =>
  readdirSync(dir).flatMap((f) => {
    const p = join(dir, f);
    return statSync(p).isDirectory() ? walk(p) : p.endsWith('.ts') ? [p] : [];
  });

describe('conta demo: a excecao de senha curta e exclusiva (ADR 0011 3.5, CA45)', () => {
  it('PlainPassword.forShowcaseAccount so e chamado por ensure-showcase-account.ts (e definido em plain-password.ts)', () => {
    const offenders = walk(SRC)
      .filter((f) => !f.endsWith('.spec.ts'))
      .filter((f) => !f.endsWith('ensure-showcase-account.ts') && !f.endsWith('plain-password.ts'))
      .filter((f) => readFileSync(f, 'utf8').includes('forShowcaseAccount'));
    expect(offenders).toEqual([]);
  });

  it('ensure-showcase-account.ts de fato usa o factory (a excecao existe e esta onde deve)', () => {
    const file = walk(SRC).find((f) => f.endsWith('ensure-showcase-account.ts'));
    expect(file, 'use case EnsureShowcaseAccount ainda nao existe').toBeDefined();
    expect(readFileSync(file!, 'utf8')).toContain('forShowcaseAccount');
  });

  it('o domain do identity nao importa NestJS nem Prisma (regressao para os arquivos novos)', () => {
    const bad = walk(join(SRC, 'modules', 'identity', 'domain')).filter((f) => /from '(@nestjs|@prisma|node:crypto)/.test(readFileSync(f, 'utf8')));
    expect(bad).toEqual([]);
  });
});
