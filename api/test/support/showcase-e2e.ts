import { randomBytes } from 'node:crypto';
import { startIdentityE2e, type IdentityE2e } from './identity-e2e.js';
import { EnsureShowcaseAccount } from '@identity/application/use-cases/bootstrap/ensure-showcase-account.js';

export const SHOWCASE_E2E_EMAIL = 'demo@showcase.invalid';
/** ADR 0011 11.1: a senha dos testes e2e e GERADA (4 caracteres: prova que a senha curta so entra por este caminho). */
export const SHOWCASE_E2E_PASSWORD = randomBytes(2).toString('hex');

export interface ShowcaseE2e extends IdentityE2e {
  /** Provisiona a conta pelo MESMO use case do seed (`EnsureShowcaseAccount`), como em producao. */
  provision: (password?: string | null) => Promise<{ status: string }>;
}

export async function startShowcaseE2e(overrides?: { token: unknown; value: unknown }[], now?: Date): Promise<ShowcaseE2e> {
  const base = (await startIdentityE2e()) as IdentityE2e;
  void overrides;
  void now;
  const useCase = base.app.get(EnsureShowcaseAccount);
  return {
    ...base,
    provision: (password = SHOWCASE_E2E_PASSWORD) => useCase.execute({ password }),
  };
}

export const loginBody = (email: string, password: string) => ({ email, password });
