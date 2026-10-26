/**
 * Valores monetarios trafegam como string decimal ("1234.56"). Toda aritmetica e formatacao e feita por
 * string/BigInt (centavos inteiros com sinal) - nunca por Number (RNF01, ADR 9.4).
 */
const NBSP = "\u00A0";
const DECIMAL_RE = /^(-)?(\d+)(?:\.(\d+))?$/;

/** "1234.56" -> 123456n; "-150.00" -> -15000n; "7" -> 700n. Mais de 2 casas e invalido. */
export function toCents(value: string): bigint {
  const match = DECIMAL_RE.exec(value.trim());
  if (!match) throw new RangeError(`valor monetario invalido: ${JSON.stringify(value)}`);
  const [, sign, int, frac = ""] = match;
  if (frac.length > 2) throw new RangeError(`valor monetario com mais de 2 casas: ${JSON.stringify(value)}`);
  const cents = BigInt(int) * 100n + BigInt(frac.padEnd(2, "0"));
  return sign ? -cents : cents;
}

/** 123456n -> "1234.56"; -15n -> "-0.15". */
export function fromCents(cents: bigint): string {
  const negative = cents < 0n;
  const abs = negative ? -cents : cents;
  const int = abs / 100n;
  const frac = (abs % 100n).toString().padStart(2, "0");
  return `${negative ? "-" : ""}${int}.${frac}`;
}

export function sumDecimals(values: readonly string[]): string {
  return fromCents(values.reduce((acc, v) => acc + toCents(v), 0n));
}

export type Sign = "positive" | "negative" | "zero";

export function signOf(value: string): Sign {
  const cents = toCents(value);
  if (cents === 0n) return "zero";
  return cents > 0n ? "positive" : "negative";
}

function groupThousands(digits: string): string {
  return digits.replace(/\B(?=(\d{3})+(?!\d))/g, ".");
}

/** "1234.56" -> "R$ 1.234,56" (NBSP depois do R$); "-150.00" -> "-R$ 150,00"; zero nunca vira "-R$ 0,00". */
export function formatBRL(value: string): string {
  const cents = toCents(value);
  const negative = cents < 0n;
  const abs = negative ? -cents : cents;
  const int = (abs / 100n).toString();
  const frac = (abs % 100n).toString().padStart(2, "0");
  return `${negative ? "-" : ""}R$${NBSP}${groupThousands(int)},${frac}`;
}

/** Texto do campo "Valor" ("1.234,56", "R$ 10,5", "10") -> string decimal; null quando invalido. */
export function parseMoneyInput(input: string): string | null {
  const text = input.replace(/R\$/g, "").replace(/\s/g, "");
  if (!text) return null;
  const parts = text.split(",");
  if (parts.length > 2) return null;
  const [intPart, fracPart = ""] = parts;
  const grouped = /^\d{1,3}(\.\d{3})+$/.test(intPart);
  if (!grouped && !/^\d+$/.test(intPart)) return null;
  if (parts.length === 2 && !/^\d{1,2}$/.test(fracPart)) return null;
  const int = intPart.replace(/\./g, "").replace(/^0+(?=\d)/, "");
  return `${int}.${fracPart.padEnd(2, "0")}`;
}

/** Mascara da direita para a esquerda: os digitos digitados viram centavos ("123456" -> "1.234,56"). */
export function maskMoneyInput(input: string): string {
  const digits = input.replace(/\D/g, "").replace(/^0+/, "");
  if (!digits) return input.replace(/\D/g, "") ? "0,00" : "";
  const padded = digits.padStart(3, "0");
  const int = padded.slice(0, -2).replace(/^0+(?=\d)/, "");
  return `${groupThousands(int)},${padded.slice(-2)}`;
}
