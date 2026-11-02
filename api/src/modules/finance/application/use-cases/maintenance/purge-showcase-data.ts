import type { Clock } from '@shared/application/ports/clock.js';
import type { DailyTimeCalculator } from '@shared/application/ports/daily-time-calculator.js';
import { InvariantViolationError } from '@shared/domain/app-error.js';
import type { LocalTimeOfDay } from '@shared/domain/time/local-time-of-day.js';
import { OwnerId } from '../../../domain/owner/owner-id.js';
import type { ShowcaseDataPurger } from '../../ports/showcase-data-purger.js';

/**
 * Limpeza diária da conta de demonstração (B7, B9): apaga lançamentos e cartões criados antes do último `purgeAt`
 * de São Paulo. O dono vem do composition root; finance não conhece o conceito de conta de demonstração.
 */
export class PurgeShowcaseData {
  constructor(
    private readonly purger: ShowcaseDataPurger,
    private readonly clock: Clock,
    private readonly dailyTime: DailyTimeCalculator,
    private readonly purgeAt: LocalTimeOfDay,
  ) {}

  async execute(input: { ownerId: string }): Promise<{ entries: number; cards: number }> {
    const owner = OwnerId.create(input.ownerId);
    if (!owner.ok) throw new InvariantViolationError('PurgeShowcaseData recebeu um ownerId inválido.');
    const cutoff = this.dailyTime.lastOccurrence(this.clock.now(), this.purgeAt);
    return this.purger.purgeCreatedBefore(owner.value, cutoff);
  }
}
