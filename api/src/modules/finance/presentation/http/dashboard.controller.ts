import { Controller, Get, Inject, Query } from '@nestjs/common';
import { CurrentOwnerId } from '@shared/presentation/auth/current-principal.decorators.js';
import { ZodValidationPipe } from '@shared/presentation/pipes/zod-validation.pipe.js';
import { FinanceReadHandlers } from './finance-read-handlers.js';
import { monthQuerySchema, type MonthQuery } from './schemas/query.schemas.js';

@Controller('dashboard')
export class DashboardController {
  constructor(@Inject(FinanceReadHandlers) private readonly reads: FinanceReadHandlers) {}

  @Get('monthly-series')
  monthlySeries(@CurrentOwnerId() ownerId: string, @Query(new ZodValidationPipe(monthQuerySchema)) query: MonthQuery) {
    return this.reads.monthlySeries(ownerId, query);
  }

  @Get('category-distribution')
  categoryDistribution(@CurrentOwnerId() ownerId: string, @Query(new ZodValidationPipe(monthQuerySchema)) query: MonthQuery) {
    return this.reads.categoryDistribution(ownerId, query);
  }
}
