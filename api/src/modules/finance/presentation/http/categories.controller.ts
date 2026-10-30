import { Controller, Get, Inject } from '@nestjs/common';
import { CurrentOwnerId } from '@shared/presentation/auth/current-principal.decorators.js';
import { FinanceReadHandlers } from './finance-read-handlers.js';

@Controller('categories')
export class CategoriesController {
  constructor(@Inject(FinanceReadHandlers) private readonly reads: FinanceReadHandlers) {}

  @Get()
  list(@CurrentOwnerId() ownerId: string) {
    return this.reads.categories(ownerId);
  }
}
