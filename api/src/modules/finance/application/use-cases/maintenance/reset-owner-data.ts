import type { BusinessCalendar } from '@shared/application/ports/business-calendar.js';
import type { Clock } from '@shared/application/ports/clock.js';
import type { IdGenerator } from '@shared/application/ports/id-generator.js';
import { requireOwnerId } from '../../queries/owner.js';
import type { OwnerDataResetStore, ResetCondition, SampleRequest } from '../../ports/owner-data-reset-store.js';
import { buildSampleDataset, SAMPLE_DATASET_VERSION } from '../../sample-dataset/sample-dataset.js';

export interface ResetOwnerDataInput {
  ownerId: string;
  /** true: grava o dataset de exemplo ancorado no mês corrente de negócio depois de apagar. */
  withSample: boolean;
  condition: ResetCondition;
}

export type ResetOwnerDataResult =
  | { status: 'skipped' }
  | {
      status: 'reset';
      deleted: { entries: number; cards: number };
      restored: { entries: number; cards: number };
      /** AAAA-MM do dataset gravado; null quando só apagou. */
      anchor: string | null;
    };

/**
 * Redefine os dados de um dono (ADR 0013 5.4): apaga lançamentos e cartões e, opcionalmente, restaura o dataset de
 * exemplo. O dono vem da raiz de composição; o finance não conhece o conceito de conta demo.
 */
export class ResetOwnerData {
  constructor(
    private readonly store: OwnerDataResetStore,
    private readonly calendar: BusinessCalendar,
    private readonly ids: IdGenerator,
    private readonly clock: Clock,
  ) {}

  async execute(input: ResetOwnerDataInput): Promise<ResetOwnerDataResult> {
    const ownerId = requireOwnerId(input.ownerId);
    const now = this.clock.now();
    const anchor = this.calendar.currentMonth();
    const sample: SampleRequest | null = input.withSample
      ? {
          anchor,
          version: SAMPLE_DATASET_VERSION,
          build: () => buildSampleDataset({ ownerId, anchor, ids: this.ids, now }),
        }
      : null;
    const outcome = await this.store.reset(ownerId, { sample, condition: input.condition, at: now });
    if (outcome.status === 'skipped') return outcome;
    return { ...outcome, anchor: sample ? anchor.toString() : null };
  }
}
