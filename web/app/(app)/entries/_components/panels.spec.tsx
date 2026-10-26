import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { AllProviders, router } from "@/test/helpers/providers";
import { parseEntriesSearchParams } from "@/lib/filters/entries-search-params";
import type { CardDto, EntryDto, InvoiceDto } from "@/lib/api/types";

vi.mock("server-only", () => ({}));
const ep = vi.hoisted(() => ({ listExpenses: vi.fn(), listIncomes: vi.fn(), listInvoices: vi.fn(), listCards: vi.fn(), listCategories: vi.fn(), getSummary: vi.fn() }));
vi.mock("@/lib/api/endpoints", () => ep);
vi.mock("../actions", () => ({ payEntries: vi.fn(), payEntry: vi.fn(), payInvoice: vi.fn(), loadInvoiceEntries: vi.fn(), createEntry: vi.fn() }));
vi.mock("next/navigation", () => ({ useRouter: () => router, usePathname: () => "/entries" }));
vi.mock("next/link", () => ({ default: ({ children, href, scroll, ...rest }: { children: ReactNode; href: string; scroll?: boolean } & Record<string, unknown>) => (void scroll, (<a href={href} {...rest}>{children}</a>)) }));

import { ApiError } from "@/lib/api/http";
import { EntryDrawerProvider } from "./entry-drawer-context";
import { ExpensesPanel } from "./expenses-panel";
import { IncomePanel } from "./income-panel";
import { InvoicesPanel } from "./invoices-panel";
import { ExpenseFilters, IncomeFilter } from "./expense-filters";
import { EntriesTabsBar } from "./entries-tabs-bar";
import { ExpensesSubtotal, IncomeSubtotal } from "./tab-subtotal";
import { ListPanelSkeleton, InvoicesPanelSkeleton } from "./panel-skeletons";
import { MonthNotice } from "./month-notice";

const NOW = new Date("2026-10-24T13:00:00.000Z");
const st = (raw: Record<string, string> = {}) => parseEntriesSearchParams({ month: "2026-11", ...raw }, NOW);
const wrap = (ui: ReactNode) => render(<AllProviders><EntryDrawerProvider>{ui}</EntryDrawerProvider></AllProviders>);
const nbsp = (s: string | null) => (s ?? "").replace(/ /g, " ");

const NUBANK: CardDto = { id: "0192f1e2-0000-7000-8000-000000000001", name: "Nubank", closingDay: 25, dueDay: 5, createdAt: "", updatedAt: "" };
const entry = (over: Partial<EntryDto> = {}): EntryDto => ({
  id: "e1", type: "EXPENSE", description: "Internet", category: "Moradia", date: "2026-11-10", amount: "80.00", paymentMethod: "PIX", card: null, invoice: null,
  referenceMonth: "2026-11", status: "PENDING", paidAt: null, createdAt: "", updatedAt: "", ...over,
});
const pagination = (totalItems: number, page = 1) => ({ page, pageSize: 20, totalItems, totalPages: Math.max(1, Math.ceil(totalItems / 20)) });
const sub = { total: "80.00", paid: "0.00", pending: "80.00" };

beforeEach(() => {
  Object.values(ep).forEach((f) => f.mockReset());
  ep.listCategories.mockResolvedValue({ items: ["Moradia"] });
  ep.listCards.mockResolvedValue({ items: [NUBANK] });
  router.push.mockClear();
  router.refresh.mockClear();
});

