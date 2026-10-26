import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { beforeAll, describe, expect, it } from "vitest";

// Import dinamico por URL: o stub e `.mjs` sem tipos, e um import estatico quebraria o `tsc`/`next build` enquanto o
// arquivo nao existe (fase RED) ou se ficar sem declaracao de tipos.
type CalculateInvoiceDates = (date: string, closingDay: number, dueDay: number) => { closingDate: string; dueDate: string; referenceMonth: string };
let calculateInvoiceDates: CalculateInvoiceDates;
beforeAll(async () => {
  const loaded = (await import(/* @vite-ignore */ pathToFileURL(resolve(__dirname, "invoice-dates.mjs")).href)) as { calculateInvoiceDates: CalculateInvoiceDates };
  calculateInvoiceDates = loaded.calculateInvoiceDates;
});

/**
 * Paridade stub x API (ADR 0002 T5): o stub espelha `calculateInvoiceDates` do dominio. Os dois lados leem o MESMO
 * fixture (`api/test/fixtures/invoice-dates.cases.json`, tabela CA21); se a regra mudar na api e o stub nao
 * acompanhar, este teste quebra.
 */
interface Case {
  date: string;
  closingDay: number;
  dueDay: number;
  closingDate: string;
  dueDate: string;
  referenceMonth: string;
}
const cases = JSON.parse(readFileSync(resolve(__dirname, "../../../api/test/fixtures/invoice-dates.cases.json"), "utf8")) as Case[];

describe("stub-api/invoice-dates.mjs - paridade com a regra de dominio (RF05, CA21)", () => {
  it("o fixture compartilhado tem a tabela CA21 inteira", () => {
    expect(cases.length).toBeGreaterThanOrEqual(20);
  });

  it.each(cases.map((c) => [c.date, c.closingDay, c.dueDay, c] as const))("compra %s, fecha %i / vence %i", (_d, _c, _v, c) => {
    expect(calculateInvoiceDates(c.date, c.closingDay, c.dueDay)).toEqual({
      closingDate: c.closingDate,
      dueDate: c.dueDate,
      referenceMonth: c.referenceMonth,
    });
  });

  it("devolve o mes de referencia no formato YYYY-MM (mes do vencimento)", () => {
    const r = calculateInvoiceDates("2026-10-26", 25, 5);
    expect(r.referenceMonth).toBe(r.dueDate.slice(0, 7));
  });
});
