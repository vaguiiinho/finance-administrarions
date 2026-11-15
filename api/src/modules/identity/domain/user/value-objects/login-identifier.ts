import { err, ok, type Result } from '@shared/domain/result.js';
import { ShowcaseAccount } from '../showcase-account.js';
import { EmailAddress } from './email-address.js';

/**
 * O que a pessoa digita no primeiro campo do login: um e-mail ou o alias da conta demo (ADR 0013 3.1, B1).
 * Mesma normalização do e-mail (trim + minúsculas). O alias resolve SÓ para o e-mail canônico da conta demo e vale só no
 * login; o VO não consulta repositório nem o estado da conta (conta inativa ou ausente cai em INVALID_CREDENTIALS).
 */
export class LoginIdentifier {
  private constructor(
    /** Sempre o e-mail canônico. */
    readonly email: EmailAddress,
    /** Só para auditoria; nunca muda a resposta. */
    readonly viaAlias: boolean,
  ) {}

  static parse(raw: string): Result<LoginIdentifier, 'REQUIRED' | 'INVALID_FORMAT' | 'TOO_LONG'> {
    if (LoginIdentifier.normalize(raw) === ShowcaseAccount.loginAlias) {
      const canonical = EmailAddress.create(ShowcaseAccount.email);
      if (!canonical.ok) return err('INVALID_FORMAT');
      return ok(new LoginIdentifier(canonical.value, true));
    }
    const email = EmailAddress.create(raw);
    if (!email.ok) return err(email.error);
    return ok(new LoginIdentifier(email.value, false));
  }

  /** Texto normalizado (trim + minúsculas): base da chave do limite quando o formato é inválido. */
  static normalize(raw: string): string {
    return (typeof raw === 'string' ? raw : '').trim().toLowerCase();
  }
}
