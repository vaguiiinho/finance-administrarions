import { readFileSync } from 'node:fs';
import { join } from 'node:path';

// ADR 0011 11.3 / CA30: o binario de producao nao pode ter excecao de ATS.
describe('configuracao de build (CA30)', () => {
  const root = join(__dirname, '..', '..');

  function evalConfig(variant: string | undefined) {
    const prev = process.env.APP_VARIANT;
    if (variant === undefined) delete process.env.APP_VARIANT;
    else process.env.APP_VARIANT = variant;
    let cfg: { ios?: { infoPlist?: { NSAppTransportSecurity?: Record<string, unknown> } } };
    jest.isolateModules(() => {
      const mod = require('../../app.config') as { default: (c: { config: object }) => typeof cfg };
      cfg = mod.default({ config: {} });
    });
    if (prev === undefined) delete process.env.APP_VARIANT;
    else process.env.APP_VARIANT = prev;
    return cfg!;
  }

  it('APP_VARIANT=production: sem NSAllowsArbitraryLoads nem NSAllowsLocalNetworking', () => {
    const ats = evalConfig('production').ios?.infoPlist?.NSAppTransportSecurity ?? {};
    expect(ats.NSAllowsArbitraryLoads ?? false).toBe(false);
    expect(ats.NSAllowsLocalNetworking ?? false).toBe(false);
  });

  it('sem APP_VARIANT o padrao tambem e seguro', () => {
    const ats = evalConfig(undefined).ios?.infoPlist?.NSAppTransportSecurity ?? {};
    expect(ats.NSAllowsArbitraryLoads ?? false).toBe(false);
    expect(ats.NSAllowsLocalNetworking ?? false).toBe(false);
  });

  it('eas.json: perfil production usa APP_VARIANT=production e URLs https', () => {
    const eas = JSON.parse(readFileSync(join(root, 'eas.json'), 'utf8')) as { build: { production: { env: Record<string, string> } } };
    const env = eas.build.production.env;
    expect(env.APP_VARIANT).toBe('production');
    expect(env.EXPO_PUBLIC_API_URL).toMatch(/^https:\/\//);
    expect(env.EXPO_PUBLIC_WEB_URL).toMatch(/^https:\/\//);
  });
});
