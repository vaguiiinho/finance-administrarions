import type { ClientDescriptor } from '../../../domain/client/client-descriptor.js';
import { MinimumAppVersionPolicy } from '../../../domain/client/minimum-app-version.policy.js';
import type { ClientCompatibilityConfig } from '../../ports/client-compatibility-config.js';

export class CheckClientCompatibility {
  constructor(private readonly config: ClientCompatibilityConfig) {}

  execute(input: { client: ClientDescriptor }): void {
    MinimumAppVersionPolicy.assertSupported(input.client, this.config.minimumMobileVersion, this.config.mobileStoreUrl);
  }
}
