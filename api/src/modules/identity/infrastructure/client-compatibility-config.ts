import type { ClientCompatibilityConfig } from '../application/ports/client-compatibility-config.js';
import { AppVersion } from '../domain/client/app-version.js';

export const DEFAULT_MOBILE_MIN_VERSION = '1.0.0';

/** Lê `MOBILE_MIN_VERSION` e `MOBILE_STORE_URL` (a validação de formato no boot é do `loadEnv`; aqui falha alto também). */
export function loadClientCompatibilityConfig(env: Record<string, string | undefined> = process.env): ClientCompatibilityConfig {
  const version = AppVersion.create(env.MOBILE_MIN_VERSION || DEFAULT_MOBILE_MIN_VERSION);
  if (!version.ok) throw new Error('MOBILE_MIN_VERSION inválida.');
  return { minimumMobileVersion: version.value, mobileStoreUrl: env.MOBILE_STORE_URL || null };
}
