import fc from 'fast-check';
import { unwrap, violationOf, isOk } from '@test/support/result.js';
import { Money } from './money.js';

const parse = (v: string) => Money.parse(v);
const entry = (v: string) => Money.parseEntryAmount(v);
const m = (v: string): Money => unwrap<Money>(parse(v));

describe('Money.parse (com sinal, ate 2 casas, sem Number)', () => {
  it.each([
    ['0', '0.00'],
    ['10', '10.00'],
    ['10.5', '10.50'],
    ['10.05', '10.05'],
    ['-150.00', '-150.00'],
    ['-0.10', '-0.10'],
    ['1234.56', '1234.56'],
    ['9999999999.99', '9999999999.99'],
  ])('aceita %s e serializa como %s', (input, expected) => {
    expect(m(input).toString()).toBe(expected);
  });

  it.each([['abc'], ['1e3'], [' 10'], ['10 '], ['.5'], ['10.'], ['1,50'], [''], ['--1'], ['+1'], ['1.2.3']])(
    'rejeita formato invalido %j com INVALID_FORMAT',
    (input) => {
      expect(violationOf(parse(input))).toBe('INVALID_FORMAT');
    },
  );

  it.each([['10.123'], ['10.120'], ['0.001']])('rejeita mais de 2 casas (%s) com TOO_MANY_DECIMALS', (input) => {
    expect(violationOf(parse(input))).toBe('TOO_MANY_DECIMALS');
  });

  it('nunca arredonda nem passa por Number: preserva precisao acima de 2^53 centavos', () => {
    expect(m('90071992547409.93').toCents()).toBe(9007199254740993n);
    expect(m('99999999999999999999.99').toString()).toBe('99999999999999999999.99');
  });

  it('zero nunca vira "-0.00"', () => {
    expect(m('-0').toString()).toBe('0.00');
    expect(m('-0.00').toString()).toBe('0.00');
    expect(m('0.10').subtract(m('0.10')).toString()).toBe('0.00');
    expect(m('0.00').negate().toString()).toBe('0.00');
  });
});

describe('Money.parseEntryAmount (CA17, CA18)', () => {
  it.each([
    ['0', 'MUST_BE_POSITIVE'],
    ['0.00', 'MUST_BE_POSITIVE'],
    ['-10.00', 'MUST_BE_POSITIVE'],
    ['10.123', 'TOO_MANY_DECIMALS'],
    ['abc', 'INVALID_FORMAT'],
    ['10000000000.00', 'TOO_LARGE'],
    ['9999999999.99', null],
    ['0.01', null],
  ])('valor %j -> violacao %s', (input, violation) => {
    const result = entry(input);
    if (violation === null) {
      expect(isOk(result)).toBe(true);
    } else {
      expect(violationOf(result)).toBe(violation);
    }
  });

  it('CA18: completa as casas decimais', () => {
    expect(unwrap<Money>(entry('10')).toString()).toBe('10.00');
    expect(unwrap<Money>(entry('10.5')).toString()).toBe('10.50');
  });

  it('MAX_ENTRY_AMOUNT vale 9999999999.99', () => {
    expect(Money.MAX_ENTRY_AMOUNT.toString()).toBe('9999999999.99');
  });
});

describe('Money aritmetica exata', () => {
  it('CA52: 0.10 + 0.20 + 0.30 = 0.60 e 0.50 - 0.60 = -0.10', () => {
    const total = Money.sum([m('0.10'), m('0.20'), m('0.30')]);
    expect(total.toString()).toBe('0.60');
    expect(m('0.50').subtract(total).toString()).toBe('-0.10');
  });

  it('soma vazia e ZERO', () => {
    expect(Money.sum([]).toString()).toBe('0.00');
    expect(Money.ZERO.isZero()).toBe(true);
  });

  it('totais podem exceder 12 digitos (P02)', () => {
    const big = m('9999999999.99');
    expect(Money.sum([big, big, big]).toString()).toBe('29999999999.97');
  });

  it('sign, isNegative, compare, equals, fromCents', () => {
    expect(m('-0.01').sign()).toBe(-1);
    expect(m('0').sign()).toBe(0);
    expect(m('3').sign()).toBe(1);
    expect(m('-0.01').isNegative()).toBe(true);
    expect(m('1').compare(m('2'))).toBe(-1);
    expect(m('2').compare(m('2.00'))).toBe(0);
    expect(m('3').compare(m('2'))).toBe(1);
    expect(m('2.5').equals(m('2.50'))).toBe(true);
    expect(Money.fromCents(-15000n).toString()).toBe('-150.00');
    expect(m('1.99').add(m('0.01')).toString()).toBe('2.00');
    expect(m('5').negate().toString()).toBe('-5.00');
  });

  it('propriedade: add/subtract sao inversas e toString faz round trip', () => {
    fc.assert(
      fc.property(fc.bigInt({ min: -(10n ** 15n), max: 10n ** 15n }), fc.bigInt({ min: -(10n ** 15n), max: 10n ** 15n }), (a, b) => {
        const x = Money.fromCents(a);
        const y = Money.fromCents(b);
        expect(x.add(y).subtract(y).equals(x)).toBe(true);
        expect(m(x.toString()).toCents()).toBe(a);
      }),
    );
  });
});
