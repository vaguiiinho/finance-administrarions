import { describe, expect, it } from "vitest";
import { settleAction } from "./safe-action";
import { invalidInput, isUuid, isYearMonthString } from "./validate";

describe("validacao de identificadores", () => {
  it("isUuid aceita UUID e rejeita traversal, vazios e nao-strings", () => {
    expect(isUuid("0192f1e2-0000-7000-8000-000000000001")).toBe(true);
    for (const bad of ["../cards/0192f1e2-0000-7000-8000-000000000001/invoices/2026-10", "", "abc", "0192f1e2-0000-7000-8000-00000000000g", 1, null, undefined]) expect(isUuid(bad)).toBe(false);
  });
  it("isYearMonthString", () => {
    expect(isYearMonthString("2026-10")).toBe(true);
    for (const bad of ["2026-13", "2026-1", "2026-10/../x", "", 202610, undefined]) expect(isYearMonthString(bad)).toBe(false);
  });
  it("invalidInput devolve 400 no formato de erro de campo", () => {
    expect(invalidInput("id")).toMatchObject({ ok: false, error: { status: 400, code: "VALIDATION_ERROR", fields: [{ field: "id" }] } });
  });
});

describe("settleAction", () => {
  it("repassa o resultado e converte rejeicao em erro generico (nunca fica ocupado)", async () => {
    expect(await settleAction(async () => ({ ok: true as const, data: 1 }))).toEqual({ ok: true, data: 1 });
    const result = await settleAction(async () => {
      throw new Error("transporte");
    });
    expect(result).toMatchObject({ ok: false, error: { status: 0, code: "NETWORK_ERROR" } });
  });
});
