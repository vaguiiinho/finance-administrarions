import { afterEach, describe, expect, it, vi } from "vitest";
import { currentYearMonthSP, formatCivilDate, formatInstant, monthLabelPtBR, monthLongPtBR } from "./format";

const originalTz = process.env.TZ;
afterEach(() => {
  vi.useRealTimers();
  process.env.TZ = originalTz;
});

describe("formatCivilDate (CA23/CA67): split de string, sem fuso", () => {
  it.each(["UTC", "America/Sao_Paulo", "Pacific/Kiritimati", "Pacific/Pago_Pago"])(
    "2026-10-31 -> 31/10/2026 com TZ=%s",
    (tz) => {
      process.env.TZ = tz;
      expect(formatCivilDate("2026-10-31")).toBe("31/10/2026");
      expect(formatCivilDate("2026-11-05")).toBe("05/11/2026");
      expect(formatCivilDate("2026-01-01")).toBe("01/01/2026");
      expect(formatCivilDate("2028-02-29")).toBe("29/02/2028");
    },
  );
});

describe("formatInstant: America/Sao_Paulo (design 1.7)", () => {
  it("2026-10-24T13:00:00.000Z -> 24/10/2026 as 10:00", () => {
    expect(formatInstant("2026-10-24T13:00:00.000Z")).toBe("24/10/2026 às 10:00");
  });
  it("independe do TZ do processo e vira o dia em SP", () => {
    process.env.TZ = "UTC";
    expect(formatInstant("2026-11-01T02:30:00.000Z")).toBe("31/10/2026 às 23:30");
  });
});

describe("currentYearMonthSP (CA61)", () => {
  it("2026-11-01T02:30:00Z ainda e outubro em Sao Paulo", () => {
    expect(currentYearMonthSP(new Date("2026-11-01T02:30:00.000Z"))).toBe("2026-10");
  });
  it("03:00Z ja e novembro (meia-noite em SP)", () => {
    expect(currentYearMonthSP(new Date("2026-11-01T03:00:00.000Z"))).toBe("2026-11");
  });
  it("virada de ano: 2027-01-01T02:59Z ainda e dezembro de 2026", () => {
    expect(currentYearMonthSP(new Date("2027-01-01T02:59:00.000Z"))).toBe("2026-12");
  });
  it("sem argumento usa o relogio atual (fake timers)", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-11-01T02:30:00.000Z"));
    expect(currentYearMonthSP()).toBe("2026-10");
  });
  it("nao depende do TZ do processo", () => {
    process.env.TZ = "Asia/Tokyo";
    expect(currentYearMonthSP(new Date("2026-11-01T02:30:00.000Z"))).toBe("2026-10");
  });
});

describe("rotulos de mes (tabela fixa pt-BR)", () => {
  const abbr = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];
  const long = ["janeiro", "fevereiro", "março", "abril", "maio", "junho", "julho", "agosto", "setembro", "outubro", "novembro", "dezembro"];

  it.each(abbr.map((a, i) => [i + 1, a]))("monthLabelPtBR mes %i -> %s/26", (n, a) => {
    expect(monthLabelPtBR(`2026-${String(n).padStart(2, "0")}`)).toBe(`${a}/26`);
  });
  it.each(long.map((l, i) => [i + 1, l]))("monthLongPtBR mes %i -> %s de 2026", (n, l) => {
    expect(monthLongPtBR(`2026-${String(n).padStart(2, "0")}`)).toBe(`${l} de 2026`);
  });
  it("exemplos do design", () => {
    expect(monthLabelPtBR("2026-11")).toBe("nov/26");
    expect(monthLongPtBR("2026-11")).toBe("novembro de 2026");
    expect(monthLabelPtBR("2027-01")).toBe("jan/27");
  });
});
