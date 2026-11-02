import { err, ok, type Result } from '@shared/domain/result.js';

const PATTERN = /^(\d{1,4})\.(\d{1,4})\.(\d{1,4})$/;

/** Versão semver simplificada `MAJOR.MINOR.PATCH` (ADR 0011 3.1). */
export class AppVersion {
  private constructor(private readonly parts: readonly [number, number, number]) {}

  static create(raw: string): Result<AppVersion, 'INVALID_FORMAT'> {
    const m = typeof raw === 'string' ? PATTERN.exec(raw) : null;
    if (!m) return err('INVALID_FORMAT');
    return ok(new AppVersion([Number(m[1]), Number(m[2]), Number(m[3])]));
  }

  compare(other: AppVersion): -1 | 0 | 1 {
    for (let i = 0; i < 3; i++) {
      const a = this.parts[i]!;
      const b = other.parts[i]!;
      if (a !== b) return a < b ? -1 : 1;
    }
    return 0;
  }

  toString(): string {
    return this.parts.join('.');
  }
}
