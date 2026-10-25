import { err, ok, type Result } from '@shared/domain/result.js';
import type { YearMonth } from '@shared/domain/value-objects/year-month.js';

export type DayOfMonthViolation = 'NOT_INTEGER' | 'OUT_OF_RANGE';

function validate(value: number): DayOfMonthViolation | null {
  if (!Number.isInteger(value)) return 'NOT_INTEGER';
  if (value < 1 || value > 31) return 'OUT_OF_RANGE';
  return null;
}

/** Dia do mês 1-31. Em meses mais curtos vale o último dia do mês (dia efetivo). */
export abstract class DayOfMonth {
  protected constructor(readonly value: number) {}

  /** Dia efetivo = min(value, último dia do mês). */
  effectiveIn(month: YearMonth): number {
    return Math.min(this.value, month.lengthInDays());
  }

  equals(other: DayOfMonth): boolean {
    return this.value === other.value;
  }
}

export class ClosingDay extends DayOfMonth {
  private readonly kind = 'ClosingDay';

  static create(value: number): Result<ClosingDay, DayOfMonthViolation> {
    const violation = validate(value);
    return violation ? err(violation) : ok(new ClosingDay(value));
  }
}

export class DueDay extends DayOfMonth {
  private readonly kind = 'DueDay';

  static create(value: number): Result<DueDay, DayOfMonthViolation> {
    const violation = validate(value);
    return violation ? err(violation) : ok(new DueDay(value));
  }
}
