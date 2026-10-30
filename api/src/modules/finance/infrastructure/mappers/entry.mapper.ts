import { unwrapPersisted } from '@shared/domain/unwrap.js';
import { CalendarDate } from '@shared/domain/value-objects/calendar-date.js';
import { Money } from '@shared/domain/value-objects/money.js';
import type { Prisma } from '@shared/infrastructure/prisma/generated/client.js';
import type { EntryView } from '../../application/ports/views.js';
import { InvoiceDates } from '../../domain/billing/invoice-dates.js';
import { ReferenceMonth } from '../../domain/billing/reference-month.js';
import { CardId } from '../../domain/card/value-objects/card-id.js';
import { Entry } from '../../domain/entry/entry.js';
import { Category } from '../../domain/entry/value-objects/category.js';
import { Description } from '../../domain/entry/value-objects/description.js';
import { EntryId } from '../../domain/entry/value-objects/entry-id.js';
import type { EntryStatus } from '../../domain/entry/value-objects/entry-status.js';
import type { EntryType } from '../../domain/entry/value-objects/entry-type.js';
import type { PaymentMethod } from '../../domain/entry/value-objects/payment-method.js';
import { OwnerId } from '../../domain/owner/owner-id.js';

/**
 * Linha de `entries` lida por SQL cru, com datas e valores já como texto
 * (nenhum deslocamento de fuso, nenhum Number/Decimal - ver `entry-sql.ts`).
 */
export interface EntryRecord {
  id: string;
  user_id: string;
  type: EntryType;
  description: string;
  category: string;
  date: string;
  amount: string;
  payment_method: PaymentMethod;
  card_id: string | null;
  closing_date: string | null;
  due_date: string | null;
  reference_month: string;
  status: EntryStatus;
  paid_at: Date | null;
  created_at: Date;
  updated_at: Date;
}

export interface EntryViewRecord extends Omit<EntryRecord, 'user_id'> {
  card_name: string | null;
}

const parseDate = (value: string, context: string) => unwrapPersisted(CalendarDate.parse(value), context);

export const EntryMapper = {
  toDomain(row: EntryRecord): Entry {
    const date = parseDate(row.date, 'entries.date');
    const invoiceDates =
      row.closing_date !== null && row.due_date !== null
        ? InvoiceDates.restore({
            purchaseDate: date,
            closingDate: parseDate(row.closing_date, 'entries.closing_date'),
            dueDate: parseDate(row.due_date, 'entries.due_date'),
          })
        : null;

    return Entry.restore({
      id: unwrapPersisted(EntryId.create(row.id), 'entries.id'),
      ownerId: unwrapPersisted(OwnerId.create(row.user_id), 'entries.user_id'),
      type: row.type,
      description: unwrapPersisted(Description.create(row.description), 'entries.description'),
      category: unwrapPersisted(Category.create(row.category), 'entries.category'),
      date,
      amount: unwrapPersisted(Money.parse(row.amount), 'entries.amount'),
      paymentMethod: row.payment_method,
      cardId: row.card_id === null ? null : unwrapPersisted(CardId.create(row.card_id), 'entries.card_id'),
      invoiceDates,
      referenceMonth: unwrapPersisted(ReferenceMonth.parse(row.reference_month), 'entries.reference_month'),
      status: row.status,
      paidAt: row.paid_at,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    });
  },

  toPersistence(entry: Entry): Prisma.EntryUncheckedCreateInput {
    const s = entry.toSnapshot();
    return {
      id: s.id.value,
      userId: s.ownerId.value,
      type: s.type,
      description: s.description.value,
      category: s.category.value,
      categoryKey: s.category.key,
      date: utcMidnight(s.date.toString()),
      amount: s.amount.toString(),
      paymentMethod: s.paymentMethod,
      cardId: s.cardId?.value ?? null,
      closingDate: s.invoiceDates ? utcMidnight(s.invoiceDates.closingDate.toString()) : null,
      dueDate: s.invoiceDates ? utcMidnight(s.invoiceDates.dueDate.toString()) : null,
      referenceMonth: utcMidnight(`${s.referenceMonth.toString()}-01`),
      status: s.status,
      paidAt: s.paidAt,
      createdAt: s.createdAt,
      updatedAt: s.updatedAt,
    };
  },

  toView(row: EntryViewRecord): EntryView {
    return {
      id: row.id,
      type: row.type,
      description: row.description,
      category: row.category,
      date: parseDate(row.date, 'entries.date'),
      amount: unwrapPersisted(Money.parse(row.amount), 'entries.amount'),
      paymentMethod: row.payment_method,
      card: row.card_id !== null && row.card_name !== null ? { id: row.card_id, name: row.card_name } : null,
      invoice:
        row.closing_date !== null && row.due_date !== null
          ? {
              closingDate: parseDate(row.closing_date, 'entries.closing_date'),
              dueDate: parseDate(row.due_date, 'entries.due_date'),
            }
          : null,
      referenceMonth: unwrapPersisted(ReferenceMonth.parse(row.reference_month), 'entries.reference_month'),
      status: row.status,
      paidAt: row.paid_at,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  },
};

/** DATE gravado como meia-noite UTC: independe do fuso do processo. */
function utcMidnight(day: string): Date {
  return new Date(`${day}T00:00:00.000Z`);
}
