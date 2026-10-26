import { AggregateRoot } from '@shared/domain/aggregate-root.js';
import { InvariantViolationError, type FieldViolation } from '@shared/domain/app-error.js';
import { ClosingDay, DueDay } from '../billing/day-of-month.js';
import type { CardBillingInfo } from './card-billing-info.js';
import { CardValidationError } from './errors/card-errors.js';
import { CardCreated, CardUpdated, type CardDomainEvent } from './events/card-events.js';
import { CardName } from './value-objects/card-name.js';
import type { CardId } from './value-objects/card-id.js';

export interface CardProps {
  name: string;
  closingDay: number;
  dueDay: number;
}

export interface CardSnapshot {
  id: CardId;
  name: CardName;
  closingDay: ClosingDay;
  dueDay: DueDay;
  createdAt: Date;
  updatedAt: Date;
}

const MESSAGES: Record<string, string> = {
  REQUIRED: 'Informe o nome do cartão.',
  TOO_LONG: 'O nome do cartão deve ter no máximo 50 caracteres.',
  NOT_INTEGER: 'Informe um número inteiro.',
  OUT_OF_RANGE: 'Informe um dia entre 1 e 31.',
};

function violation(field: string, code: string): FieldViolation {
  return { field, code, message: MESSAGES[code] ?? 'Valor inválido.' };
}

/** Valida os três campos acumulando todas as violações; lança CardValidationError. Sem criar o aggregate. */
export function parseCardProps(props: CardProps): { name: CardName; closingDay: ClosingDay; dueDay: DueDay } {
  const violations: FieldViolation[] = [];
  const name = CardName.create(props.name);
  const closingDay = ClosingDay.create(props.closingDay);
  const dueDay = DueDay.create(props.dueDay);
  if (!name.ok) violations.push(violation('name', name.error));
  if (!closingDay.ok) violations.push(violation('closingDay', closingDay.error));
  if (!dueDay.ok) violations.push(violation('dueDay', dueDay.error));
  if (!name.ok || !closingDay.ok || !dueDay.ok) throw new CardValidationError(violations);
  return { name: name.value, closingDay: closingDay.value, dueDay: dueDay.value };
}

export class Card extends AggregateRoot<CardDomainEvent> {
  private constructor(private state: CardSnapshot) {
    super();
    if (state.updatedAt.getTime() < state.createdAt.getTime()) {
      throw new InvariantViolationError('updatedAt anterior a createdAt no cartão.');
    }
  }

  /** Lança CardValidationError com TODAS as violações. Emite CardCreated. */
  static create(props: CardProps & { id: CardId; now: Date }): Card {
    const parsed = parseCardProps(props);
    const card = new Card({ id: props.id, ...parsed, createdAt: props.now, updatedAt: props.now });
    card.record(
      new CardCreated(props.id.value, parsed.name.value, parsed.closingDay.value, parsed.dueDay.value, props.now),
    );
    return card;
  }

  static restore(snapshot: CardSnapshot): Card {
    return new Card({ ...snapshot });
  }

  /** Substitui os três campos (PUT). Sem mudança efetiva: no-op. Retorna se mudou. */
  update(props: CardProps, now: Date): boolean {
    const parsed = parseCardProps(props);
    const changed =
      parsed.name.value !== this.state.name.value ||
      parsed.closingDay.value !== this.state.closingDay.value ||
      parsed.dueDay.value !== this.state.dueDay.value;
    if (!changed) return false;
    const before = this.data();
    this.state = { ...this.state, ...parsed, updatedAt: now };
    this.record(new CardUpdated(this.state.id.value, before, this.data(), now));
    return true;
  }

  billingInfo(): CardBillingInfo {
    return { cardId: this.state.id, closingDay: this.state.closingDay, dueDay: this.state.dueDay };
  }

  get id(): CardId {
    return this.state.id;
  }

  get name(): CardName {
    return this.state.name;
  }

  get closingDay(): ClosingDay {
    return this.state.closingDay;
  }

  get dueDay(): DueDay {
    return this.state.dueDay;
  }

  toSnapshot(): CardSnapshot {
    return { ...this.state };
  }

  private data() {
    return {
      name: this.state.name.value,
      closingDay: this.state.closingDay.value,
      dueDay: this.state.dueDay.value,
    };
  }
}
