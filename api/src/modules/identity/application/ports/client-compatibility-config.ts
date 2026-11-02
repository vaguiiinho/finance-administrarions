import type { AppVersion } from '../../domain/client/app-version.js';

export interface ClientCompatibilityConfig {
  minimumMobileVersion: AppVersion;
  mobileStoreUrl: string | null;
}
export const CLIENT_COMPATIBILITY_CONFIG = Symbol('CLIENT_COMPATIBILITY_CONFIG');
