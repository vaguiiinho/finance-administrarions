import type pg from 'pg';
import { cardEntry, cardUuid, createPool, entryUuid, expectCheckViolation, query, type CardRow, type EntryRow } from './db.js';
import { DEFAULT_OWNER_ID_VALUE } from './builders.js';
import { insertOwnedCard, insertOwnedEntry, insertUser, resetAll } from './owned-db.js';

/**
 * Seeds do USUARIO PADRAO dos testes de finance de dono unico (Ana, n = 1, `DEFAULT_OWNER`). Mantem a forma dos
 * helpers antigos de db.ts (que gravam no esquema legado, sem dono, e ainda servem a migration-ownership) sobre o
 * esquema com dono (ADR 0005 7.1).
 */
export const DEFAULT_OWNER_ID = DEFAULT_OWNER_ID_VALUE;

/** Esvazia tudo e recria o usuario padrao (a FK exige dono). */
export async function resetDb(pool: pg.Pool): Promise<void> {
  await resetAll(pool);
  await insertUser(pool, { n: 1, id: DEFAULT_OWNER_ID, name: 'Ana Souza', email: 'ana@exemplo.com' });
}

export const insertCard = (pool: pg.Pool, row: CardRow): Promise<string> => insertOwnedCard(pool, DEFAULT_OWNER_ID, row);
export const insertEntry = (pool: pg.Pool, row: EntryRow): Promise<string> => insertOwnedEntry(pool, DEFAULT_OWNER_ID, row);

export { cardEntry, cardUuid, createPool, entryUuid, expectCheckViolation, query };
export type { CardRow, EntryRow };
