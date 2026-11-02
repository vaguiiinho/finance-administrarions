import { err, ok, type Result } from '../result.js';

const PATTERN = /^([01]\d|2[0-3]):([0-5]\d)$/;

/** Horário civil "HH:MM" (00:00-23:59), sem fuso: o fuso é decidido por quem o interpreta. */
export class LocalTimeOfDay {
  private constructor(
    readonly hour: number,
    readonly minute: number,
  ) {}

  static parse(raw: string): Result<LocalTimeOfDay, 'INVALID_FORMAT'> {
    const m = typeof raw === 'string' ? PATTERN.exec(raw) : null;
    if (!m) return err('INVALID_FORMAT');
    return ok(new LocalTimeOfDay(Number(m[1]), Number(m[2])));
  }
}
