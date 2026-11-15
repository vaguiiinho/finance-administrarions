import { unwrapPersisted } from '@shared/domain/unwrap.js';
import { ShowcaseAccount } from '../../../domain/user/showcase-account.js';
import type { UserRepository } from '../../../domain/user/user.repository.js';
import { UserId } from '../../../domain/user/value-objects/user-id.js';

export type ShowcaseAccountState = 'active' | 'inactive' | 'absent';

/**
 * Estado da conta demo (ADR 0013 5.3): consulta pura usada pelo seed e pela rotina da conta demo.
 * Um usuário de outro `kind` no id reservado nunca é tratado como conta demo (`absent`).
 */
export class GetShowcaseAccountState {
  constructor(private readonly users: UserRepository) {}

  async execute(_input: Record<string, never>): Promise<{ state: ShowcaseAccountState }> {
    const id = unwrapPersisted(UserId.create(ShowcaseAccount.id), 'SHOWCASE_USER_ID');
    const user = await this.users.findById(id);
    if (!user || user.kind !== 'SHOWCASE') return { state: 'absent' };
    return { state: user.status === 'ACTIVE' ? 'active' : 'inactive' };
  }
}