describe("ExpensesPanel (RF20, 3.12)", () => {
  it("lista com subtotal da API e consulta E2 com os filtros da URL mapeados", async () => {
    ep.listExpenses.mockResolvedValue({ month: "2026-11", items: [entry()], pagination: pagination(1), subtotal: sub });
    wrap(await ExpensesPanel({ state: st({ d_status: "PENDING", d_card: "pix" }) }));
    expect(ep.listExpenses).toHaveBeenCalledWith({ month: "2026-11", status: "PENDING", cardId: "pix" });
    expect(screen.getByText("Subtotal · com os filtros aplicados")).toBeInTheDocument();
    expect(nbsp(screen.getByTestId("subtotal").textContent)).toContain("Total R$ 80,00");
    expect(screen.getAllByText("Internet").length).toBeGreaterThan(0);
    expect(screen.getByText(/Mostrando 1 despesa de novembro de 2026, pendentes, PIX/)).toBeInTheDocument();
  });

  it("vazio sem filtros e vazio com filtros", async () => {
    ep.listExpenses.mockResolvedValue({ month: "2026-11", items: [], pagination: pagination(0), subtotal: { total: "0.00", paid: "0.00", pending: "0.00" } });
    const a = wrap(await ExpensesPanel({ state: st() }));
    expect(screen.getByText("Nenhuma despesa em novembro de 2026")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "+ Novo lançamento" })).toBeInTheDocument();
    a.unmount();
    wrap(await ExpensesPanel({ state: st({ d_category: "Moradia" }) }));
    expect(screen.getByText("Nenhuma despesa para os filtros selecionados em novembro de 2026")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Limpar filtros" })).toHaveAttribute("href", "/entries?month=2026-11");
  });

  it("cartao inexistente no filtro e pagina alem do fim", async () => {
    ep.listExpenses.mockResolvedValue({ month: "2026-11", items: [], pagination: pagination(0), subtotal: sub });
    const a = wrap(await ExpensesPanel({ state: st({ d_card: "0192f1e2-0000-7000-8000-0000000000ff" }) }));
    expect(screen.getByText("Este cartão não foi encontrado.")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Remover filtro de cartão" })).toBeInTheDocument();
    expect(screen.getByRole("option", { name: "Cartão não encontrado" })).toBeInTheDocument();
    a.unmount();
    ep.listExpenses.mockResolvedValue({ month: "2026-11", items: [], pagination: pagination(25, 5), subtotal: sub });
    wrap(await ExpensesPanel({ state: st({ page: "5" }) }));
    expect(screen.getByText("Esta página não existe.")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Ir para a última página" })).toHaveAttribute("href", "/entries?month=2026-11&page=2");
  });

  it("400 por URL editada vira 'Os filtros da URL são inválidos.'; outros erros propagam para a fronteira", async () => {
    ep.listExpenses.mockRejectedValue(new ApiError(400, "VALIDATION_ERROR", "x", null));
    wrap(await ExpensesPanel({ state: st() }));
    expect(screen.getByRole("alert")).toHaveTextContent("Os filtros da URL são inválidos.");
    ep.listExpenses.mockRejectedValue(new ApiError(500, "INTERNAL_ERROR", "x", null));
    await expect(ExpensesPanel({ state: st() })).rejects.toThrow();
  });

  it("categorias/cartoes indisponiveis: lista funciona e filtros avisam com 'Tentar novamente'", async () => {
    ep.listExpenses.mockResolvedValue({ month: "2026-11", items: [entry()], pagination: pagination(1), subtotal: sub });
    ep.listCategories.mockRejectedValue(new Error("x"));
    ep.listCards.mockRejectedValue(new Error("x"));
    wrap(await ExpensesPanel({ state: st() }));
    expect(screen.getByText(/Não foi possível carregar as categorias/)).toBeInTheDocument();
    expect(screen.getByText(/Não foi possível carregar os cartões/)).toBeInTheDocument();
    await userEvent.click(screen.getAllByRole("button", { name: "Tentar novamente" })[0]);
    expect(router.refresh).toHaveBeenCalled();
  });
});

describe("filtros de Despesas e Receitas (D6, D19)", () => {
  const cards = [NUBANK];
  it("inline: mudar status/categoria/cartao navega mantendo mes e aba, sem pagina; 'Limpar filtros' so com filtro ativo", async () => {
    wrap(<ExpenseFilters state={st({ page: "3", r_category: "Salário" })} categories={["Moradia"]} categoriesError={false} cards={cards} cardsError={false} />);
    expect(screen.queryByRole("button", { name: "Limpar filtros" })).not.toBeInTheDocument();
    await userEvent.click(screen.getAllByRole("radio", { name: "Pago" })[0]);
    expect(router.push).toHaveBeenLastCalledWith("/entries?month=2026-11&d_status=PAID&r_category=Sal%C3%A1rio", { scroll: false });
    await userEvent.selectOptions(screen.getAllByLabelText("Categoria")[0], "Moradia");
    expect(router.push.mock.lastCall![0]).toContain("d_category=Moradia");
    await userEvent.selectOptions(screen.getAllByLabelText("Cartão")[0], "pix");
    expect(router.push.mock.lastCall![0]).toContain("d_card=pix");
  });

  it("limpar filtros volta ao padrao sem mexer no mes", async () => {
    wrap(<ExpenseFilters state={st({ d_status: "PENDING", d_category: "Moradia" })} categories={["Moradia"]} categoriesError={false} cards={cards} cardsError={false} />);
    await userEvent.click(screen.getAllByRole("button", { name: "Limpar filtros" })[0]);
    expect(router.push).toHaveBeenLastCalledWith("/entries?month=2026-11", { scroll: false });
  });

  it("mobile: 'Filtros (n)' abre a folha e so 'Aplicar' navega", async () => {
    wrap(<ExpenseFilters state={st({ d_status: "PENDING" })} categories={["Moradia"]} categoriesError={false} cards={cards} cardsError={false} />);
    await userEvent.click(screen.getByRole("button", { name: "Filtros (1)" }));
    const sheet = within(screen.getByRole("dialog"));
    await userEvent.click(sheet.getByRole("radio", { name: "Pago" }));
    expect(router.push).not.toHaveBeenCalled();
    await userEvent.click(sheet.getByRole("button", { name: "Aplicar" }));
    expect(router.push).toHaveBeenLastCalledWith("/entries?month=2026-11&d_status=PAID", { scroll: false });
  });

  it("Receitas: categoria aplica ao mudar e 'Limpar filtro' remove", async () => {
    wrap(<IncomeFilter state={st({ tab: "income", r_category: "Salário" })} categories={["Moradia"]} categoriesError />);
    expect(screen.getByRole("option", { name: "Salário" })).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Limpar filtro" }));
    expect(router.push).toHaveBeenLastCalledWith("/entries?month=2026-11&tab=income", { scroll: false });
    await userEvent.click(screen.getByRole("button", { name: "Tentar novamente" }));
    expect(router.refresh).toHaveBeenCalled();
  });
});

describe("IncomePanel (RF22, CA71)", () => {
  const income = entry({ id: "i1", type: "INCOME", description: "Salário", category: "Salário", status: "RECEIVED", amount: "5000.00" });
  it("sem selecao nem acao; subtotal so com total; badge Recebida", async () => {
    ep.listIncomes.mockResolvedValue({ month: "2026-11", items: [income], pagination: pagination(1), subtotal: { total: "5000.00" } });
    wrap(await IncomePanel({ state: st({ tab: "income" }) }));
    expect(screen.queryByRole("checkbox")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Marcar/ })).not.toBeInTheDocument();
    expect(screen.getAllByText("Recebida").length).toBeGreaterThan(0);
    expect(nbsp(screen.getByTestId("subtotal").textContent)).toContain("Total R$ 5.000,00");
  });
  it("vazios: sem filtro, com categoria, pagina inexistente, 400", async () => {
    ep.listIncomes.mockResolvedValue({ month: "2026-11", items: [], pagination: pagination(0), subtotal: { total: "0.00" } });
    const a = wrap(await IncomePanel({ state: st({ tab: "income" }) }));
    expect(screen.getByText("Nenhuma receita em novembro de 2026")).toBeInTheDocument();
    a.unmount();
    const b = wrap(await IncomePanel({ state: st({ tab: "income", r_category: "Freela" }) }));
    expect(screen.getByText("Nenhuma receita na categoria Freela em novembro de 2026")).toBeInTheDocument();
    b.unmount();
    ep.listIncomes.mockResolvedValue({ month: "2026-11", items: [], pagination: pagination(30, 4), subtotal: { total: "0.00" } });
    const c = wrap(await IncomePanel({ state: st({ tab: "income", page: "4" }) }));
    expect(screen.getByText("Esta página não existe.")).toBeInTheDocument();
    c.unmount();
    ep.listIncomes.mockRejectedValue(new ApiError(400, "VALIDATION_ERROR", "x", null));
    wrap(await IncomePanel({ state: st({ tab: "income" }) }));
    expect(screen.getByRole("alert")).toHaveTextContent("Os filtros da URL são inválidos.");
  });
});

