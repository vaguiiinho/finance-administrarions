import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("./endpoints", () => ({ listCards: vi.fn(), listCategories: vi.fn(), getSummary: vi.fn() }));

import { notFound, redirect } from "next/navigation";
import { ApiError } from "./http";
import { settle } from "./queries";

function capture(fn: () => never): unknown {
  try {
    fn();
  } catch (error) {
    return error;
  }
  throw new Error("nao lancou");
}

describe("settle (ADR 9.4: unstable_rethrow)", () => {
  it("erro de API comum vira { ok: false } (comportamento atual)", async () => {
    expect(await settle(Promise.reject(new ApiError(500, "INTERNAL_ERROR", "x", null)))).toEqual({ ok: false });
  });
  it("sucesso", async () => {
    expect(await settle(Promise.resolve(1))).toEqual({ ok: true, data: 1 });
  });
  it("NEXT_REDIRECT NAO e engolido", async () => {
    const error = capture(() => redirect("/login"));
    await expect(settle(Promise.reject(error))).rejects.toBe(error);
  });
  it("NEXT_NOT_FOUND NAO e engolido", async () => {
    const error = capture(() => notFound());
    await expect(settle(Promise.reject(error))).rejects.toBe(error);
  });
});
