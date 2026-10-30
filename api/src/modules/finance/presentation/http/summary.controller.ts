import { Controller, Get, Inject, Query } from '@nestjs/common';
import { CurrentOwnerId } from '@shared/presentation/auth/current-principal.decorators.js';
import { ZodValidationPipe } from '@shared/presentation/pipes/zod-validation.pipe.js';
import { FinanceReadHandlers } from './finance-read-handlers.js';
import { monthQuerySchema, type MonthQuery } from './schemas/query.schemas.js';

@Controller('summary')
export class SummaryController {
  constructor(@Inject(FinanceReadHandlers) private readonly reads: FinanceReadHandlers) {}

  @Get()
  summary(@CurrentOwnerId() ownerId: string, @Query(new ZodValidationPipe(monthQuerySchema)) query: MonthQuery) {
    return this.reads.summary(ownerId, query);
  }
}
