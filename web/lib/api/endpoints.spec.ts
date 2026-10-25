import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
const http = vi.hoisted(() => ({ apiGet: vi.fn(), apiPost: vi.fn(), apiPut: vi.fn() }));
vi.mock("./http", () => http);

import { listInvoiceEntries, payEntryRequest, payInvoiceRequest, updateCardRequest } from "./endpoints";

beforeEach(() => Object.values(http).forEach((f) => f.mockReset()));

describe("endpoints: segmentos de caminho codificados (anti path injection)", () => {
  const evil = "../cards/0192f1e2-0000-7000-8000-000000000001/invoices/2026-10";
  it("payEntry / updateCard / invoice entries / pay invoice", () => {
    payEntryRequest(evil);
    expect(http.apiPost).toHaveBeenCalledWith(`/entries/${encodeURIComponent(evil)}/pay`);
    expect(http.apiPost.mock.calls[0][0]).not.toContain("../");
    updateCardRequest(evil, { name: "x", closingDay: 1, dueDay: 2 });
    expect(http.apiPut.mock.calls[0][0]).toBe(`/cards/${encodeURIComponent(evil)}`);
    listInvoiceEntries(evil, "2026-10/../x");
    expect(http.apiGet.mock.calls[0][0]).toBe(`/cards/${encodeURIComponent(evil)}/invoices/${encodeURIComponent("2026-10/../x")}/entries`);
    payInvoiceRequest("0192f1e2-0000-7000-8000-000000000001", "2026-10");
    expect(http.apiPost).toHaveBeenLastCalledWith("/cards/0192f1e2-0000-7000-8000-000000000001/invoices/2026-10/pay");
  });
});
