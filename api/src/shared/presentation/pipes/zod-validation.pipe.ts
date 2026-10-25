import type { PipeTransform } from '@nestjs/common';
import type { ZodType } from 'zod';
import { RequestValidationError } from '../errors/request-validation.error.js';
import { toViolations } from '../zod/zod-violations.js';

/** Valida a forma (presença, tipo, chaves, tamanho) com zod; regras de negócio ficam no domínio. */
export class ZodValidationPipe<T> implements PipeTransform<unknown, T> {
  constructor(private readonly schema: ZodType<T>) {}

  transform(value: unknown): T {
    const input = value !== null && typeof value === 'object' && !Array.isArray(value) ? { ...value } : value;
    const result = this.schema.safeParse(input);
    if (!result.success) throw new RequestValidationError(toViolations(result.error, input));
    return result.data;
  }
}
