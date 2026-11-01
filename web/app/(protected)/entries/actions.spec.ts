import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
const ep = vi.hoisted(() => ({
  createEntryRequest: vi.fn(), createInstallmentExpensesRequest: vi.fn(), payEntryRequest: vi.fn(), payEntriesRequest: vi.fn(), payInvoiceRequest: vi.fn(), listInvoiceEntries: vi.fn(),
  createCardRequest: vi.fn(), updateCardRequest: vi.fn(),
}));
vi.mock("@/lib/api/endpoints", () => ep);

import { revalidatePath } from "next/cache";
import { createEntry, createInstallmentExpenses, loadInvoiceEntries, payEntries, payEntry, payInvoice } from "./actions";
import { createCard, updateCard } from "../cards/actions";

const ID = "0192f1e2-0000-7000-8000-000000000001";
const EVIL = "../cards/0192f1e2-0000-7000-8000-000000000001/invoices/2026-10";

beforeEach(() => {
  Object.values(ep).forEach((f) => f.mockReset());
  vi.mocked(revalidatePath).mockClear();
});

describe("Server Actions de lancamentos: validacao de ids antes de chamar a API", () => {
  it("payEntry rejeita id fora do formato UUID com 400 e NAO chama a API", async () => {
    expect(await payEntry(EVIL)).toMatchObject({ ok: false, error: { status: 400 } });
    expect(ep.payEntryRequest).not.toHaveBeenCalled();
  });
  it("payEntries rejeita qualquer id invalido", async () => {
    expect(await payEntries([ID, EVIL])).toMatchObject({ ok: false, error: { status: 400 } });
    expect(await payEntries("x" as unknown as string[])).toMatchObject({ ok: false, error: { status: 400 } });
    expect(ep.payEntriesRequest).not.toHaveBeenCalled();
  });
  it("payInvoice e loadInvoiceEntries validam cartao e mes", async () => {
    expect(await payInvoice(EVIL, "2026-10")).toMatchObject({ ok: false, error: { status: 400 } });
    expect(await payInvoice(ID, "2026-10/../x")).toMatchObject({ ok: false, error: { status: 400 } });
    expect(await loadInvoiceEntries(EVIL, "2026-10")).toMatchObject({ ok: false, error: { status: 400 } });
    expect(await loadInvoiceEntries(ID, "2026-13")).toMatchObject({ ok: false, error: { status: 400 } });
    expect(ep.payInvoiceRequest).not.toHaveBeenCalled();
    expect(ep.listInvoiceEntries).not.toHaveBeenCalled();
  });
  it("updateCard valida o id", async () => {
    expect(await updateCard(EVIL, { name: "x", closingDay: 1, dueDay: 2 })).toMatchObject({ ok: false, error: { status: 400 } });
    expect(ep.updateCardRequest).not.toHaveBeenCalled();
  });
});

describe("Server Actions: caminho feliz e revalidacao", () => {
  it("entradas validas chamam a API e revalidam /entries e /dashboard", async () => {
    ep.payEntryRequest.mockResolvedValue({ id: ID });
    ep.payEntriesRequest.mockResolvedValue({ paidIds: [ID], alreadyPaidIds: [] });
    ep.payInvoiceRequest.mockResolvedValue({ paidCount: 1 });
    ep.listInvoiceEntries.mockResolvedValue({ items: [{ id: ID }] });
    ep.createEntryRequest.mockResolvedValue({ id: ID });
    ep.createInstallmentExpensesRequest.mockResolvedValue({ items: [{ id: ID }, { id: ID }] });
    expect(await payEntry(ID)).toMatchObject({ ok: true });
    expect(await payEntries([ID])).toMatchObject({ ok: true });
    expect(await payInvoice(ID, "2026-10")).toMatchObject({ ok: true });
    expect(await loadInvoiceEntries(ID, "2026-10")).toEqual({ ok: true, data: [{ id: ID }] });
    expect(await createEntry({ type: "INCOME", description: "x", category: "y", date: "2026-10-01", amount: "1.00", paymentMethod: "PIX" })).toMatchObject({ ok: true });
    expect(await createInstallmentExpenses({
      description: "Notebook", category: "Eletrônicos", date: "2026-11-01", amount: "350.00", installments: 6, paymentMethod: "PIX",
    })).toMatchObject({ ok: true, data: [{ id: ID }, { id: ID }] });
    expect(ep.createInstallmentExpensesRequest).toHaveBeenCalledWith({
      description: "Notebook", category: "Eletrônicos", date: "2026-11-01", amount: "350.00", installments: 6, paymentMethod: "PIX",
    });
    expect(revalidatePath).toHaveBeenCalledWith("/entries");
    expect(revalidatePath).toHaveBeenCalledWith("/dashboard");
  });
  it("cartoes revalidam /cards e /entries so em sucesso", async () => {
    ep.createCardRequest.mockResolvedValueOnce({ id: ID });
    expect(await createCard({ name: "x", closingDay: 1, dueDay: 2 })).toMatchObject({ ok: true });
    expect(revalidatePath).toHaveBeenCalledWith("/cards");
    vi.mocked(revalidatePath).mockClear();
    ep.updateCardRequest.mockRejectedValueOnce(new Error("boom"));
    expect(await updateCard(ID, { name: "x", closingDay: 1, dueDay: 2 })).toMatchObject({ ok: false, error: { status: 500 } });
    expect(revalidatePath).not.toHaveBeenCalled();
  });
});
