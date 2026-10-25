import { Controller, Get, Inject, Query } from '@nestjs/common';
import { ZodValidationPipe } from '@shared/presentation/pipes/zod-validation.pipe.js';
import { GetMonthlySummary } from '../../application/use-cases/summary/get-monthly-summary.js';
import { presentTotals } from './presenters/totals.presenter.js';
import { monthQuerySchema, type MonthQuery } from './schemas/query.schemas.js';

@Controller('summary')
export class SummaryController {
  constructor(@Inject(GetMonthlySummary) private readonly getMonthlySummary: GetMonthlySummary) {}

  @Get()
  async summary(@Query(new ZodValidationPipe(monthQuerySchema)) query: MonthQuery) {
    const result = await this.getMonthlySummary.execute(query);
    return { month: result.month.toString(), totals: presentTotals(result.totals) };
  }
}
