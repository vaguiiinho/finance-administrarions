import { err, ok, type Result } from '@shared/domain/result.js';
import { AppVersion } from './app-version.js';
import type { ClientKind } from './client-kind.js';

export interface ClientDescriptor {
  readonly kind: ClientKind;
  readonly appVersion: AppVersion | null;
}

const MOBILE_PREFIX = 'mobile/';

/** Ausente => WEB; `mobile/<semver>` => MOBILE; qualquer outra coisa => INVALID_FORMAT. */
export function parseClientHeader(raw: string | undefined): Result<ClientDescriptor, 'INVALID_FORMAT'> {
  if (raw === undefined) return ok({ kind: 'WEB', appVersion: null });
  if (!raw.startsWith(MOBILE_PREFIX)) return err('INVALID_FORMAT');
  const version = AppVersion.create(raw.slice(MOBILE_PREFIX.length));
  if (!version.ok) return err('INVALID_FORMAT');
  return ok({ kind: 'MOBILE', appVersion: version.value });
}
