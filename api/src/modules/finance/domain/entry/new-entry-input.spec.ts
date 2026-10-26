import { rawEntry, cardUuid, thrown } from '@test/support/builders.js';
import { unwrap } from '@test/support/result.js';
import { NewEntryInput } from './new-entry-input.js';
import { Category } from './value-objects/category.js';

type Violation = { field: string; code: string };
const violations = (fn: () => unknown): Violation[] => {
  const error = thrown(fn);
  expect(error.code).toBe('VALIDATION_ERROR');
  expect(error.kind).toBe('validation');
  return error.details.fields as Violation[];
};
const parseViolations = (overrides: Parameters<typeof rawEntry>[0]) =>
  violations(() => NewEntryInput.parse(rawEntry(overrides)));
const has = (list: Violation[], field: string, code: string) =>
  list.some((v) => v.field === field && v.code === code);

describe('NewEntryInput.parse - entradas validas', () => {
  it('despesa PIX sem paid: paid permanece undefined (distinto de false)', () => {
    const input = NewEntryInput.parse(rawEntry());
    expect(input.type).toBe('EXPENSE');
    expect(input.paymentMethod).toBe('PIX');
    expect(input.paid).toBeUndefined();
    expect(input.cardId).toBeNull();
    expect(input.date.toString()).toBe('2026-10-05');
  });

  it('CA09: despesa no cartao aceita paid omitido e paid false', () => {
    const base = { paymentMethod: 'CARD', cardId: cardUuid(1) };
    expect(NewEntryInput.parse(rawEntry({ ...base, paid: undefined })).paid).toBeUndefined();
    expect(NewEntryInput.parse(rawEntry({ ...base, paid: false })).paid).toBe(false);
  });

  it('CA08: PIX aceita paid true e false', () => {
    expect(NewEntryInput.parse(rawEntry({ paid: true })).paid).toBe(true);
    expect(NewEntryInput.parse(rawEntry({ paid: false })).paid).toBe(false);
  });

  it('CA18: completa casas decimais do valor', () => {
    expect(NewEntryInput.parse(rawEntry({ amount: '10' })).amount.toString()).toBe('10.00');
    expect(NewEntryInput.parse(rawEntry({ amount: '10.5' })).amount.toString()).toBe('10.50');
  });

  it('CA16: descricao com 120 caracteres e aceita', () => {
    expect(() => NewEntryInput.parse(rawEntry({ description: 'x'.repeat(120) }))).not.toThrow();
  });

  it('receita PIX sem paid nem cartao e valida (CA10, data futura)', () => {
    const input = NewEntryInput.parse(rawEntry({ type: 'INCOME', date: '2026-10-30', cardId: null }));
    expect(input.type).toBe('INCOME');
  });

  it('cardId null explicito equivale a omitido', () => {
    expect(NewEntryInput.parse(rawEntry({ cardId: null })).cardId).toBeNull();
  });

  it('withCanonicalCategory troca so a grafia da categoria (CA20)', () => {
    const input = NewEntryInput.parse(rawEntry({ category: '  alimentação ' }));
    const replaced = input.withCanonicalCategory(unwrap<Category>(Category.create('Alimentação')));
    expect(replaced.category.value).toBe('Alimentação');
    expect(input.category.value).toBe('alimentação');
  });
});

describe('NewEntryInput.parse - consistencia tipo x forma x cartao x paid', () => {
  it('CA09: CARD com paid true -> paid: NOT_ALLOWED_FOR_CARD', () => {
    const list = parseViolations({ paymentMethod: 'CARD', cardId: cardUuid(1), paid: true });
    expect(has(list, 'paid', 'NOT_ALLOWED_FOR_CARD')).toBe(true);
  });

  it('CA11: receita com CARD -> paymentMethod: NOT_ALLOWED_FOR_INCOME', () => {
    const list = parseViolations({ type: 'INCOME', paymentMethod: 'CARD', cardId: cardUuid(1) });
    expect(has(list, 'paymentMethod', 'NOT_ALLOWED_FOR_INCOME')).toBe(true);
  });

  it('CA11: receita com cardId -> cardId: NOT_ALLOWED_FOR_INCOME', () => {
    const list = parseViolations({ type: 'INCOME', cardId: cardUuid(1) });
    expect(has(list, 'cardId', 'NOT_ALLOWED_FOR_INCOME')).toBe(true);
  });

  it.each([[true], [false]])('CA11/P31: receita com paid=%s -> paid: NOT_ALLOWED_FOR_INCOME', (paid) => {
    const list = parseViolations({ type: 'INCOME', paid });
    expect(has(list, 'paid', 'NOT_ALLOWED_FOR_INCOME')).toBe(true);
  });

  it('CA12: CARD sem cardId -> cardId: REQUIRED', () => {
    expect(has(parseViolations({ paymentMethod: 'CARD', cardId: null }), 'cardId', 'REQUIRED')).toBe(true);
  });

  it('CA12: PIX com cardId -> cardId: NOT_ALLOWED_FOR_PIX', () => {
    expect(has(parseViolations({ paymentMethod: 'PIX', cardId: cardUuid(1) }), 'cardId', 'NOT_ALLOWED_FOR_PIX')).toBe(true);
  });

  it('cardId mal formado -> cardId: INVALID_FORMAT', () => {
    expect(has(parseViolations({ paymentMethod: 'CARD', cardId: 'abc' }), 'cardId', 'INVALID_FORMAT')).toBe(true);
  });
});

