import { v7 } from 'uuid';
import type { IdGenerator } from '@shared/application/ports/id-generator.js';

export class UuidV7IdGenerator implements IdGenerator {
  next(): string {
    return v7();
  }
}
