import type { Category } from './value-objects/category.js';

export interface CategoryCatalog {
  /** Grafia canônica (primeiro uso, receitas e despesas - P23) ou null. */
  findByKey(key: string): Promise<Category | null>;
}

export const CATEGORY_CATALOG = Symbol('CATEGORY_CATALOG');
