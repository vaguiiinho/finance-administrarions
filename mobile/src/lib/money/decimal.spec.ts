import { describe, expect, it } from "vitest";
import { formatBRL, fromCents, maskMoneyInput, parseMoneyInput, signOf, sumDecimals, toCents } from "./decimal";

const NBSP = " ";
/** Normaliza NBSP/espacos para comparar com o texto do CA67 ("R$ 1.234,56"). */
const plain = (s: string) => s.replace(/[  ]/g, " ");

describe("formatBRL (CA67, design 1.7): por manipulacao de string, nunca Number", () => {
  it.each([
    ["1234.56", "R$ 1.234,56"],
    ["0.00", "R$ 0,00"],
    ["5.00", "R$ 5,00"],
    ["0.05", "R$ 0,05"],
    ["999.99", "R$ 999,99"],
    ["1000.00", "R$ 1.000,00"],
    ["1500000.00", "R$ 1.500.000,00"],
    ["9999999999.99", "R$ 9.999.999.999,99"],
    ["-150.00", "-R$ 150,00"],
    ["-0.10", "-R$ 0,10"],
    ["-1234.56", "-R$ 1.234,56"],
  ])("%s -> %s", (input, expected) => {
    expect(plain(formatBRL(input))).toBe(expected);
  });

  it("usa NBSP depois do R$ (nunca quebra entre R$ e os digitos)", () => {
    expect(formatBRL("1234.56")).toBe(`R$${NBSP}1.234,56`);
    expect(formatBRL("-150.00")).toBe(`-R$${NBSP}150,00`);
  });

  it("zero negativo nunca vira -R$ 0,00", () => {
    expect(plain(formatBRL("-0.00"))).toBe("R$ 0,00");
  });

  it("preserva a precisao acima de 2^53 centavos (sem Number)", () => {
    expect(plain(formatBRL("90071992547409.93"))).toBe("R$ 90.071.992.547.409,93");
    expect(plain(formatBRL("-99999999999999999999.99"))).toBe("-R$ 99.999.999.999.999.999.999,99");
  });

  it("completa valores com menos casas decimais", () => {
    expect(plain(formatBRL("10"))).toBe("R$ 10,00");
    expect(plain(formatBRL("10.5"))).toBe("R$ 10,50");
  });
});

describe("signOf (P25: sinal textual positivo/negativo/zerado)", () => {
  it.each([
    ["150.00", "positive"],
    ["0.01", "positive"],
    ["-0.10", "negative"],
    ["-1234.56", "negative"],
    ["0.00", "zero"],
    ["-0.00", "zero"],
    ["0", "zero"],
  ])("%s -> %s", (input, expected) => {
    expect(signOf(input)).toBe(expected);
  });
});

describe("centavos BigInt com sinal", () => {
  it("toCents/fromCents fazem round trip exato", () => {
    expect(toCents("1234.56")).toBe(123456n);
    expect(toCents("-150.00")).toBe(-15000n);
    expect(toCents("0.5")).toBe(50n);
    expect(toCents("7")).toBe(700n);
    expect(fromCents(123456n)).toBe("1234.56");
    expect(fromCents(-15n)).toBe("-0.15");
    expect(fromCents(0n)).toBe("0.00");
    expect(fromCents(9007199254740993n)).toBe("90071992547409.93");
  });

  it("sumDecimals soma por centavos (selecionados na aba Despesas, CA70)", () => {
    expect(sumDecimals(["0.10", "0.20", "0.30"])).toBe("0.60");
    expect(sumDecimals(["100.00", "50.25"])).toBe("150.25");
    expect(sumDecimals(["0.50", "-0.60"])).toBe("-0.10");
    expect(sumDecimals([])).toBe("0.00");
    expect(sumDecimals(["9999999999.99", "9999999999.99", "9999999999.99"])).toBe("29999999999.97");
  });
});

describe("parsing/mascara do campo de valor do drawer", () => {
  it.each([
    ["1.234,56", "1234.56"],
    ["1234,56", "1234.56"],
    ["10", "10.00"],
    ["10,5", "10.50"],
    ["0,05", "0.05"],
    ["R$ 1.234,56", "1234.56"],
  ])("parseMoneyInput(%j) -> %j", (input, expected) => {
    expect(parseMoneyInput(input)).toBe(expected);
  });

  it.each([[""], ["abc"], ["1,234,56"], ["10,123"], ["-"]])("parseMoneyInput(%j) -> null (invalido)", (input) => {
    expect(parseMoneyInput(input)).toBeNull();
  });

  it("maskMoneyInput formata digitos digitados como centavos (sem Number)", () => {
    expect(maskMoneyInput("1")).toBe("0,01");
    expect(maskMoneyInput("12")).toBe("0,12");
    expect(maskMoneyInput("123456")).toBe("1.234,56");
    expect(maskMoneyInput("99999999999999999")).toBe("999.999.999.999.999,99");
    expect(maskMoneyInput("")).toBe("");
    expect(maskMoneyInput("a1b2")).toBe("0,12");
  });
});

describe("toCents: entradas invalidas", () => {
  it.each(["", "abc", "1,50", "1.234", "--1", "1.", ".5", "1e3"])("rejeita %j", (v) => expect(() => toCents(v)).toThrow(RangeError));
  it("aceita espacos nas pontas", () => expect(toCents(" 12.5 ")).toBe(1250n));
});

describe("maskMoneyInput: bordas", () => {
  it("vazio e sem digitos -> vazio", () => {
    expect(maskMoneyInput("")).toBe("");
    expect(maskMoneyInput("abc")).toBe("");
  });
  it("somente zeros -> 0,00", () => expect(maskMoneyInput("000")).toBe("0,00"));
  it("um e dois digitos preenchem os centavos", () => {
    expect(maskMoneyInput("5")).toBe("0,05");
    expect(maskMoneyInput("50")).toBe("0,50");
  });
  it("agrupa milhares e ignora zeros a esquerda", () => {
    expect(maskMoneyInput("123456")).toBe("1.234,56");
    expect(maskMoneyInput("0012345678")).toBe("123.456,78");
  });
});
