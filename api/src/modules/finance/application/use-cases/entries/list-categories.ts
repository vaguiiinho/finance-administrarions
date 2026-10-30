import { requireOwnerId } from '../../queries/owner.js';
import type { CategoryReadModel } from '../../ports/category-read-model.js';

export class ListCategories {
  constructor(private readonly categories: CategoryReadModel) {}

  async execute(input: { ownerId: string }): Promise<{ items: string[] }> {
    return { items: await this.categories.listDistinct(requireOwnerId(input.ownerId)) };
  }
}
