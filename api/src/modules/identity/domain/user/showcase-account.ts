import { SHOWCASE_USER_ID } from '@shared/domain/well-known-ids.js';

/** Conta de demonstração do app (ADR 0011 3.3). O e-mail é o que a pessoa digita no login (TLD reservado). */
export const ShowcaseAccount = {
  id: SHOWCASE_USER_ID,
  email: 'demo@showcase.invalid',
  name: 'Conta de demonstração',
  /** Alias aceito só no login (ADR 0013 B1); resolve para `email`. Nunca persistido. */
  loginAlias: 'demo',
} as const;
