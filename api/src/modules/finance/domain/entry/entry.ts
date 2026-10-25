import { AggregateRoot } from '@shared/domain/aggregate-root.js';
import { InvariantViolationError } from '@shared/domain/app-error.js';
import type { CalendarDate } from '@shared/domain/value-objects/calendar-date.js';
import type { Money } from '@shared/domain/value-objects/money.js';
import { calculateInvoiceDates } from '../billing/calculate-invoice-dates.js';
import { InvoiceDates } from '../billing/invoice-dates.js';
import { ReferenceMonth } from '../billing/reference-month.js';
import type { CardBillingInfo } from '../card/card-billing-info.js';
import type { CardId } from '../card/value-objects/card-id.js';
import { IncomeNotPayableError } from './errors/entry-errors.js';
import { EntryCreated, EntryPaid, type EntryDomainEvent } from './events/entry-events.js';
import type { NewEntryInput } from './new-entry-input.js';
import type { Category } from './value-objects/category.js';
import type { Description } from './value-objects/description.js';
import type { EntryId } from './value-objects/entry-id.js';
import type { EntryStatus } from './value-objects/entry-status.js';
import type { EntryType } from './value-objects/entry-type.js';
import type { PaymentMethod } from './value-objects/payment-method.js';

export interface EntrySnapshot {
  id: EntryId;
  type: EntryType;
  description: Description;
  category: Category;
  date: CalendarDate;
  amount: Money;
  paymentMethod: PaymentMethod;
  cardId: CardId | null;
  invoiceDates: InvoiceDates | null;
  referenceMonth: ReferenceMonth;
  status: EntryStatus;
  paidAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

function fail(message: string): never {
  throw new InvariantViolationError(message);
}

/** Invariantes 2-5, 7 e 10 do aggregate (usadas por create e restore). */
function assertConsistent(s: EntrySnapshot): void {
  if (s.type === 'INCOME') {
    if (s.status !== 'RECEIVED') fail('Receita deve estar RECEIVED.');
    if (s.paymentMethod !== 'PIX' || s.cardId !== null || s.invoiceDates !== null || s.paidAt !== null) {
      fail('Receita deve ser PIX, sem cartão, sem fatura e sem paidAt.');
    }
  } else if (s.status !== 'PENDING' && s.status !== 'PAID') {
    fail('Despesa deve estar PENDING ou PAID.');
  }

  const isCard = s.paymentMethod === 'CARD';
  if (isCard !== (s.cardId !== null) || isCard !== (s.invoiceDates !== null)) {
    fail('CARD <=> cardId <=> invoiceDates.');
  }

  const expectedReference = s.invoiceDates ? s.invoiceDates.referenceMonth : ReferenceMonth.forPix(s.date);
  if (!s.referenceMonth.equals(expectedReference)) fail('Mês de referência incoerente.');
  if (s.invoiceDates) InvoiceDates.restore({
      purchaseDate: s.date,
      closingDate: s.invoiceDates.closingDate,
      dueDate: s.invoiceDates.dueDate,
    });

  if ((s.status === 'PAID') !== (s.paidAt !== null)) fail('PAID <=> paidAt.');
  if (s.paidAt && s.paidAt.getTime() < s.createdAt.getTime()) fail('paidAt anterior a createdAt.');
  if (s.updatedAt.getTime() < s.createdAt.getTime()) fail('updatedAt anterior a createdAt.');
}

function initialStatus(input: NewEntryInput): EntryStatus {
  if (input.type === 'INCOME') return 'RECEIVED';
  if (input.paymentMethod === 'CARD') return 'PENDING';
  return input.paid === false ? 'PENDING' : 'PAID';
}

export class Entry extends AggregateRoot<EntryDomainEvent> {
  private constructor(private state: EntrySnapshot) {
    super();
    assertConsistent(state);
  }

  /**
   * CARD: invoiceDates = calculateInvoiceDates(date, closingDay, dueDay); referenceMonth = mês do vencimento.
   * PIX: referenceMonth = mês da data. O status inicial depende só de tipo, forma e `paid` (B8, B11).
   * `card` é obrigatório se e somente se a forma é CARD e deve ter o mesmo id (senão: erro de programação).
   */
  static create(props: { id: EntryId; input: NewEntryInput; card: CardBillingInfo | null; now: Date }): Entry {
    const { id, input, card, now } = props;
    let invoiceDates: InvoiceDates | null = null;
    if (input.paymentMethod === 'CARD') {
      if (!card || !input.cardId || !card.cardId.equals(input.cardId)) {
        fail('Lançamento no cartão exige o snapshot do mesmo cartão.');
      }
      invoiceDates = calculateInvoiceDates(input.date, card.closingDay, card.dueDay);
    } else if (card !== null) {
      fail('Lançamento sem cartão não aceita snapshot de cartão.');
    }

    const status = initialStatus(input);
    const entry = new Entry({
      id,
      type: input.type,
      description: input.description,
      category: input.category,
      date: input.date,
      amount: input.amount,
      paymentMethod: input.paymentMethod,
      cardId: input.cardId,
      invoiceDates,
      referenceMonth: invoiceDates ? invoiceDates.referenceMonth : ReferenceMonth.forPix(input.date),
      status,
      paidAt: status === 'PAID' ? now : null,
      createdAt: now,
      updatedAt: now,
    });
    entry.record(entry.createdEvent(now));
    return entry;
  }

  /** Reidrata valores gravados sem recalcular; valida a coerência. Sem eventos. */
  static restore(snapshot: EntrySnapshot): Entry {
    return new Entry({ ...snapshot });
  }

  /** true se houve transição; false se já PAID. Lança IncomeNotPayableError para INCOME. */
  markAsPaid(at: Date): boolean {
    if (this.state.type === 'INCOME') throw new IncomeNotPayableError(this.state.id.value);
    if (this.state.status === 'PAID') return false;
    this.state = { ...this.state, status: 'PAID', paidAt: at, updatedAt: at };
    assertConsistent(this.state);
    this.record(
      new EntryPaid(
        this.state.id.value,
        this.state.amount.toString(),
        at,
        this.state.cardId?.value ?? null,
        this.state.referenceMonth.toString(),
        at,
      ),
    );
    return true;
  }

  isIncome(): boolean {
    return this.state.type === 'INCOME';
  }

  get id(): EntryId {
    return this.state.id;
  }

  get type(): EntryType {
    return this.state.type;
  }

  get status(): EntryStatus {
    return this.state.status;
  }

  get amount(): Money {
    return this.state.amount;
  }

  get referenceMonth(): ReferenceMonth {
    return this.state.referenceMonth;
  }

  get invoiceDates(): InvoiceDates | null {
    return this.state.invoiceDates;
  }

  get cardId(): CardId | null {
    return this.state.cardId;
  }

  toSnapshot(): EntrySnapshot {
    return { ...this.state };
  }

  private createdEvent(now: Date): EntryCreated {
    const s = this.state;
    return new EntryCreated(
      s.id.value,
      s.type,
      s.amount.toString(),
      s.date.toString(),
      s.paymentMethod,
      s.cardId?.value ?? null,
      s.invoiceDates?.closingDate.toString() ?? null,
      s.invoiceDates?.dueDate.toString() ?? null,
      s.referenceMonth.toString(),
      s.status,
      s.paidAt,
      s.category.key,
      now,
    );
  }
}
