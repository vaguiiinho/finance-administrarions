import { unwrap } from './result.js';
import { buildIdentityHarness } from './identity-harness.js';
import { parseClientHeader } from '@identity/domain/client/client-descriptor.js';
import { EnsureShowcaseAccount } from '@identity/application/use-cases/bootstrap/ensure-showcase-account.js';
import { NOW } from './builders.js';

/**
 * Harness do identity + EnsureShowcaseAccount.
 * CONTRATO ASSUMIDO (ADR 0011 5.3): `new EnsureShowcaseAccount(uow, hasher, clock, publisher)` e `execute({ password })`.
 * Ajuste APENAS este arquivo se o construtor diferir.
 */
export function buildShowcaseHarness(now: Date = NOW) {
  const h = buildIdentityHarness(now);
  return { ...h, ensureShowcase: new EnsureShowcaseAccount(h.uow, h.hasher, h.clock, h.publisher) };
}
export type ShowcaseHarness = ReturnType<typeof buildShowcaseHarness>;

export const webClient = () => unwrap(parseClientHeader(undefined));
export const mobileClient = (version = '1.2.3') => unwrap(parseClientHeader(`mobile/${version}`));
