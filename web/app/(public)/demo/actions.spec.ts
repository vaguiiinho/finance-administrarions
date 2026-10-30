import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
const reader = vi.hoisted(() => ({ listInvoiceEntries: vi.fn() }));
const factory = vi.hoisted(() => ({ createFinanceReader: vi.fn() }));
vi.mock("@/lib/api/finance-reader", () => factory);
const cookie = vi.hoisted(() => ({ readSessionToken: vi.fn(), clearSessionCookie: vi.fn() }));
vi.mock("@/lib/auth/session-cookie", () => cookie);
vi.mock("next/headers", () => ({ headers: async () => ({ get: () => null }) }));

import { loadDemoInvoiceEntries } from "./actions";

const CARD = "0192f1e2-0000-7000-8000-000000000001";

beforeEach(() => {
  reader.listInvoiceEntries.mockReset().mockResolvedValue({ card: { id: CARD, name: "Nubank" }, referenceMonth: "2026-11", items: [] });
  factory.createFinanceReader.mockReset().mockReturnValue(reader);
  cookie.readSessionToken.mockReset();
});

describe("loadDemoInvoiceEntries (ADR 9.5, RF29)", () => {
  it("le pelo reader 'demo' e nunca consulta o cookie", async () => {
    const r = await loadDemoInvoiceEntries(CARD, "2026-11");
    expect(factory.createFinanceReader).toHaveBeenCalledWith("demo");
    expect(reader.listInvoiceEntries).toHaveBeenCalledWith(CARD, "2026-11");
    expect(cookie.readSessionToken).not.toHaveBeenCalled();
    expect(r).toMatchObject({ ok: true });
  });
  it("valida cartao e mes antes de chamar", async () => {
    expect(await loadDemoInvoiceEntries("../x", "2026-11")).toMatchObject({ ok: false, error: { status: 400 } });
    expect(await loadDemoInvoiceEntries(CARD, "2026-11/../x")).toMatchObject({ ok: false, error: { status: 400 } });
    expect(reader.listInvoiceEntries).not.toHaveBeenCalled();
  });
  it("falha da API vira erro serializavel", async () => {
    const { ApiError } = await import("@/lib/api/http");
    reader.listInvoiceEntries.mockRejectedValue(new ApiError(500, "INTERNAL_ERROR", "x", null));
    expect(await loadDemoInvoiceEntries(CARD, "2026-11")).toMatchObject({ ok: false, error: { status: 500 } });
  });
});
