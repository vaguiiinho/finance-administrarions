import type { OwnerId } from '../../domain/owner/owner-id.js';

export interface CategoryReadModel {
  listDistinct(ownerId: OwnerId): Promise<string[]>;
}

export const CATEGORY_READ_MODEL = Symbol('CATEGORY_READ_MODEL');
