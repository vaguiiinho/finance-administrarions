import type { FieldViolation } from '@shared/domain/app-error.js';
import { CalendarDate } from '@shared/domain/value-objects/calendar-date.js';
import { Money } from '@shared/domain/value-objects/money.js';
import { ReferenceMonth } from '../billing/reference-month.js';
import { CardId } from '../card/value-objects/card-id.js';
import { EntryValidationError } from './errors/entry-errors.js';
import { Category } from './value-objects/category.js';
import { Description } from './value-objects/description.js';
import { parseEntryType, type EntryType } from './value-objects/entry-type.js';
import { parsePaymentMethod, type PaymentMethod } from './value-objects/payment-method.js';

export interface RawEntryInput {
  type: string;
  description: string;
  category: string;
  date: string;
  amount: string;
  paymentMethod: string;
  cardId: string | null;
  /** undefined = omitido (distinto de false). */
  paid: boolean | undefined;
}

const MESSAGES: Record<string, string> = {
  REQUIRED: 'Campo obrigatório.',
  TOO_LONG: 'Texto longo demais.',
  INVALID_VALUE: 'Valor não permitido.',
  INVALID_FORMAT: 'Formato inválido.',
  INVALID_DATE: 'Data inexistente no calendário.',
  OUT_OF_RANGE: 'Data fora da faixa permitida (anos 1900 a 9998).',
  MUST_BE_POSITIVE: 'O valor deve ser maior que zero.',
  TOO_MANY_DECIMALS: 'Use no máximo 2 casas decimais.',
  TOO_LARGE: 'O valor excede o máximo permitido (9999999999.99).',
  NOT_ALLOWED_FOR_INCOME: 'Não se aplica a receitas.',
  NOT_ALLOWED_FOR_PIX: 'Não se aplica a lançamentos no PIX.',
  NOT_ALLOWED_FOR_CARD: 'Despesa no cartão sempre nasce pendente.',
};

interface InputState {
  type: EntryType;
  description: Description;
  category: Category;
  date: CalendarDate;
  amount: Money;
  paymentMethod: PaymentMethod;
  cardId: CardId | null;
  paid: boolean | undefined;
}

/** Tudo que se valida em um lançamento sem I/O, inclusive a consistência tipo x forma x cartão x paid. */
export class NewEntryInput {
  private constructor(private readonly state: InputState) {}

  /** Lança EntryValidationError com TODAS as violações (field + code). */
  static parse(raw: RawEntryInput): NewEntryInput {
    const violations: FieldViolation[] = [];
    const fail = (field: string, code: string) =>
      violations.push({ field, code, message: MESSAGES[code] ?? 'Valor inválido.' });

    const type = parseEntryType(raw.type);
    const description = Description.create(raw.description);
    const category = Category.create(raw.category);
    const date = CalendarDate.parse(raw.date);
    const amount = Money.parseEntryAmount(raw.amount);
    const paymentMethod = parsePaymentMethod(raw.paymentMethod);

    if (!type.ok) fail('type', type.error);
    if (!description.ok) fail('description', description.error);
    if (!category.ok) fail('category', category.error);
    if (!date.ok) fail('date', date.error);
    else if (date.value.yearMonth.year < ReferenceMonth.MIN_YEAR || date.value.yearMonth.year > ReferenceMonth.MAX_YEAR) {
      fail('date', 'OUT_OF_RANGE');
    }
    if (!amount.ok) fail('amount', amount.error);
    if (!paymentMethod.ok) fail('paymentMethod', paymentMethod.error);

    const hasCardId = raw.cardId !== null && raw.cardId !== undefined;
    let cardId: CardId | null = null;
    const isIncome = type.ok && type.value === 'INCOME';

    if (isIncome) {
      if (paymentMethod.ok && paymentMethod.value === 'CARD') fail('paymentMethod', 'NOT_ALLOWED_FOR_INCOME');
      if (hasCardId) fail('cardId', 'NOT_ALLOWED_FOR_INCOME');
      if (raw.paid !== undefined) fail('paid', 'NOT_ALLOWED_FOR_INCOME');
    } else if (paymentMethod.ok && paymentMethod.value === 'CARD') {
      if (!hasCardId) {
        fail('cardId', 'REQUIRED');
      } else {
        const parsed = CardId.create(raw.cardId!);
        if (parsed.ok) cardId = parsed.value;
        else fail('cardId', parsed.error);
      }
      if (raw.paid === true) fail('paid', 'NOT_ALLOWED_FOR_CARD');
    } else if (paymentMethod.ok && hasCardId) {
      fail('cardId', 'NOT_ALLOWED_FOR_PIX');
    }

    if (
      violations.length > 0 ||
      !type.ok ||
      !description.ok ||
      !category.ok ||
      !date.ok ||
      !amount.ok ||
      !paymentMethod.ok
    ) {
      throw new EntryValidationError(violations);
    }

    return new NewEntryInput({
      type: type.value,
      description: description.value,
      category: category.value,
      date: date.value,
      amount: amount.value,
      paymentMethod: paymentMethod.value,
      cardId,
      paid: raw.paid,
    });
  }

  get type(): EntryType {
    return this.state.type;
  }

  get description(): Description {
    return this.state.description;
  }

  get category(): Category {
    return this.state.category;
  }

  get date(): CalendarDate {
    return this.state.date;
  }

  get amount(): Money {
    return this.state.amount;
  }

  get paymentMethod(): PaymentMethod {
    return this.state.paymentMethod;
  }

  get cardId(): CardId | null {
    return this.state.cardId;
  }

  get paid(): boolean | undefined {
    return this.state.paid;
  }

  withCanonicalCategory(category: Category): NewEntryInput {
    return new NewEntryInput({ ...this.state, category });
  }
}
