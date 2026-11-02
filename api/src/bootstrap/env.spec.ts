import { EnvError, loadEnv } from './env.js';

const BASE = { DATABASE_URL: 'postgresql://u:p@db:5432/x', SESSION_TOKEN_SECRET: 's'.repeat(48) };
const prod = (extra: Record<string, string | undefined>) => ({ ...BASE, NODE_ENV: 'production', ...extra });

function failure(source: Record<string, string | undefined>): EnvError | null {
  try {
    loadEnv(source);
    return null;
  } catch (e) {
    return e as EnvError;
  }
}

describe('loadEnv: TRUST_PROXY em producao (ADR 0011 6.1, 6.4, CA31)', () => {
  it.each([
    ['ausente', undefined],
    ['true', 'true'],
    ['numero de saltos', '2'],
    ['uniquelocal', 'uniquelocal'],
    ['loopback', 'loopback'],
    ['padrao antigo', 'loopback, uniquelocal'],
    ['vazio', ''],
  ])('producao com TRUST_PROXY %s -> EnvError citando o NOME da variavel', (_l, value) => {
    const error = failure(prod({ TRUST_PROXY: value }));
    expect(error).toBeInstanceOf(EnvError);
    expect(error!.variables).toContain('TRUST_PROXY');
  });

  it('a mensagem nunca vaza o valor configurado', () => {
    const error = failure(prod({ TRUST_PROXY: 'uniquelocal' }));
    expect(error!.message).toContain('TRUST_PROXY');
    expect(error!.message).not.toContain('uniquelocal');
  });

  it.each(['172.30.0.10', '172.30.0.10/32', '10.0.0.5, 10.0.0.6'])('producao com IP explicito do nginx (%s) passa', (value) => {
    expect(loadEnv(prod({ TRUST_PROXY: value })).trustProxy).toBe(value);
  });

  it.each(['0.0.0.0/0', '::/0', '10.0.0.0/999', '10.0.0.0/8', '10.0.0.0/23', '10.0.0.0/33', 'fd00::/63', 'fd00::/129', '10.0.0.5, 0.0.0.0/0', '::ffff:0.0.0.0/96', '::ffff:10.0.0.0/104', '::ffff:10.0.0.0/120', '::ffff:a00:0/120', '::ffff:10.0.0.1'])(
    'I3: producao recusa prefixo amplo ou mascara fora da faixa (%s)',
    (value) => {
      expect(failure(prod({ TRUST_PROXY: value }))!.variables).toContain('TRUST_PROXY');
    },
  );

  it.each(['172.30.0.10', '172.30.0.0/24', '10.0.0.0/32', 'fd00::1', 'fd00::/64', 'fd00::/128'])('I3: producao aceita IP unico ou prefixo estreito (%s)', (value) => {
    expect(loadEnv(prod({ TRUST_PROXY: value })).trustProxy).toBe(value);
  });

  it('fora de producao o padrao continua valendo (desenvolvimento e testes)', () => {
    expect(loadEnv({ ...BASE }).trustProxy).toBe('loopback, uniquelocal');
    expect(loadEnv({ ...BASE, NODE_ENV: 'development' }).trustProxy).toBe('loopback, uniquelocal');
    expect(loadEnv({ ...BASE, NODE_ENV: 'test', TRUST_PROXY: 'true' }).trustProxy).toBe('true');
  });
});

describe('loadEnv: variaveis novas (ADR 0011 6.4)', () => {
  it('MOBILE_MIN_VERSION padrao 1.0.0; aceita semver; rejeita lixo', () => {
    expect(loadEnv({ ...BASE }).mobileMinVersion).toBe('1.0.0');
    expect(loadEnv({ ...BASE, MOBILE_MIN_VERSION: '1.4.2' }).mobileMinVersion).toBe('1.4.2');
    expect(failure({ ...BASE, MOBILE_MIN_VERSION: '1.4' })!.variables).toContain('MOBILE_MIN_VERSION');
  });

  it('MOBILE_STORE_URL: so https://', () => {
    expect(loadEnv({ ...BASE, MOBILE_STORE_URL: 'https://apps.apple.com/app/id1' }).mobileStoreUrl).toBe('https://apps.apple.com/app/id1');
    expect(loadEnv({ ...BASE }).mobileStoreUrl).toBeNull();
    expect(failure({ ...BASE, MOBILE_STORE_URL: 'http://apps.apple.com/x' })!.variables).toContain('MOBILE_STORE_URL');
  });

  it('S4: SHOWCASE_ACCOUNT_PASSWORD so com espacos conta como ausente (conta desligada)', () => {
    expect(loadEnv({ ...BASE, SHOWCASE_ACCOUNT_PASSWORD: '   ' }).showcaseAccountPassword).toBeNull();
    expect(loadEnv({ ...BASE, SHOWCASE_ACCOUNT_PASSWORD: '\t \n' }).showcaseAccountPassword).toBeNull();
    expect(loadEnv({ ...BASE, SHOWCASE_ACCOUNT_PASSWORD: ' a ' }).showcaseAccountPassword).toBe(' a ');
  });

  it('SHOWCASE_ACCOUNT_PASSWORD vazia/ausente = conta desligada (null); presente = valor; > 72 code points = EnvError sem o valor', () => {
    expect(loadEnv({ ...BASE }).showcaseAccountPassword).toBeNull();
    expect(loadEnv({ ...BASE, SHOWCASE_ACCOUNT_PASSWORD: '' }).showcaseAccountPassword).toBeNull();
    expect(loadEnv({ ...BASE, SHOWCASE_ACCOUNT_PASSWORD: 'demo' }).showcaseAccountPassword).toBe('demo');
    const error = failure({ ...BASE, SHOWCASE_ACCOUNT_PASSWORD: 'x'.repeat(73) });
    expect(error!.variables).toContain('SHOWCASE_ACCOUNT_PASSWORD');
    expect(error!.message).not.toContain('x'.repeat(10));
  });
});
