import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { AllProviders, router } from "@/test/helpers/providers";
import { AppModeProvider, DEMO_MODE, PROTECTED_MODE, type AppMode } from "@/components/app-mode";
import { parseEntriesSearchParams } from "@/lib/filters/entries-search-params";
import type { CardDto, EntryDto, InvoiceDto } from "@/lib/api/types";

// CA38 (RF30, RF31): na demo nenhum elemento de escrita existe no DOM (nem desabilitado) e nenhuma Server Action de escrita roda.
const writes = vi.hoisted(() => ({ payEntries: vi.fn(), payEntry: vi.fn(), payInvoice: vi.fn(), loadInvoiceEntries: vi.fn(), createEntry: vi.fn(), createCard: vi.fn(), updateCard: vi.fn(), loadDemoInvoiceEntries: vi.fn() }));
vi.mock("@/app/(protected)/entries/actions", () => ({ payEntries: writes.payEntries, payEntry: writes.payEntry, payInvoice: writes.payInvoice, loadInvoiceEntries: writes.loadInvoiceEntries, createEntry: writes.createEntry }));
vi.mock("@/app/(protected)/cards/actions", () => ({ createCard: writes.createCard, updateCard: writes.updateCard }));
vi.mock("@/app/(public)/demo/actions", () => ({ loadDemoInvoiceEntries: writes.loadDemoInvoiceEntries }));
vi.mock("next/navigation", () => ({ useRouter: () => router, usePathname: () => "/demo/entries" }));
vi.mock("next/link", () => ({ default: ({ children, href, scroll, prefetch, ...rest }: { children: ReactNode; href: string; scroll?: boolean; prefetch?: boolean } & Record<string, unknown>) => (void scroll, void prefetch, (<a href={href} {...rest}>{children}</a>)) }));

import { CardsList } from "../../cards/_components/cards-list";
import { CardDrawerProvider, NewCardButton } from "../../cards/_components/card-drawer";
import { ExpensesList } from "./expenses-list";
import { EntryDrawerProvider, NewEntryButton } from "./entry-drawer-context";
import { InvoiceBlock } from "./invoice-block";

const CARD_ID = "0192f1e2-0000-7000-8000-000000000001";
const entry = (id: string, description: string, over: Partial<EntryDto> = {}): EntryDto => ({
  id, type: "EXPENSE", description, category: "Moradia", date: "2026-10-15", amount: "80.00", paymentMethod: "PIX", card: null, invoice: null,
  referenceMonth: "2026-10", status: "PENDING", paidAt: null, createdAt: "", updatedAt: "", ...over,
});
const ITEMS = [entry("e2", "Internet"), entry("e3", "Aluguel", { status: "PAID", paidAt: "2026-10-02T13:00:00.000Z" })];
const CARD: CardDto = { id: CARD_ID, name: "Nubank", closingDay: 25, dueDay: 5, createdAt: "", updatedAt: "" };
const state = parseEntriesSearchParams({ month: "2026-11", tab: "invoices" }, new Date("2026-10-24T13:00:00.000Z"));
const invoice: InvoiceDto = { card: { id: CARD_ID, name: "Nubank" }, referenceMonth: "2026-11", closingDate: "2026-10-25", dueDate: "2026-11-05", entryCount: 2, pendingCount: 2, totals: { total: "150.00", paid: "0.00", pending: "150.00" } };

const inMode = (mode: AppMode, ui: ReactNode) =>
  render(
    <AppModeProvider mode={mode}>
      <AllProviders>
        <EntryDrawerProvider>
          <CardDrawerProvider>{ui}</CardDrawerProvider>
        </EntryDrawerProvider>
      </AllProviders>
    </AppModeProvider>,
  );

beforeEach(() => {
  Object.values(writes).forEach((f) => f.mockReset());
  writes.loadInvoiceEntries.mockResolvedValue({ ok: false, error: { status: 500, code: "INTERNAL_ERROR", message: "x" } });
});

describe("demo: lista de despesas sem escrita (CA38)", () => {
  it("sem checkbox (nem 'selecionar todas'), sem 'Pagar'/'Marcar como pago', sem barra de lote; descricao e status continuam", () => {
    inMode(DEMO_MODE, <ExpensesList items={ITEMS} panelTitleId="t" />);
    expect(screen.queryAllByRole("checkbox", { hidden: true })).toHaveLength(0);
    expect(screen.queryAllByRole("button", { name: /pago|Pagar|Selecionar/i, hidden: true })).toHaveLength(0);
    expect(screen.queryByText(/Selecionar pendentes/)).not.toBeInTheDocument();
    expect(screen.getAllByText("Internet").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Pendente").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Pago").length).toBeGreaterThan(0);
  });

  it("controle: no modo protegido os mesmos elementos existem (o teste detecta a diferenca)", () => {
    inMode(PROTECTED_MODE, <ExpensesList items={ITEMS} panelTitleId="t" />);
    expect(screen.queryAllByRole("checkbox", { hidden: true }).length).toBeGreaterThan(0);
  });
});

describe("demo: faturas (CA38)", () => {
  it("sem 'Pagar fatura'; total e status aparecem", () => {
    inMode(DEMO_MODE, <InvoiceBlock invoice={invoice} state={state} />);
    expect(screen.queryByRole("button", { name: /Pagar fatura/ })).not.toBeInTheDocument();
    expect(screen.getByRole("group", { name: "Nubank" })).toBeInTheDocument();
  });

  it("expandir funciona e usa loadDemoInvoiceEntries (nunca a action protegida)", async () => {
    writes.loadDemoInvoiceEntries.mockResolvedValue({ ok: true, data: { items: [entry("e9", "Mercado", { paymentMethod: "CARD", card: { id: CARD_ID, name: "Nubank" } })] } });
    inMode(DEMO_MODE, <InvoiceBlock invoice={invoice} state={state} />);
    await userEvent.click(screen.getByRole("button", { name: /^Ver .* da fatura Nubank/ }));
    expect(await screen.findByText("Mercado")).toBeInTheDocument();
    expect(writes.loadDemoInvoiceEntries).toHaveBeenCalledWith(CARD_ID, "2026-11");
    expect(writes.loadInvoiceEntries).not.toHaveBeenCalled();
  });
});

describe("demo: cartoes e botoes de criacao (CA38)", () => {
  it("sem 'Editar <cartao>'; nome, fechamento e vencimento aparecem; atalho de despesas aponta para /demo/entries", () => {
    inMode(DEMO_MODE, <CardsList cards={[CARD]} currentMonth="2026-10" />);
    expect(screen.queryByRole("button", { name: /Editar/ })).not.toBeInTheDocument();
    expect(screen.getByText("Nubank")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Ver despesas de Nubank/ }).getAttribute("href")).toMatch(/^\/demo\/entries\?/);
  });

  it("'+ Novo cartao' e 'Novo lancamento' nao sao renderizados", () => {
    const { container } = inMode(
      DEMO_MODE,
      <>
        <NewCardButton />
        <NewEntryButton />
      </>,
    );
    expect(within(container).queryAllByRole("button")).toHaveLength(0);
  });

  it("nenhuma action de escrita foi chamada durante a renderizacao", () => {
    inMode(DEMO_MODE, <><ExpensesList items={ITEMS} panelTitleId="t" /><CardsList cards={[CARD]} currentMonth="2026-10" /><InvoiceBlock invoice={invoice} state={state} /></>);
    for (const name of ["payEntries", "payEntry", "payInvoice", "createEntry", "createCard", "updateCard"] as const) expect(writes[name]).not.toHaveBeenCalled();
  });
});
