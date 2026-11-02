import type { OwnerId } from '../../domain/owner/owner-id.js';

export interface ShowcaseDataPurger {
  /**
   * Numa transação: (1) apaga os lançamentos do dono com created_at < before; (2) apaga os cartões do dono com
   * created_at < before que não tenham mais lançamentos (FK entries.card_id é RESTRICT). Devolve as contagens.
   */
  purgeCreatedBefore(ownerId: OwnerId, before: Date): Promise<{ entries: number; cards: number }>;
}
export const SHOWCASE_DATA_PURGER = Symbol('SHOWCASE_DATA_PURGER');
