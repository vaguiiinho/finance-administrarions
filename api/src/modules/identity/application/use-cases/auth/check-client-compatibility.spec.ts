import { unwrap } from '@test/support/result.js';
import { AppVersion } from '../../../domain/client/app-version.js';
import { parseClientHeader } from '../../../domain/client/client-descriptor.js';
import { CheckClientCompatibility } from './check-client-compatibility.js';

const useCase = (minimum = '1.2.0', storeUrl: string | null = 'https://apps.apple.com/app/id1') =>
  new CheckClientCompatibility({ minimumMobileVersion: unwrap<AppVersion>(AppVersion.create(minimum)), mobileStoreUrl: storeUrl });
const client = (raw?: string) => unwrap(parseClientHeader(raw));

describe('CheckClientCompatibility (ADR 0011 5.3)', () => {
  it('WEB passa sempre', () => {
    expect(() => useCase('9.0.0').execute({ client: client() })).not.toThrow();
  });
  it('MOBILE na versao minima passa', () => {
    expect(() => useCase().execute({ client: client('mobile/1.2.0') })).not.toThrow();
  });
  it('MOBILE abaixo da minima -> APP_UPDATE_REQUIRED com a config injetada', () => {
    expect(() => useCase().execute({ client: client('mobile/1.1.0') })).toThrowError(
      expect.objectContaining({
        code: 'APP_UPDATE_REQUIRED',
        details: { minimumVersion: '1.2.0', storeUrl: 'https://apps.apple.com/app/id1' },
      }),
    );
  });
});
