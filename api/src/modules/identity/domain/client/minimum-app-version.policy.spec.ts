import { unwrap } from '@test/support/result.js';
import { AppVersion } from './app-version.js';
import { parseClientHeader } from './client-descriptor.js';
import { MinimumAppVersionPolicy } from './minimum-app-version.policy.js';

const client = (raw: string | undefined) => unwrap(parseClientHeader(raw));
const min = (raw: string) => unwrap<AppVersion>(AppVersion.create(raw));
const STORE = 'https://apps.apple.com/app/id123';

describe('MinimumAppVersionPolicy.assertSupported (ADR 0011 3.1, 3.7)', () => {
  it('WEB e sempre compativel, mesmo com minima alta', () => {
    expect(() => MinimumAppVersionPolicy.assertSupported(client(undefined), min('99.0.0'), STORE)).not.toThrow();
  });

  it.each(['1.2.0', '1.2.1', '1.10.0', '2.0.0'])('MOBILE %s (igual ou acima de 1.2.0) passa', (v) => {
    expect(() => MinimumAppVersionPolicy.assertSupported(client(`mobile/${v}`), min('1.2.0'), STORE)).not.toThrow();
  });

  it.each(['1.1.9', '1.0.0', '0.9.9'])('MOBILE %s abaixo de 1.2.0 -> APP_UPDATE_REQUIRED (426) com minimumVersion e storeUrl', (v) => {
    let error: any;
    try {
      MinimumAppVersionPolicy.assertSupported(client(`mobile/${v}`), min('1.2.0'), STORE);
    } catch (e) {
      error = e;
    }
    expect(error).toMatchObject({
      code: 'APP_UPDATE_REQUIRED',
      kind: 'upgrade_required',
      message: 'Atualize o aplicativo para continuar.',
      details: { minimumVersion: '1.2.0', storeUrl: STORE },
    });
  });

  it('storeUrl nulo e repassado como null', () => {
    expect(() => MinimumAppVersionPolicy.assertSupported(client('mobile/1.0.0'), min('1.2.0'), null)).toThrowError(
      expect.objectContaining({ details: { minimumVersion: '1.2.0', storeUrl: null } }),
    );
  });

  it('1.9.0 esta abaixo de 1.10.0 (comparacao numerica)', () => {
    expect(() => MinimumAppVersionPolicy.assertSupported(client('mobile/1.9.0'), min('1.10.0'), null)).toThrow();
  });
});