describe("InvoicesPanel (RF21, DR5)", () => {
  const inv: InvoiceDto = { card: { id: NUBANK.id, name: "Nubank" }, referenceMonth: "2026-11", closingDate: "2026-10-25", dueDate: "2026-11-05", entryCount: 2, pendingCount: 2, totals: { total: "150.00", paid: "0.00", pending: "150.00" } };
  it("um bloco por fatura, contagem e ajuda", async () => {
    ep.listInvoices.mockResolvedValue({ month: "2026-11", items: [inv] });
    wrap(await InvoicesPanel({ state: st({ tab: "invoices" }) }));
    expect(screen.getByRole("group", { name: "Nubank" })).toBeInTheDocument();
    expect(screen.getByText(/Cada fatura aparece no mês em que vence/)).toBeInTheDocument();
  });
  it("vazio; com 'Cadastrar cartão' quando nao ha cartoes", async () => {
    ep.listInvoices.mockResolvedValue({ month: "2026-11", items: [] });
    const a = wrap(await InvoicesPanel({ state: st({ tab: "invoices" }) }));
    expect(screen.getByText("Nenhuma fatura neste mês")).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Cadastrar cartão" })).not.toBeInTheDocument();
    a.unmount();
    ep.listCards.mockResolvedValue({ items: [] });
    wrap(await InvoicesPanel({ state: st({ tab: "invoices" }) }));
    expect(screen.getByRole("link", { name: "Cadastrar cartão" })).toHaveAttribute("href", "/cards");
  });
});

