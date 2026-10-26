import { Controller, Get, Inject, Query } from '@nestjs/common';
import { ZodValidationPipe } from '@shared/presentation/pipes/zod-validation.pipe.js';
import { GetCategoryDistribution } from '../../application/use-cases/dashboard/get-category-distribution.js';
import { GetMonthlySeries } from '../../application/use-cases/dashboard/get-monthly-series.js';
import { presentTotals } from './presenters/totals.presenter.js';
import { monthQuerySchema, type MonthQuery } from './schemas/query.schemas.js';

@Controller('dashboard')
export class DashboardController {
  constructor(
    @Inject(GetMonthlySeries) private readonly getMonthlySeries: GetMonthlySeries,
    @Inject(GetCategoryDistribution) private readonly getCategoryDistribution: GetCategoryDistribution,
  ) {}

  @Get('monthly-series')
  async monthlySeries(@Query(new ZodValidationPipe(monthQuerySchema)) query: MonthQuery) {
    const result = await this.getMonthlySeries.execute(query);
    return {
      from: result.from.toString(),
      to: result.to.toString(),
      points: result.points.map((point) => ({ month: point.month.toString(), totals: presentTotals(point.totals) })),
    };
  }

  @Get('category-distribution')
  async categoryDistribution(@Query(new ZodValidationPipe(monthQuerySchema)) query: MonthQuery) {
    const result = await this.getCategoryDistribution.execute(query);
    return {
      month: result.month.toString(),
      total: result.total.toString(),
      items: result.items.map((item) => ({
        category: item.category,
        total: item.total.toString(),
        percentage: item.percentage,
      })),
    };
  }
}
