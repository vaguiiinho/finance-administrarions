import type pg from 'pg';
import { insertCard, insertEntry, cardUuid, entryUuid, type CardRow, type EntryRow } from './db.js';
import { userUuid } from './identity-builders.js';

/**
 * Seeds por SQL cru para o schema COM DONO (ADR 0005 7.1). Independentes dos repositorios (testam os read models
 * sem depender de quem escreve) e capazes de gravar linhas "impossiveis".
 */
// owner_data_resets (ADR 0013 M2) tem FK para users com ON DELETE CASCADE: o TRUNCATE ... users CASCADE a limpa.
export const resetAll = async (pool: pg.Pool): Promise<void> => {
  await pool.query('TRUNCATE TABLE entries, cards, sessions, users RESTART IDENTITY CASCADE');
};

export interface UserRow {
  n: number;
  id?: string;
  name?: string;
  email?: string;
  role?: 'ADMIN' | 'USER';
  status?: 'ACTIVE' | 'INACTIVE';
  kind?: 'REGULAR' | 'DEMO' | 'PENDING_FIRST_ADMIN' | 'SHOWCASE';
  mustChangePassword?: boolean;
  /** undefined = hash padrao para REGULAR e null para os demais; null = sem hash. */
  passwordHash?: string | null;
  createdAt?: string;
  updatedAt?: string;
}

export async function insertUser(pool: pg.Pool, row: UserRow): Promise<string> {
  const id = row.id ?? userUuid(row.n);
  const kind = row.kind ?? 'REGULAR';
  const hash = row.passwordHash === undefined ? (kind === 'REGULAR' ? '$fake$segredo123' : null) : row.passwordHash;
  const createdAt = row.createdAt ?? '2026-10-01T12:00:00.000Z';
  await pool.query(
    `INSERT INTO users (id, name, email, password_hash, kind, role, status, must_change_password, created_at, updated_at)
     VALUES ($1::uuid, $2, $3, $4, $5::user_kind, $6::user_role, $7::user_status, $8, $9::timestamptz, $10::timestamptz)`,
    [
      id,
      row.name ?? `Usuario ${row.n}`,
      row.email ?? `user${row.n}@exemplo.com`,
      hash,
      kind,
      row.role ?? 'USER',
      row.status ?? 'ACTIVE',
      row.mustChangePassword ?? false,
      createdAt,
      row.updatedAt ?? createdAt,
    ],
  );
  return id;
}

export async function insertSession(
  pool: pg.Pool,
  p: { n: number; userId: string; digest?: string; createdAt: string; expiresAt: string },
): Promise<string> {
  const id = `0b000000-0000-7000-8000-${String(p.n).padStart(12, '0')}`;
  await pool.query(
    `INSERT INTO sessions (id, user_id, token_digest, created_at, expires_at)
     VALUES ($1::uuid, $2::uuid, $3, $4::timestamptz, $5::timestamptz)`,
    [id, p.userId, p.digest ?? p.n.toString(16).padStart(64, '0'), p.createdAt, p.expiresAt],
  );
  return id;
}

/** Cartao com dono (user_id NOT NULL). */
export async function insertOwnedCard(pool: pg.Pool, userId: string, row: CardRow): Promise<string> {
  const name = row.name ?? `Cartao ${row.n}`;
  const createdAt = row.createdAt ?? '2026-10-01T12:00:00.000Z';
  await pool.query(
    `INSERT INTO cards (id, user_id, name, name_key, closing_day, due_day, created_at, updated_at)
     VALUES ($1::uuid, $2::uuid, $3, $4, $5, $6, $7::timestamptz, $8::timestamptz)`,
    [cardUuid(row.n), userId, name, row.nameKey ?? name.toLocaleLowerCase('pt-BR'), row.closingDay ?? 25, row.dueDay ?? 5, createdAt, row.updatedAt ?? createdAt],
  );
  return cardUuid(row.n);
}

export async function insertOwnedEntry(pool: pg.Pool, userId: string, row: EntryRow): Promise<string> {
  const type = row.type ?? 'EXPENSE';
  const date = row.date ?? '2026-10-05';
  const paymentMethod = row.paymentMethod ?? 'PIX';
  const status = row.status ?? (type === 'INCOME' ? 'RECEIVED' : 'PAID');
  const createdAt = row.createdAt ?? '2026-10-05T13:00:00.000Z';
  const category = row.category ?? 'Moradia';
  const paidAt = row.paidAt === undefined ? (status === 'PAID' ? createdAt : null) : row.paidAt;
  const cardId = row.cardId !== undefined ? row.cardId : row.cardN != null ? cardUuid(row.cardN) : null;
  await pool.query(
    `INSERT INTO entries (id, user_id, type, description, category, category_key, "date", amount, payment_method, card_id,
                          closing_date, due_date, reference_month, status, paid_at, created_at, updated_at)
     VALUES ($1::uuid, $2::uuid, $3::entry_type, $4, $5, $6, $7::date, $8::numeric, $9::payment_method, $10::uuid,
             $11::date, $12::date, $13::date, $14::entry_status, $15::timestamptz, $16::timestamptz, $17::timestamptz)`,
    [
      entryUuid(row.n),
      userId,
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

export { insertCard, insertEntry };
