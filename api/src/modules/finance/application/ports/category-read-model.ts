export interface CategoryReadModel {
  listDistinct(): Promise<string[]>;
}

export const CATEGORY_READ_MODEL = Symbol('CATEGORY_READ_MODEL');
