import type pg from 'pg';
import { CalendarDate } from '@shared/domain/value-objects/calendar-date.js';
import { YearMonth } from '@shared/domain/value-objects/year-month.js';
import { ClosingDay, DueDay } from '@finance/domain/billing/day-of-month.js';
import { calculateInvoiceDates } from '@finance/domain/billing/calculate-invoice-dates.js';
import { unwrap } from '@test/support/result.js';

/**
 * Massa do RNF06 (ADR 0002 T4): 100 mil lancamentos, 20 cartoes, 24 meses. `buildVolumeDataset` e puro e
 * deterministico (PRNG com semente fixa, sem relogio); `seedVolume` insere em lote via `pg` + `unnest` (sem Prisma).
 */
export interface VolumeCard {
  id: string;
  name: string;
  nameKey: string;
  closingDay: number;
  dueDay: number;
  createdAt: string;
  updatedAt: string;
}

export interface VolumeEntry {
  id: string;
  type: 'INCOME' | 'EXPENSE';
  description: string;
  category: string;
  categoryKey: string;
  date: string;
  amount: string;
  paymentMethod: 'PIX' | 'CARD';
  cardId: string | null;
  closingDate: string | null;
  dueDate: string | null;
  referenceMonth: string;
  status: 'PENDING' | 'PAID' | 'RECEIVED';
  paidAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface VolumeDataset {
  cards: VolumeCard[];
  entries: VolumeEntry[];
}

export interface InvoiceRef {
  cardId: string;
  referenceMonth: string;
}

export interface VolumeSeed {
  cardIds: string[];
  months: string[];
  categories: string[];
  biggestInvoice: InvoiceRef;
  pendingInvoices: InvoiceRef[];
}

const TOTAL_ENTRIES = 100_000;
const CARD_COUNT = 20;
const FIRST_MONTH = YearMonth.of(2024, 10);
const MONTH_COUNT = 24;
const CATEGORIES = [
  'Alimentação',
  'Moradia',
  'Transporte',
  'Saúde',
  'Lazer',
  'Educação',
  'Mercado',
  'Assinaturas',
  'Viagem',
  'Salário',
];
const CLOSING_DAYS = [1, 5, 8, 10, 12, 15, 18, 20, 22, 25, 28, 29, 30, 31, 3, 7, 14, 17, 24, 27];
const DUE_DAYS = [10, 15, 20, 25, 5, 28, 30, 31, 29, 1, 8, 12, 18, 22, 27, 3, 7, 14, 17, 24];
const BASE_TIME = Date.UTC(2024, 9, 1);

function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** UUID v7 deterministico: 48 bits de "timestamp" fixo + contador, versao 7, variante 10xx, resto do PRNG. */
function uuidV7(counter: number, rand: () => number): string {
  const ts = (BASE_TIME + counter * 1000).toString(16).padStart(12, '0');
  const hex = (n: number, len: number) => Math.floor(n * 16 ** len).toString(16).padStart(len, '0');
  const variant = (8 + Math.floor(rand() * 4)).toString(16);
  return `${ts.slice(0, 8)}-${ts.slice(8, 12)}-7${hex(rand(), 3)}-${variant}${hex(rand(), 3)}-${hex(rand(), 6)}${hex(rand(), 6)}`;
}

const pickInt = (rand: () => number, min: number, max: number) => min + Math.floor(rand() * (max - min + 1));

export function buildVolumeDataset(): VolumeDataset {
  const rand = mulberry32(20261024);
  let counter = 0;
  const cards: VolumeCard[] = Array.from({ length: CARD_COUNT }, (_, i) => {
    const name = `Cartão ${String(i + 1).padStart(2, '0')}`;
    return {
      id: uuidV7(counter++, rand),
      name,
      nameKey: name.toLocaleLowerCase('pt-BR'),
      closingDay: CLOSING_DAYS[i],
      dueDay: DUE_DAYS[i],
      createdAt: '2024-09-01T12:00:00.000Z',
      updatedAt: '2024-09-01T12:00:00.000Z',
    };
  });
  const closing = cards.map((c) => unwrap<ClosingDay>(ClosingDay.create(c.closingDay)));
  const due = cards.map((c) => unwrap<DueDay>(DueDay.create(c.dueDay)));

  const entries: VolumeEntry[] = [];
  for (let i = 0; i < TOTAL_ENTRIES; i++) {
    entries.push(buildEntry());
  }
  return { cards, entries };

  function buildEntry(): VolumeEntry {
    const offset = Math.floor(rand() * MONTH_COUNT);
    let ym = FIRST_MONTH;
    for (let k = 0; k < offset; k++) ym = ym.next();
    const purchase = CalendarDate.of(ym, pickInt(rand, 1, ym.lengthInDays()));
    const date = purchase.toString();
    const isIncome = rand() < 0.15;
    const category = isIncome ? 'Salário' : CATEGORIES[pickInt(rand, 0, CATEGORIES.length - 2)];
    const amount = `${pickInt(rand, 5, 4999)}.${String(pickInt(rand, 0, 99)).padStart(2, '0')}`;
    const createdAt = `${date}T12:00:00.000Z`;
    const paidAtOf = () => new Date(Date.parse(createdAt) + 3_600_000).toISOString();
    const base = {
      id: uuidV7(counter++, rand),
      description: `Lançamento ${counter}`,
      category,
      categoryKey: category.toLocaleLowerCase('pt-BR'),
      date,
      amount,
      createdAt,
      updatedAt: createdAt,
    };
    if (isIncome) {
      return {
        ...base,
        type: 'INCOME',
        paymentMethod: 'PIX',
        cardId: null,
        closingDate: null,
        dueDate: null,
        referenceMonth: `${date.slice(0, 7)}-01`,
        status: 'RECEIVED',
        paidAt: null,
      };
    }
    const paid = rand() < 0.5;
    const common = { type: 'EXPENSE' as const, status: paid ? ('PAID' as const) : ('PENDING' as const), paidAt: paid ? paidAtOf() : null };
    if (rand() < 0.4) {
      const idx = pickInt(rand, 0, CARD_COUNT - 1);
      const dates = calculateInvoiceDates(purchase, closing[idx], due[idx]);
      return {
        ...base,
        ...common,
        paymentMethod: 'CARD',
        cardId: cards[idx].id,
        closingDate: dates.closingDate.toString(),
        dueDate: dates.dueDate.toString(),
        referenceMonth: `${dates.referenceMonth.toString()}-01`,
      };
    }
    return {
      ...base,
      ...common,
      paymentMethod: 'PIX',
      cardId: null,
      closingDate: null,
      dueDate: null,
      referenceMonth: `${date.slice(0, 7)}-01`,
    };
  }
}

const BATCH = 5_000;

/** Todos os dados pertencem a `ownerId` (usuario existente: a FK exige dono, ADR 0005 7.1). */
export async function seedVolume(pool: pg.Pool, ownerId: string): Promise<VolumeSeed> {
  const { cards, entries } = buildVolumeDataset();
  await pool.query(
    `INSERT INTO cards (id, name, name_key, closing_day, due_day, created_at, updated_at, user_id)
     SELECT * FROM unnest($1::uuid[], $2::text[], $3::text[], $4::smallint[], $5::smallint[], $6::timestamptz[], $7::timestamptz[], $8::uuid[])`,
    [
      cards.map((c) => c.id),
      cards.map((c) => c.name),
      cards.map((c) => c.nameKey),
      cards.map((c) => c.closingDay),
      cards.map((c) => c.dueDay),
      cards.map((c) => c.createdAt),
      cards.map((c) => c.updatedAt),
      cards.map(() => ownerId),
    ],
  );
  for (let from = 0; from < entries.length; from += BATCH) {
    const b = entries.slice(from, from + BATCH);
    await pool.query(
      `INSERT INTO entries (id, type, description, category, category_key, date, amount, payment_method, card_id,
         closing_date, due_date, reference_month, status, paid_at, created_at, updated_at, user_id)
       SELECT * FROM unnest($1::uuid[], $2::entry_type[], $3::text[], $4::text[], $5::text[], $6::date[], $7::numeric[],
         $8::payment_method[], $9::uuid[], $10::date[], $11::date[], $12::date[], $13::entry_status[],
         $14::timestamptz[], $15::timestamptz[], $16::timestamptz[], $17::uuid[])`,
      [
        b.map((e) => e.id),
        b.map((e) => e.type),
        b.map((e) => e.description),
        b.map((e) => e.category),
        b.map((e) => e.categoryKey),
        b.map((e) => e.date),
        b.map((e) => e.amount),
        b.map((e) => e.paymentMethod),
        b.map((e) => e.cardId),
        b.map((e) => e.closingDate),
        b.map((e) => e.dueDate),
        b.map((e) => e.referenceMonth),
        b.map((e) => e.status),
        b.map((e) => e.paidAt),
        b.map((e) => e.createdAt),
        b.map((e) => e.updatedAt),
        b.map(() => ownerId),
      ],
    );
  }
  await pool.query('ANALYZE cards');
  await pool.query('ANALYZE entries');

  const counts = new Map<string, { ref: InvoiceRef; total: number; pending: number }>();
  for (const e of entries) {
    if (e.paymentMethod !== 'CARD') continue;
    const ref = { cardId: e.cardId!, referenceMonth: e.referenceMonth.slice(0, 7) };
    const key = `${ref.cardId}|${ref.referenceMonth}`;
    const c = counts.get(key) ?? { ref, total: 0, pending: 0 };
    c.total++;
    if (e.status === 'PENDING') c.pending++;
    counts.set(key, c);
  }
  const invoices = [...counts.values()];
  const biggest = invoices.reduce((a, b) => (b.total > a.total ? b : a));
  const months = [...new Set(entries.filter((e) => e.paymentMethod === 'PIX').map((e) => e.referenceMonth.slice(0, 7)))].sort();
  return {
    cardIds: cards.map((c) => c.id),
    months,
    categories: [...new Set(entries.map((e) => e.category))].sort(),
    biggestInvoice: biggest.ref,
    pendingInvoices: invoices.filter((i) => i.pending > 0 && i !== biggest).map((i) => i.ref),
  };
}
