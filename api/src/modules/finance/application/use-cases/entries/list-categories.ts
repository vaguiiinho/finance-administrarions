import type { CategoryReadModel } from '../../ports/category-read-model.js';

export class ListCategories {
  constructor(private readonly categories: CategoryReadModel) {}

  async execute(_input: Record<string, never>): Promise<{ items: string[] }> {
    return { items: await this.categories.listDistinct() };
  }
}
