import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { beforeAll, describe, expect, it } from "vitest";

// Import dinamico por URL: o stub e `.mjs` sem tipos (mesmo motivo de invoice-dates.spec.ts).
type Facts = { currentMonth: string; firstPendingMonth: string | null; oldestPendingCardMonth?: string | null; hasCard: boolean };
type Resolve = (facts: Facts) => { month: string; advance: string };
let resolveInitialMonth: Resolve;
beforeAll(async () => {
  const loaded = (await import(/* @vite-ignore */ pathToFileURL(resolve(__dirname, "initial-month.mjs")).href)) as { resolveInitialMonth: Resolve };
  resolveInitialMonth = loaded.resolveInitialMonth;
});

/**
 * Paridade stub x API (ADR 0007 secao 10, S8): o stub espelha `resolveInitialMonth` do dominio. Os dois lados leem a MESMA
 * fixture (`api/test/fixtures/initial-month.cases.json`); se a regra mudar na api e o stub nao acompanhar, este teste quebra.
 */
interface Case extends Facts {
  ca: string;
  name: string;
  month: string;
  advance: string;
}
const cases = JSON.parse(readFileSync(resolve(__dirname, "../../../api/test/fixtures/initial-month.cases.json"), "utf8")) as Case[];

describe("stub-api/initial-month.mjs - paridade com a regra de dominio (RF01, CA01-CA21)", () => {
  it("a fixture compartilhada cobre CA01 a CA21 e RFH01", () => {
    const covered = new Set(cases.map((c) => c.ca));
    for (let n = 1; n <= 21; n++) expect(covered.has(`CA${String(n).padStart(2, "0")}`), `CA${n}`).toBe(true);
    expect(covered.has("RFH01")).toBe(true);
  });

  it.each(cases.map((c) => [`${c.ca}: ${c.name}`, c] as const))("%s", (_name, c) => {
    expect(resolveInitialMonth({
      currentMonth: c.currentMonth,
      firstPendingMonth: c.firstPendingMonth,
      oldestPendingCardMonth: c.oldestPendingCardMonth,
      hasCard: c.hasCard,
    })).toEqual({ month: c.month, advance: c.advance });
  });

  it("firstPendingMonth anterior a M e erro de programacao, como no dominio", () => {
    expect(() => resolveInitialMonth({ currentMonth: "2026-10", firstPendingMonth: "2026-09", oldestPendingCardMonth: null, hasCard: true })).toThrow();
    expect(resolveInitialMonth({ currentMonth: "2026-11", firstPendingMonth: null, oldestPendingCardMonth: "2026-10", hasCard: true })).toEqual({
      month: "2026-10",
      advance: "NONE",
    });
  });
});
