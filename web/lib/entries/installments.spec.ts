import { describe, expect, it } from "vitest";
import { previewInstallments } from "./installments";

describe("previewInstallments", () => {
  it("distributes remainder cents to first installments and preserves total", () => {
    expect(previewInstallments("350.00", 6, "2026-11-15")?.map((item) => item.amount)).toEqual([
      "58.34",
      "58.34",
      "58.33",
      "58.33",
      "58.33",
      "58.33",
    ]);
  });

  it("clamps dates in short months without shifting the original day", () => {
    expect(previewInstallments("4.00", 4, "2026-01-31")?.map((item) => item.date)).toEqual([
      "2026-01-31",
      "2026-02-28",
      "2026-03-31",
      "2026-04-30",
    ]);
  });

  it("does not produce preview for invalid minimum amount or count", () => {
    expect(previewInstallments("0.02", 3, "2026-11-15")).toBeNull();
    expect(previewInstallments("10.00", 1, "2026-11-15")).toBeNull();
  });
});