describe("EntriesTabsBar, subtotais, skeletons, aviso de mes", () => {
  it("abas mantem mes e filtros; faixa compacta so aparece quando o cabecalho sai da vista", async () => {
    let cb: IntersectionObserverCallback = () => {};
    vi.stubGlobal("IntersectionObserver", class { constructor(c: IntersectionObserverCallback) { cb = c; } observe() {} disconnect() {} });
    const sentinel = document.createElement("div");
    sentinel.id = "entries-header-controls";
    document.body.appendChild(sentinel);
    wrap(<EntriesTabsBar state={st({ d_status: "PAID" })} currentMonth="2026-10" />);
    expect(screen.getByRole("tab", { name: "Faturas" })).toHaveAttribute("href", "/entries?month=2026-11&tab=invoices&d_status=PAID");
    expect(screen.queryByRole("button", { name: "Próximo mês" })).not.toBeInTheDocument();
    const { act } = await import("@testing-library/react");
    act(() => cb([{ isIntersecting: false, boundingClientRect: { bottom: -10 } } as IntersectionObserverEntry], {} as IntersectionObserver));
    expect(screen.getByRole("button", { name: "Próximo mês" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "+ Novo lançamento" })).toBeInTheDocument();
    sentinel.remove();
    vi.unstubAllGlobals();
  });

  it("subtotais, skeletons e aviso de mes invalido", () => {
    wrap(
      <>
        <ExpensesSubtotal count={1} totals={sub} filtered={false} />
        <IncomeSubtotal count={2} total="10.00" filtered />
        <ListPanelSkeleton />
        <InvoicesPanelSkeleton />
        <MonthNotice />
      </>,
    );
    expect(screen.getByText("Subtotal · todas as despesas do mês")).toBeInTheDocument();
    expect(screen.getByText("Subtotal · com o filtro aplicado")).toBeInTheDocument();
    expect(screen.getByText("Carregando faturas")).toBeInTheDocument();
    expect(screen.getByText("Mês inválido na URL. Mostrando o mês atual.")).toBeInTheDocument();
  });
});
