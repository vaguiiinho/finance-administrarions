import type { FieldViolation } from '@shared/domain/app-error.js';
import { ReferenceMonth } from '../../domain/billing/reference-month.js';
import { CardId } from '../../domain/card/value-objects/card-id.js';
import { EntryId } from '../../domain/entry/value-objects/entry-id.js';
import { Category } from '../../domain/entry/value-objects/category.js';
import { InvalidQueryError } from '../errors/application-errors.js';
import type { ExpenseCardFilter } from '../ports/entry-read-model.js';
import type { Paging } from '../ports/views.js';

const MESSAGES: Record<string, string> = {
  REQUIRED: 'Campo obrigatório.',
  INVALID_FORMAT: 'Formato inválido.',
  INVALID_VALUE: 'Valor não permitido.',
  OUT_OF_RANGE: 'Valor fora da faixa permitida.',
  TOO_LONG: 'Texto longo demais.',
  EMPTY: 'Informe ao menos um item.',
  TOO_MANY_ITEMS: 'Quantidade máxima de itens excedida.',
};

export function violation(field: string, code: string): FieldViolation {
  return { field, code, message: MESSAGES[code] ?? 'Valor inválido.' };
}

/** Lança um único InvalidQueryError se houve violações. */
export function throwIfInvalid(violations: readonly FieldViolation[]): void {
  if (violations.length > 0) throw new InvalidQueryError([...violations]);
}

export function parseRequiredMonth(raw: string | undefined, field: string, violations: FieldViolation[]): ReferenceMonth | null {
  if (raw === undefined || raw === '') {
    violations.push(violation(field, 'REQUIRED'));
    return null;
  }
  const parsed = ReferenceMonth.parse(raw);
  if (!parsed.ok) {
    violations.push(violation(field, parsed.error));
    return null;
  }
  return parsed.value;
}

export function parseCardId(raw: string | undefined, field: string, violations: FieldViolation[]): CardId | null {
  const parsed = CardId.create(raw ?? '');
  if (!parsed.ok) {
    violations.push(violation(field, parsed.error));
    return null;
  }
  return parsed.value;
}

export function parseEntryId(raw: string | undefined, field: string, violations: FieldViolation[]): EntryId | null {
  const parsed = EntryId.create(raw ?? '');
  if (!parsed.ok) {
    violations.push(violation(field, parsed.error));
    return null;
  }
  return parsed.value;
}

const DEFAULT_PAGE = 1;
const DEFAULT_PAGE_SIZE = 20;
const MAX_PAGE_SIZE = 100;
/** Teto de página: mantém OFFSET (page * pageSize) dentro de integer do Postgres. */
const MAX_PAGE = 1_000_000;

function parseInteger(raw: string | undefined, fallback: number, field: string, min: number, max: number, violations: FieldViolation[]): number {
  if (raw === undefined) return fallback;
  if (!/^\d+$/.test(raw)) {
    violations.push(violation(field, 'INVALID_FORMAT'));
    return fallback;
  }
  const value = Number(raw);
  if (value < min || value > max) {
    violations.push(violation(field, 'OUT_OF_RANGE'));
    return fallback;
  }
  return value;
}

export function parsePaging(page: string | undefined, pageSize: string | undefined, violations: FieldViolation[]): Paging {
  return {
    page: parseInteger(page, DEFAULT_PAGE, 'page', 1, MAX_PAGE, violations),
    pageSize: parseInteger(pageSize, DEFAULT_PAGE_SIZE, 'pageSize', 1, MAX_PAGE_SIZE, violations),
  };
}

/** Chave case-insensitive da categoria (via Category). Ausente -> undefined. */
export function parseCategoryKey(raw: string | undefined, violations: FieldViolation[]): string | undefined {
  if (raw === undefined) return undefined;
  const parsed = Category.create(raw);
  if (!parsed.ok) {
    violations.push(violation('category', parsed.error));
    return undefined;
  }
  return parsed.value.key;
}

export function parseExpenseStatus(raw: string | undefined, violations: FieldViolation[]): 'PENDING' | 'PAID' | undefined {
  if (raw === undefined) return undefined;
  if (raw === 'PENDING' || raw === 'PAID') return raw;
  violations.push(violation('status', 'INVALID_VALUE'));
  return undefined;
}

/** Filtro de fatura: só PENDING e PAID; `ALL` é rejeitado de propósito (ausência = todas; ADR 0007 6.2). */
export function parseInvoiceStatus(raw: string | undefined, violations: FieldViolation[]): 'PENDING' | 'PAID' | undefined {
  return parseExpenseStatus(raw, violations);
}

export function parseExpenseCardFilter(raw: string | undefined, violations: FieldViolation[]): ExpenseCardFilter {
  if (raw === undefined) return { kind: 'any' };
  if (raw === 'pix') return { kind: 'pix' };
  const cardId = parseCardId(raw, 'cardId', violations);
  return cardId ? { kind: 'card', cardId } : { kind: 'any' };
}

export function totalPages(totalItems: number, pageSize: number): number {
  return Math.ceil(totalItems / pageSize);
}
