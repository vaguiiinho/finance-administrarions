import { readdirSync, readFileSync, statSync, existsSync } from 'node:fs';
import { join, resolve, relative } from 'node:path';

/**
 * Regras estruturais da remocao da demonstracao publica (ADR 0013 11.4; RF01, RF04, RF17, CA05, CA25, T3, T4).
 * Verificam que o vocabulario e as rotas antigas nao existem mais em `src` e que o desenho novo esta onde o ADR manda.
 */
const ROOT = process.cwd();
const SRC = resolve(ROOT, 'src');
const walk = (dir: string): string[] =>
  readdirSync(dir).flatMap((f) => {
    const p = join(dir, f);
    if (p.includes(`${join('shared', 'infrastructure', 'prisma', 'generated')}`)) return [];
    return statSync(p).isDirectory() ? walk(p) : p.endsWith('.ts') ? [p] : [];
  });
const isTest = (f: string) => /\.(spec|int-spec|e2e-spec)\.ts$/.test(f);
const production = () => walk(SRC).filter((f) => !isTest(f));
const rel = (f: string) => relative(ROOT, f);
const read = (rel_: string) => readFileSync(resolve(ROOT, rel_), 'utf8');

describe('vocabulario removido (T4, S2, S4, RF04)', () => {
  it.each([
    'DEMO_USER_ID',
    'DemoController',
    "@Controller('demo')",
    '/api/demo',
    'buildDemoDataset',
    'DEMO_TEMPLATE_VERSION',
    'RefreshDemoDataset',
    'DemoDatasetStore',
    'EnsureDemoUser',
    'PurgeShowcaseData',
    'ShowcaseDataPurger',
    'SHOWCASE_DATA_PURGER',
    'User.demo',
  ])('nenhum arquivo de producao em src menciona %s', (symbol) => {
    const offenders = production().filter((f) => readFileSync(f, 'utf8').includes(symbol)).map(rel);
    expect(offenders).toEqual([]);
  });

  it('nenhum arquivo de producao em src define deleteAllOf (palavra inteira; deleteAllOfUser das sessoes fica)', () => {
    const offenders = production().filter((f) => /\bdeleteAllOf\b/.test(readFileSync(f, 'utf8'))).map(rel);
    expect(offenders).toEqual([]);
  });

  it('nenhum arquivo de producao em src trata o kind DEMO (so o enum gerado do Prisma o conhece)', () => {
    const offenders = production().filter((f) => /['"]DEMO['"]/.test(readFileSync(f, 'utf8'))).map(rel);
    expect(offenders).toEqual([]);
  });

  it('o controller e os arquivos da demonstracao publica nao existem', () => {
    for (const file of [
      'src/modules/finance/presentation/http/demo.controller.ts',
      'src/modules/finance/application/demo',
      'src/modules/finance/infrastructure/demo',
      'src/modules/identity/application/use-cases/bootstrap/ensure-demo-user.ts',
      'src/modules/finance/application/use-cases/maintenance/purge-showcase-data.ts',
      'src/modules/finance/application/ports/showcase-data-purger.ts',
    ]) {
      expect(existsSync(resolve(ROOT, file)), file).toBe(false);
    }
  });

  it('o schema Prisma nao tem mais o model DemoDataset e tem OwnerDataReset', () => {
    const schema = read('prisma/schema.prisma');
    expect(schema).not.toMatch(/model\s+DemoDataset/);
    expect(schema).toMatch(/model\s+OwnerDataReset/);
  });
});

describe('alias de login (T3, ADR 3.1)', () => {
  it('`loginAlias` so e definido em showcase-account.ts e lido em login-identifier.ts', () => {
    const offenders = production()
      .filter((f) => /\bloginAlias\b/.test(readFileSync(f, 'utf8')))
      .map(rel)
      .filter((f) => !f.endsWith('showcase-account.ts') && !f.endsWith('login-identifier.ts'));
    expect(offenders).toEqual([]);
  });

  it('o VO LoginIdentifier existe no domain do identity e nao importa Nest, Prisma nem node:crypto', () => {
    const file = resolve(SRC, 'modules/identity/domain/user/value-objects/login-identifier.ts');
    expect(existsSync(file)).toBe(true);
    expect(readFileSync(file, 'utf8')).not.toMatch(/from '(@nestjs|@prisma|node:crypto)/);
  });

  it('LoginWithPassword usa LoginIdentifier (uma so normalizacao, S7) e nao normaliza o identificador por conta propria', () => {
    const source = read('src/modules/identity/application/use-cases/auth/login-with-password.ts');
    expect(source).toContain('LoginIdentifier');
    expect(source).not.toMatch(/rawEmail\.trim\(\)\.toLowerCase\(\)/);
  });
});

describe('composicao: seed, agendador e script manual (RF04, RF17, CA05, CA25)', () => {
  it('run-seed.ts: sem usuario da demonstracao publica; usa GetShowcaseAccountState e ResetOwnerData com sample-stale', () => {
    const seed = read('src/bootstrap/seed/run-seed.ts');
    expect(seed).not.toMatch(/EnsureDemoUser|RefreshDemoDataset|DEMO_USER_ID/);
    expect(seed).toContain('GetShowcaseAccountState');
    expect(seed).toContain('ResetOwnerData');
    expect(seed).toContain('EnsureShowcaseAccount');
  });

  it('app.module.ts: sem ensure-demo-user, refresh-demo-dataset e purge-showcase-data; com reset-demo-account', () => {
    const module = read('src/app.module.ts');
    expect(module).not.toMatch(/ensure-demo-user|refresh-demo-dataset|purge-showcase-data/);
    expect(module).toContain('DemoAccountResetRoutine');
  });

  it('a rotina vive na raiz de composicao (bootstrap/demo-account) e o finance nao importa o identity (RNF01)', () => {
    expect(existsSync(resolve(SRC, 'bootstrap/demo-account/demo-account-reset.routine.ts'))).toBe(true);
    const offenders = production()
      .filter((f) => f.includes(`${join('modules', 'finance')}/`))
      .filter((f) => /from ['"][^'"]*(modules\/identity|@identity\/)/.test(readFileSync(f, 'utf8')))
      .map(rel);
    expect(offenders).toEqual([]);
  });

  it('finance nao conhece o conceito de conta demo/showcase fora de comentarios e nomes neutros (S2)', () => {
    const offenders = production()
      .filter((f) => f.includes(`${join('modules', 'finance')}/`))
      .filter((f) => /\b(ShowcaseAccount|SHOWCASE_USER_ID|showcase-data|ShowcaseData)\b/.test(readFileSync(f, 'utf8')))
      .map(rel);
    expect(offenders).toEqual([]);
  });

  it('script manual: existe, no padrao do recover-admin (sem start() do agendador, sem HTTP) e roda com origem manual', () => {
    const file = 'src/bootstrap/scripts/reset-demo-account.ts';
    expect(existsSync(resolve(ROOT, file))).toBe(true);
    const source = read(file);
    expect(source).toContain('createApplicationContext');
    expect(source).toContain("'manual'");
    expect(source).not.toMatch(/MaintenanceScheduler|\.start\(\)|listen\(|createNestApplication/);
  });

  it('package.json expoe `npm run demo:reset` apontando para o script compilado', () => {
    const pkg = JSON.parse(read('package.json')) as { scripts: Record<string, string> };
    expect(pkg.scripts['demo:reset'] ?? '').toMatch(/dist\/bootstrap\/scripts\/reset-demo-account\.js/);
  });

  it('nenhum controller/rota de manutencao: nada em presentation menciona reset-demo-account ou DemoAccountResetRoutine', () => {
    const offenders = production()
      .filter((f) => f.includes(`${join('presentation')}/`))
      .filter((f) => /reset-demo-account|DemoAccountResetRoutine|ResetOwnerData/.test(readFileSync(f, 'utf8')))
      .map(rel);
    expect(offenders).toEqual([]);
  });

  it('o port OwnerDataResetStore e o use case ResetOwnerData existem no finance (application) sem importar Prisma', () => {
    const port = resolve(SRC, 'modules/finance/application/ports/owner-data-reset-store.ts');
    const useCase = resolve(SRC, 'modules/finance/application/use-cases/maintenance/reset-owner-data.ts');
    expect(existsSync(port)).toBe(true);
    expect(existsSync(useCase)).toBe(true);
    for (const f of [port, useCase]) expect(readFileSync(f, 'utf8')).not.toMatch(/prisma|@nestjs/i);
  });
});
