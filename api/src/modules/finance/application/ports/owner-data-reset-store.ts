import type { YearMonth } from '@shared/domain/value-objects/year-month.js';
import type { OwnerId } from '../../domain/owner/owner-id.js';
import type { SampleDataset } from '../sample-dataset/sample-dataset.js';

export type ResetCondition =
  | { kind: 'always' } // execução manual
  | { kind: 'not-reset-since'; since: Date } // agendada e recuperação: só se last_reset_at < since (ou nunca)
  | { kind: 'sample-stale' }; // seed: sem registro, ou âncora/versão diferentes das pedidas

export interface SampleRequest {
  anchor: YearMonth;
  version: number;
  /** Chamado dentro da transação, ANTES dos DELETE. */
  build: () => SampleDataset;
}

export interface OwnerDataResetRequest {
  /** null = só apagar (conta inativa). */
  sample: SampleRequest | null;
  condition: ResetCondition;
  /** Vira last_reset_at (vem do Clock, nunca `new Date()` no adapter). */
  at: Date;
}

export type OwnerDataResetOutcome =
  | { status: 'skipped' }
  | {
      status: 'reset';
      deleted: { entries: number; cards: number };
      restored: { entries: number; cards: number };
    };

export interface OwnerDataResetStore {
  /**
   * Numa transação, sob lock por dono: avalia `condition` (falsa -> 'skipped' sem tocar em nada); apaga lançamentos e
   * depois cartões do dono; grava o dataset (cartões antes dos lançamentos); registra o controle da redefinição.
   * Qualquer erro -> rollback completo. 'sample-stale' exige `sample` (senão InvariantViolationError).
   */
  reset(ownerId: OwnerId, request: OwnerDataResetRequest): Promise<OwnerDataResetOutcome>;
}
export const OWNER_DATA_RESET_STORE = Symbol('OWNER_DATA_RESET_STORE');