describe('NewEntryInput.parse - campos', () => {
  it.each([
    ['TRANSFERENCIA'],
    [''],
    ['expense'],
    ['EXPENSE '],
  ])('CA14: tipo %j -> type: INVALID_VALUE', (type) => {
    expect(has(parseViolations({ type }), 'type', 'INVALID_VALUE')).toBe(true);
  });

  it.each([['CONTA'], ['DINHEIRO'], ['ACCOUNT'], ['pix'], ['']])(
    'CA14: forma %j -> paymentMethod: INVALID_VALUE',
    (paymentMethod) => {
      expect(has(parseViolations({ paymentMethod }), 'paymentMethod', 'INVALID_VALUE')).toBe(true);
    },
  );

  it.each([
    ['', 'REQUIRED'],
    ['   ', 'REQUIRED'],
    ['x'.repeat(121), 'TOO_LONG'],
  ])('CA16: descricao %j -> %s', (description, code) => {
    expect(has(parseViolations({ description }), 'description', code)).toBe(true);
  });

  it.each([
    ['0', 'MUST_BE_POSITIVE'],
    ['0.00', 'MUST_BE_POSITIVE'],
    ['-10.00', 'MUST_BE_POSITIVE'],
    ['10.123', 'TOO_MANY_DECIMALS'],
    ['abc', 'INVALID_FORMAT'],
    ['10000000000.00', 'TOO_LARGE'],
  ])('CA17: valor %j -> amount: %s', (amount, code) => {
    expect(has(parseViolations({ amount }), 'amount', code)).toBe(true);
  });

  it('CA19: categoria vazia -> category: REQUIRED', () => {
    expect(has(parseViolations({ category: '' }), 'category', 'REQUIRED')).toBe(true);
  });

  it('CA19: data 2026-02-30 -> date: INVALID_DATE', () => {
    expect(has(parseViolations({ date: '2026-02-30' }), 'date', 'INVALID_DATE')).toBe(true);
  });

  it('CA19: data vazia ou com formato errado aponta o campo date', () => {
    expect(parseViolations({ date: '' }).some((v) => v.field === 'date')).toBe(true);
    expect(parseViolations({ date: '05/10/2026' }).some((v) => v.field === 'date')).toBe(true);
  });

  it('CA19: acumula TODAS as violacoes de uma vez', () => {
    const list = parseViolations({
      type: 'TRANSFERENCIA',
      description: '',
      category: '',
      date: '2026-02-30',
      amount: '0',
      paymentMethod: 'CONTA',
    });
    const fields = new Set(list.map((v) => v.field));
    for (const field of ['type', 'description', 'category', 'date', 'amount', 'paymentMethod']) {
      expect(fields.has(field)).toBe(true);
    }
  });

  it('acumula violacoes de campo e de consistencia juntas', () => {
    const list = parseViolations({ type: 'INCOME', paymentMethod: 'CARD', cardId: cardUuid(1), paid: true, amount: '0' });
    expect(has(list, 'amount', 'MUST_BE_POSITIVE')).toBe(true);
    expect(has(list, 'paymentMethod', 'NOT_ALLOWED_FOR_INCOME')).toBe(true);
    expect(has(list, 'cardId', 'NOT_ALLOWED_FOR_INCOME')).toBe(true);
    expect(has(list, 'paid', 'NOT_ALLOWED_FOR_INCOME')).toBe(true);
  });

  it('as mensagens de violacao existem (pt-BR, nao vazias)', () => {
    const error = thrown(() => NewEntryInput.parse(rawEntry({ description: '' })));
    for (const v of error.details.fields) {
      expect(typeof v.message).toBe('string');
      expect(v.message.length).toBeGreaterThan(0);
    }
  });
});

describe('NewEntryInput.parse - faixa de datas de negocio', () => {
  it.each([['9999-12-31'], ['1899-12-31'], ['0001-01-01']])('data %s -> date: OUT_OF_RANGE', (date) => {
    expect(has(parseViolations({ date }), 'date', 'OUT_OF_RANGE')).toBe(true);
  });

  it('1900-01-01 e 9998-12-31 sao aceitas', () => {
    expect(() => NewEntryInput.parse(rawEntry({ date: '1900-01-01' }))).not.toThrow();
    expect(() => NewEntryInput.parse(rawEntry({ date: '9998-12-31' }))).not.toThrow();
  });
});
