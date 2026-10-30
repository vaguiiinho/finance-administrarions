import { Prisma } from '@shared/infrastructure/prisma/generated/client.js';

/**
 * Colunas lidas por SQL cru: datas e valores como texto (sem deslocamento de fuso nem Decimal),
 * mês de referência como 'YYYY-MM'. Alias da tabela: `e`.
 */
export const ENTRY_RECORD_COLUMNS = Prisma.raw(`
  e.id::text AS id, e.user_id::text AS user_id, e.type::text AS type, e.description, e.category,
  e."date"::text AS date, e.amount::text AS amount,
  e.payment_method::text AS payment_method, e.card_id::text AS card_id,
  e.closing_date::text AS closing_date, e.due_date::text AS due_date,
  to_char(e.reference_month, 'YYYY-MM') AS reference_month,
  e.status::text AS status, e.paid_at, e.created_at, e.updated_at`);

/** Colunas de `EntryView`: exige `LEFT JOIN cards c ON c.id = e.card_id`. */
export const ENTRY_VIEW_COLUMNS = Prisma.raw(`
  e.id::text AS id, e.type::text AS type, e.description, e.category,
  e."date"::text AS date, e.amount::text AS amount,
  e.payment_method::text AS payment_method, e.card_id::text AS card_id, c.name AS card_name,
  e.closing_date::text AS closing_date, e.due_date::text AS due_date,
  to_char(e.reference_month, 'YYYY-MM') AS reference_month,
  e.status::text AS status, e.paid_at, e.created_at, e.updated_at`);

/** Primeiro dia do mês de referência ('2026-10' -> '2026-10-01'). */
export const monthStart = (referenceMonth: { toString(): string }): string => `${referenceMonth.toString()}-01`;
