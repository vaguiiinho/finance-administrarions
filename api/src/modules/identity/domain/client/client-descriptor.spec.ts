import { unwrap, violationOf } from '@test/support/result.js';
import { AppVersion } from './app-version.js';
import { parseClientHeader } from './client-descriptor.js';

const parseVersion = (raw: string) => AppVersion.create(raw);

describe('parseClientHeader (ADR 0011 3.1)', () => {
  it('cabecalho ausente -> WEB sem versao', () => {
    const c = unwrap(parseClientHeader(undefined));
    expect(c.kind).toBe('WEB');
    expect(c.appVersion).toBeNull();
  });

  it('mobile/<semver> -> MOBILE com a versao', () => {
    const c = unwrap(parseClientHeader('mobile/1.2.3'));
    expect(c.kind).toBe('MOBILE');
    expect(c.appVersion?.compare(unwrap(parseVersion('1.2.3')))).toBe(0);
  });

  it.each(['', 'mobile', 'mobile/', 'mobile/1.2', 'mobile/abc', 'android/1.0.0', 'Mobile/1.0.0', 'lixo', 'mobile/1.0.0 extra', 'web/1.0.0'])(
    'formato invalido %j -> INVALID_FORMAT',
    (raw) => {
      expect(violationOf(parseClientHeader(raw))).toBe('INVALID_FORMAT');
    },
  );
});
