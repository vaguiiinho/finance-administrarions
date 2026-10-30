import type { OwnerId } from '../owner/owner-id.js';
import type { Category } from './value-objects/category.js';

export interface CategoryCatalog {
  /** Grafia canônica do PRIMEIRO uso deste dono (receitas e despesas - P23, RF26) ou null. */
  findByKey(ownerId: OwnerId, key: string): Promise<Category | null>;
}

export const CATEGORY_CATALOG = Symbol('CATEGORY_CATALOG');
