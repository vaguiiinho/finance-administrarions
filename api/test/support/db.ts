import { inject } from 'vitest';
import pg from 'pg';

export const databaseUrl = (): string => inject('databaseUrl');

export function createPool(): pg.Pool {
  return new pg.Pool({ connectionString: databaseUrl(), max: 5 });
}

export async function resetDb(pool: pg.Pool): Promise<void> {
  await pool.query('TRUNCATE TABLE entries, cards RESTART IDENTITY CASCADE');
}

// ---------------------------------------------------------------------------
// Seeds por SQL cru: independentes dos repositorios (testam o read model/CHECKs
// sem depender de quem escreve) e capazes de gravar linhas "impossiveis".
// ---------------------------------------------------------------------------

const pad = (n: number) => String(n).padStart(12, '0');
export const cardUuid = (n: number) => `c0000000-0000-7000-8000-${pad(n)}`;
export const entryUuid = (n: number) => `e0000000-0000-7000-8000-${pad(n)}`;

export interface CardRow {
  n: number;
  name?: string;
  nameKey?: string;
  closingDay?: number;
  dueDay?: number;
  createdAt?: string;
  updatedAt?: string;
}

export async function insertCard(pool: pg.Pool, row: CardRow): Promise<string> {
  const name = row.name ?? `Cartao ${row.n}`;
  const createdAt = row.createdAt ?? '2026-10-01T12:00:00.000Z';
  await pool.query(
    `INSERT INTO cards (id, name, name_key, closing_day, due_day, created_at, updated_at)
     VALUES ($1::uuid, $2, $3, $4, $5, $6::timestamptz, $7::timestamptz)`,
    [
      cardUuid(row.n),
      name,
      row.nameKey ?? name.toLocaleLowerCase('pt-BR'),
      row.closingDay ?? 25,
      row.dueDay ?? 5,
      createdAt,
      row.updatedAt ?? createdAt,
    ],
  );
  return cardUuid(row.n);
}

export interface EntryRow {
  n: number;
  type?: 'INCOME' | 'EXPENSE';
  description?: string;
  category?: string;
  categoryKey?: string;
  date?: string;
  amount?: string;
  paymentMethod?: 'PIX' | 'CARD';
  cardN?: number | null;
  cardId?: string | null;
  closingDate?: string | null;
  dueDate?: string | null;
  referenceMonth?: string; // 'YYYY-MM-01'
  status?: 'PENDING' | 'PAID' | 'RECEIVED';
  paidAt?: string | null | undefined;
  createdAt?: string;
  updatedAt?: string;
}

/** Linha padrao = despesa PIX paga, valida em todos os CHECKs. Sobrescreva campos para montar cenarios. */
export async function insertEntry(pool: pg.Pool, row: EntryRow): Promise<string> {
  const type = row.type ?? 'EXPENSE';
  const date = row.date ?? '2026-10-05';
  const paymentMethod = row.paymentMethod ?? 'PIX';
  const status = row.status ?? (type === 'INCOME' ? 'RECEIVED' : 'PAID');
  const createdAt = row.createdAt ?? '2026-10-05T13:00:00.000Z';
  const category = row.category ?? 'Moradia';
  const paidAt = row.paidAt === undefined ? (status === 'PAID' ? createdAt : null) : row.paidAt;
  const cardId = row.cardId !== undefined ? row.cardId : row.cardN != null ? cardUuid(row.cardN) : null;
  await pool.query(
    `INSERT INTO entries (id, type, description, category, category_key, "date", amount, payment_method, card_id,
                          closing_date, due_date, reference_month, status, paid_at, created_at, updated_at)
     VALUES ($1::uuid, $2::entry_type, $3, $4, $5, $6::date, $7::numeric, $8::payment_method, $9::uuid,
             $10::date, $11::date, $12::date, $13::entry_status, $14::timestamptz, $15::timestamptz, $16::timestamptz)`,
    [
      entryUuid(row.n),
      type,
      row.description ?? `Lancamento ${row.n}`,
      category,
      row.categoryKey ?? category.toLocaleLowerCase('pt-BR'),
      date,
      row.amount ?? '100.00',
      paymentMethod,
      cardId,
      row.closingDate ?? null,
      row.dueDate ?? null,
      row.referenceMonth ?? `${date.slice(0, 7)}-01`,
      status,
      paidAt,
      createdAt,
      row.updatedAt ?? createdAt,
    ],
  );
  return entryUuid(row.n);
}

/** Despesa no cartao com as datas da fatura informadas (ja calculadas pelo teste). */
export function cardEntry(
  n: number,
  cardN: number,
  p: { date: string; closing: string; due: string; amount?: string; status?: 'PENDING' | 'PAID'; category?: string } & Partial<EntryRow>,
): EntryRow {
  const status = p.status ?? 'PENDING';
  const { closing, due, ...rest } = p;
  return {
    n,
    cardN,
    paymentMethod: 'CARD',
    status,
    closingDate: closing,
    dueDate: due,
    referenceMonth: `${due.slice(0, 7)}-01`,
    paidAt: status === 'PAID' ? '2026-10-20T10:00:00.000Z' : null,
    ...rest,
  };
}

export async function query<T = Record<string, unknown>>(pool: pg.Pool, sql: string, params: unknown[] = []): Promise<T[]> {
  return (await pool.query(sql, params)).rows as T[];
}

/** Espera violacao de CHECK (SQLSTATE 23514). */
export async function expectCheckViolation(promise: Promise<unknown>): Promise<void> {
  await expect(promise).rejects.toMatchObject({ code: '23514' });
}
