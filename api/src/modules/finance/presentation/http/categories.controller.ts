import { Controller, Get, Inject } from '@nestjs/common';
import { ListCategories } from '../../application/use-cases/entries/list-categories.js';

@Controller('categories')
export class CategoriesController {
  constructor(@Inject(ListCategories) private readonly listCategories: ListCategories) {}

  @Get()
  list() {
    return this.listCategories.execute({});
  }
}
