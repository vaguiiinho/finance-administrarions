import { pixExpense } from "./entries-data";

/**
 * Dados de pior caso do donut (ADR 0012 5.5, CA08), para o cenario `custom` do stub:
 *   await seedData({ entries: worstCaseEntries(M), demo: { cards: [], entries: worstCaseEntries(M) } })
 * O stub calcula a distribuicao por categoria a partir dos lancamentos; so os dados mudam, nao o stub.
 */

/** Nome de 60 caracteres sem espaco, distinto por prefixo numerico (nao colide no agrupamento). */
export const longName = (n: number) => `${String(n).padStart(2, "0")}${"W".repeat(58)}`;
const MAX_VALUE = "9999999999.99"; // limite de Decimal(12,2)

/** 7 categorias (5 + "Outras" com 2), nomes de 60 caracteres e o maior valor possivel na maior fatia. */
export function worstCaseEntries(month: string): unknown[] {
  const amounts = [MAX_VALUE, "9000000000.00", "8000000000.00", "7000000000.00", "6000000000.00", "5000000000.00", "0.01"];
  return amounts.map((amount, i) => pixExpense(i + 1, month, { category: longName(i + 1), description: `Despesa ${i + 1}`, amount, status: "PAID" }));
}

/** Uma categoria so: percentual "100,00%" (a string de percentual mais larga) e total no limite no centro da rosca. */
export function singleCategoryEntries(month: string): unknown[] {
  return [pixExpense(1, month, { category: longName(1), description: "Unica", amount: MAX_VALUE, status: "PAID" })];
}
