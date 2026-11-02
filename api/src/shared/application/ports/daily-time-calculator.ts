import type { LocalTimeOfDay } from '../../domain/time/local-time-of-day.js';

/** Horário civil de America/Sao_Paulo. Implementação com Intl em shared/infrastructure. */
export interface DailyTimeCalculator {
  /** Último instante <= now em que o relógio de São Paulo marcou `at`. */
  lastOccurrence(now: Date, at: LocalTimeOfDay): Date;
  /** Primeiro instante > now em que o relógio de São Paulo marca `at`. */
  nextOccurrence(now: Date, at: LocalTimeOfDay): Date;
}
export const DAILY_TIME_CALCULATOR = Symbol('DAILY_TIME_CALCULATOR');
