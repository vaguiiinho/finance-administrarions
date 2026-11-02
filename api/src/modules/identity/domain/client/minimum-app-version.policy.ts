import { AppUpdateRequiredError } from './app-update-required.error.js';
import type { AppVersion } from './app-version.js';
import type { ClientDescriptor } from './client-descriptor.js';

export const MinimumAppVersionPolicy = {
  /** WEB sempre compatível. MOBILE abaixo de `minimum` => AppUpdateRequiredError. */
  assertSupported(client: ClientDescriptor, minimum: AppVersion, storeUrl: string | null): void {
    if (client.kind !== 'MOBILE' || client.appVersion === null) return;
    if (client.appVersion.compare(minimum) < 0) throw new AppUpdateRequiredError(minimum.toString(), storeUrl);
  },
};
