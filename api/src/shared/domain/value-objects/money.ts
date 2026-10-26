import { err, ok, type Result } from '../result.js';

export type MoneyViolation = 'INVALID_FORMAT' | 'TOO_MANY_DECIMALS' | 'MUST_BE_POSITIVE' | 'TOO_LARGE';

const FORMAT = /^(-?)(\d+)(?:\.(\d+))?$/;
const MAX_ENTRY_CENTS = 999_999_999_999n;

/** Valor monetário em centavos (BigInt), com sinal. Nunca passa por `Number`. */
export class Money {
  static readonly ZERO = new Money(0n);
  static readonly MAX_ENTRY_AMOUNT = new Money(MAX_ENTRY_CENTS);

  private constructor(private readonly cents: bigint) {}

  static parse(value: string): Result<Money, MoneyViolation> {
    const match = FORMAT.exec(value);
    if (!match) return err('INVALID_FORMAT');
    const [, sign, integer, fraction = ''] = match;
    if (fraction.length > 2) return err('TOO_MANY_DECIMALS');
    const cents = BigInt(integer!) * 100n + BigInt(fraction.padEnd(2, '0'));
    return ok(new Money(sign === '-' ? -cents : cents));
  }

  /** Valor de lançamento: > 0 e <= 9999999999.99. */
  static parseEntryAmount(value: string): Result<Money, MoneyViolation> {
    const parsed = Money.parse(value);
    if (!parsed.ok) return parsed;
    if (parsed.value.cents <= 0n) return err('MUST_BE_POSITIVE');
    if (parsed.value.cents > MAX_ENTRY_CENTS) return err('TOO_LARGE');
    return parsed;
  }

  static fromCents(cents: bigint): Money {
    return new Money(cents);
  }

  static sum(values: readonly Money[]): Money {
    return new Money(values.reduce((acc, m) => acc + m.cents, 0n));
  }

  add(other: Money): Money {
    return new Money(this.cents + other.cents);
  }

  subtract(other: Money): Money {
    return new Money(this.cents - other.cents);
  }

  negate(): Money {
    return new Money(-this.cents);
  }

  sign(): -1 | 0 | 1 {
    return this.cents < 0n ? -1 : this.cents > 0n ? 1 : 0;
  }

  isZero(): boolean {
    return this.cents === 0n;
  }

  isNegative(): boolean {
    return this.cents < 0n;
  }

  compare(other: Money): -1 | 0 | 1 {
    return this.cents < other.cents ? -1 : this.cents > other.cents ? 1 : 0;
  }

  equals(other: Money): boolean {
    return this.cents === other.cents;
  }

  toCents(): bigint {
    return this.cents;
  }

  toString(): string {
    const negative = this.cents < 0n;
    const abs = negative ? -this.cents : this.cents;
    const integer = abs / 100n;
    const fraction = (abs % 100n).toString().padStart(2, '0');
    return `${negative ? '-' : ''}${integer}.${fraction}`;
  }
}
