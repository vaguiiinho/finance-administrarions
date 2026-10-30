import type { YearMonth } from '@shared/domain/value-objects/year-month.js';
import type { Card } from '../../domain/card/card.js';
import type { Entry } from '../../domain/entry/entry.js';
import type { OwnerId } from '../../domain/owner/owner-id.js';

export interface DemoDatasetStore {
  /**
   * Sob advisory lock: se não há dataset ou (anchor, version) difere do gravado, apaga os dados do dono, grava
   * `build()` e atualiza `demo_datasets`; devolve true. Caso contrário devolve false sem tocar em nada.
   */
  replaceIfStale(
    ownerId: OwnerId,
    anchor: YearMonth,
    version: number,
    build: () => { cards: Card[]; entries: Entry[] },
  ): Promise<boolean>;
}
export const DEMO_DATASET_STORE = Symbol('DEMO_DATASET_STORE');
