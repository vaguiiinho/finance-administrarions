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
vi.mock("@/app/(protected)/entries/actions", () => ({ payEntries: vi.fn(), payEntry: vi.fn(), payInvoice: vi.fn(), loadInvoiceEntries: vi.fn(), createEntry: vi.fn() }));
vi.mock("next/navigation", () => ({ useRouter: () => router, usePathname: () => "/entries", unstable_rethrow: () => {} }));
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

  it("vazio sem filtros (Todos, CA39) e vazio com filtros", async () => {
    ep.listExpenses.mockResolvedValue({ month: "2026-11", items: [], pagination: pagination(0), subtotal: { total: "0.00", paid: "0.00", pending: "0.00" } });
    const a = wrap(await ExpensesPanel({ state: st({ d_status: "ALL" }) }));
    expect(screen.getByText("Nenhuma despesa em novembro de 2026")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "+ Novo lançamento" })).toBeInTheDocument();
    a.unmount();
    wrap(await ExpensesPanel({ state: st({ d_status: "ALL", d_category: "Moradia" }) }));
    expect(screen.getByText("Nenhuma despesa para os filtros selecionados em novembro de 2026")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Limpar filtros" })).toHaveAttribute("href", "/entries?month=2026-11&d_status=ALL");
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
  it("inline: mudar status/categoria/cartao navega mantendo mes e aba, sem pagina; 'Limpar filtros' so enquanto algo difere de Todos (o padrao Pendente conta, RF11)", async () => {
    const view = wrap(<ExpenseFilters state={st({ d_status: "ALL", page: "3", r_category: "Salário" })} categories={["Moradia"]} categoriesError={false} cards={cards} cardsError={false} />);
    expect(screen.queryByRole("button", { name: "Limpar filtros" })).not.toBeInTheDocument();
    view.unmount();
    wrap(<ExpenseFilters state={st({ page: "3", r_category: "Salário" })} categories={["Moradia"]} categoriesError={false} cards={cards} cardsError={false} />);
    expect(screen.getAllByRole("button", { name: "Limpar filtros" }).length).toBeGreaterThan(0);
    await userEvent.click(screen.getAllByRole("radio", { name: "Pago" })[0]);
    expect(router.push).toHaveBeenLastCalledWith("/entries?month=2026-11&d_status=PAID&r_category=Sal%C3%A1rio", { scroll: false });
    await userEvent.selectOptions(screen.getAllByLabelText("Categoria")[0], "Moradia");
    expect(router.push.mock.lastCall![0]).toContain("d_category=Moradia");
    await userEvent.selectOptions(screen.getAllByLabelText("Cartão")[0], "pix");
    expect(router.push.mock.lastCall![0]).toContain("d_card=pix");
  });

  it("CA36: limpar filtros leva a Todos (d_status=ALL) e remove categoria/cartao, sem mexer no mes", async () => {
    wrap(<ExpenseFilters state={st({ d_status: "PENDING", d_category: "Moradia" })} categories={["Moradia"]} categoriesError={false} cards={cards} cardsError={false} />);
    await userEvent.click(screen.getAllByRole("button", { name: "Limpar filtros" })[0]);
    expect(router.push).toHaveBeenLastCalledWith("/entries?month=2026-11&d_status=ALL", { scroll: false });
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
    const a = wrap(await InvoicesPanel({ state: st({ tab: "invoices", f_status: "ALL" }) }));
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

describe("ExpensesPanel - status padrao Pendente (RF09, CA31, CA32, CA38, CA39)", () => {
  const empty = { month: "2026-11", items: [], pagination: pagination(0), subtotal: { total: "0.00", paid: "0.00", pending: "0.00" } };

  it("CA31: sem d_status a API recebe status=PENDING, a lista e o subtotal 'com os filtros aplicados' refletem o filtro", async () => {
    ep.listExpenses.mockResolvedValue({ month: "2026-11", items: [entry(), entry({ id: "e2" }), entry({ id: "e3" })], pagination: pagination(3), subtotal: { total: "300.00", paid: "0.00", pending: "300.00" } });
    wrap(await ExpensesPanel({ state: st() }));
    expect(ep.listExpenses).toHaveBeenCalledWith({ month: "2026-11", status: "PENDING" });
    expect(screen.getByText("Subtotal · com os filtros aplicados")).toBeInTheDocument();
    expect(nbsp(screen.getByTestId("subtotal").textContent)).toContain("Total R$ 300,00");
    expect(screen.getByText(/Mostrando 3 despesas de novembro de 2026, pendentes/)).toBeInTheDocument();
    expect(screen.getAllByRole("radio", { name: "Pendente" })[0]).toBeChecked();
  });

  it("CA33: 'Todos' (d_status=ALL) nao envia status e o subtotal vira 'todas as despesas do mes'", async () => {
    ep.listExpenses.mockResolvedValue({ month: "2026-11", items: [entry()], pagination: pagination(1), subtotal: sub });
    wrap(await ExpensesPanel({ state: st({ d_status: "ALL" }) }));
    expect(ep.listExpenses).toHaveBeenCalledWith({ month: "2026-11" });
    expect(screen.getByText("Subtotal · todas as despesas do mês")).toBeInTheDocument();
    expect(screen.getAllByRole("radio", { name: "Todos" })[0]).toBeChecked();
  });

  it("anuncio para leitor de tela: 'Todos' NAO e lido como 'pagas'; Pago e lido como 'pagas' (design 10.2, R8)", async () => {
    ep.listExpenses.mockResolvedValue({ month: "2026-11", items: [entry()], pagination: pagination(1), subtotal: sub });
    const a = wrap(await ExpensesPanel({ state: st({ d_status: "ALL" }) }));
    const live = () => document.querySelector('p.sr-only[aria-live="polite"]')!.textContent;
    expect(live()).toBe("Mostrando 1 despesa de novembro de 2026");
    a.unmount();
    wrap(await ExpensesPanel({ state: st({ d_status: "PAID" }) }));
    expect(live()).toBe("Mostrando 1 despesa de novembro de 2026, pagas");
  });

  it("CA38: padrao aplicado e mes so com despesas pagas -> vazio com filtros; descricao por status e 'Limpar filtros' -> Todos", async () => {
    ep.listExpenses.mockResolvedValue(empty);
    wrap(await ExpensesPanel({ state: st() }));
    expect(screen.getByText("Nenhuma despesa para os filtros selecionados em novembro de 2026")).toBeInTheDocument();
    expect(screen.getByText(/Não há despesas pendentes neste mês\./)).toBeInTheDocument();
    expect(screen.getByText(/"Limpar filtros" mostra todo o mês\./)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Limpar filtros" })).toHaveAttribute("href", "/entries?month=2026-11&d_status=ALL");
    expect(screen.getByRole("button", { name: "+ Novo lançamento" })).toBeInTheDocument();
  });

  it("vazio com status Pago: descricao propria", async () => {
    ep.listExpenses.mockResolvedValue(empty);
    wrap(await ExpensesPanel({ state: st({ d_status: "PAID" }) }));
    expect(screen.getByText(/Não há despesas pagas neste mês\./)).toBeInTheDocument();
  });

  it("vazio com categoria ou cartao: 'Nenhuma despesa atende a esta combinacao'", async () => {
    ep.listExpenses.mockResolvedValue(empty);
    wrap(await ExpensesPanel({ state: st({ d_category: "Moradia" }) }));
    expect(screen.getByText(/Nenhuma despesa atende a esta combinação\./)).toBeInTheDocument();
  });

  it("CA39: mes sem despesas: vazio com filtros e, depois de limpar (Todos), 'Nenhuma despesa em <mes>'", async () => {
    ep.listExpenses.mockResolvedValue(empty);
    const a = wrap(await ExpensesPanel({ state: st() }));
    expect(screen.getByText("Nenhuma despesa para os filtros selecionados em novembro de 2026")).toBeInTheDocument();
    a.unmount();
    wrap(await ExpensesPanel({ state: st({ d_status: "ALL" }) }));
    expect(screen.getByText("Nenhuma despesa em novembro de 2026")).toBeInTheDocument();
    expect(screen.getByText("Registre uma despesa ou escolha outro mês.")).toBeInTheDocument();
  });

  it("'Remover filtro de cartao' mantem o status vigente", async () => {
    ep.listExpenses.mockResolvedValue(empty);
    wrap(await ExpensesPanel({ state: st({ d_status: "PAID", d_card: "0192f1e2-0000-7000-8000-0000000000ff" }) }));
    const href = screen.getByRole("link", { name: "Remover filtro de cartão" }).getAttribute("href")!;
    expect(new URLSearchParams(href.split("?")[1]).get("d_status")).toBe("PAID");
    expect(href).not.toContain("d_card");
  });

  it("RF14: a aba Receitas nao recebe status nem mostra o filtro de status (CA44)", async () => {
    ep.listIncomes.mockResolvedValue({ month: "2026-11", items: [], pagination: pagination(0), subtotal: { total: "0.00" } });
    wrap(await IncomePanel({ state: st({ tab: "income" }) }));
    expect(ep.listIncomes).toHaveBeenCalledWith({ month: "2026-11" });
    expect(screen.queryByRole("radio", { name: "Pendente" })).not.toBeInTheDocument();
  });
});

describe("ExpenseFilters - padrao, Limpar e indicacao de status abaixo de md (RF11, RF23, CA36, CA37, CA60)", () => {
  const props = { categories: ["Moradia"], categoriesError: false, cards: [NUBANK], cardsError: false };

  it("o controle inline abre com 'Pendente' selecionado quando nao ha d_status", () => {
    wrap(<ExpenseFilters state={st()} {...props} />);
    expect(screen.getAllByRole("radio", { name: "Pendente" })[0]).toBeChecked();
    expect(screen.getAllByRole("radio", { name: "Todos" })[0]).not.toBeChecked();
  });

  it("CA37: o botao mobile conta o padrao: 'Filtros (1)'; sem nada alem de Todos: 'Filtros' sem contador", () => {
    const a = wrap(<ExpenseFilters state={st()} {...props} />);
    expect(screen.getByRole("button", { name: "Filtros (1)" })).toBeInTheDocument();
    a.unmount();
    wrap(<ExpenseFilters state={st({ d_status: "ALL" })} {...props} />);
    expect(screen.getByRole("button", { name: "Filtros" })).toBeInTheDocument();
    expect(screen.queryAllByRole("button", { name: /^Limpar/ })).toHaveLength(0);
  });

  it("contador soma status (se nao for Todos), categoria e cartao", () => {
    wrap(<ExpenseFilters state={st({ d_category: "Moradia", d_card: "pix" })} {...props} />);
    expect(screen.getByRole("button", { name: "Filtros (3)" })).toBeInTheDocument();
  });

  it("CA37: na folha, 'Limpar' so muda o rascunho para Todos; nada navega ate 'Aplicar'", async () => {
    wrap(<ExpenseFilters state={st()} {...props} />);
    await userEvent.click(screen.getByRole("button", { name: "Filtros (1)" }));
    const sheet = within(screen.getByRole("dialog"));
    await userEvent.click(sheet.getByRole("button", { name: "Limpar" }));
    expect(sheet.getByRole("radio", { name: "Todos" })).toBeChecked();
    expect(router.push).not.toHaveBeenCalled();
    await userEvent.click(sheet.getByRole("button", { name: "Aplicar" }));
    expect(router.push).toHaveBeenLastCalledWith("/entries?month=2026-11&d_status=ALL", { scroll: false });
  });

  it("CA37: selecionar 'Todos' na folha e aplicar escreve d_status=ALL", async () => {
    wrap(<ExpenseFilters state={st()} {...props} />);
    await userEvent.click(screen.getByRole("button", { name: "Filtros (1)" }));
    await userEvent.click(within(screen.getByRole("dialog")).getByRole("radio", { name: "Todos" }));
    await userEvent.click(within(screen.getByRole("dialog")).getByRole("button", { name: "Aplicar" }));
    expect(router.push).toHaveBeenLastCalledWith("/entries?month=2026-11&d_status=ALL", { scroll: false });
  });

  it("CA37: o botao 'Limpar' mobile (fora da folha) tambem leva a Todos", async () => {
    wrap(<ExpenseFilters state={st()} {...props} />);
    const mobile = screen.getByText("Limpar", { selector: "button" }); // texto visivel; nome acessivel "Limpar filtros" (design 3.2)
    expect(mobile).toHaveAccessibleName("Limpar filtros");
    await userEvent.click(mobile);
    expect(router.push).toHaveBeenLastCalledWith("/entries?month=2026-11&d_status=ALL", { scroll: false });
  });

  it("inline: selecionar 'Todos' aplica ao mudar e escreve d_status=ALL; selecionar 'Pendente' volta ao padrao (sem parametro)", async () => {
    const a = wrap(<ExpenseFilters state={st()} {...props} />);
    await userEvent.click(screen.getAllByRole("radio", { name: "Todos" })[0]);
    expect(router.push).toHaveBeenLastCalledWith("/entries?month=2026-11&d_status=ALL", { scroll: false });
    a.unmount();
    wrap(<ExpenseFilters state={st({ d_status: "ALL" })} {...props} />);
    await userEvent.click(screen.getAllByRole("radio", { name: "Pendente" })[0]);
    expect(router.push).toHaveBeenLastCalledWith("/entries?month=2026-11", { scroll: false });
  });

  it("RF19: mudar o status de Despesas preserva o f_status de Faturas na URL", async () => {
    wrap(<ExpenseFilters state={st({ f_status: "ALL" })} {...props} />);
    await userEvent.click(screen.getAllByRole("radio", { name: "Pago" })[0]);
    const href = router.push.mock.lastCall![0] as string;
    expect(new URLSearchParams(href.split("?")[1]).get("f_status")).toBe("ALL");
    expect(new URLSearchParams(href.split("?")[1]).get("d_status")).toBe("PAID");
  });

  it("RF23/CA60: 'Status: Pendente' aparece fora da folha (padrao) e reflete o status APLICADO, nao o rascunho", async () => {
    wrap(<ExpenseFilters state={st()} {...props} />);
    expect(screen.getByText("Status: Pendente")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Filtros (1)" }));
    await userEvent.click(within(screen.getByRole("dialog")).getByRole("radio", { name: "Pago" }));
    expect(screen.getByText("Status: Pendente")).toBeInTheDocument(); // rascunho nao muda a indicacao
    expect(screen.queryByText("Status: Pago")).not.toBeInTheDocument();
  });

  it.each([["ALL", "Status: Todos"], ["PAID", "Status: Pago"], ["PENDING", "Status: Pendente"]])("RF23: d_status=%s -> '%s'", (status, text) => {
    wrap(<ExpenseFilters state={st({ d_status: status })} {...props} />);
    expect(screen.getByText(text)).toBeInTheDocument();
  });

  it("RF23: a indicacao e texto estatico, fora de regiao viva (design 10.2)", () => {
    wrap(<ExpenseFilters state={st()} {...props} />);
    const el = screen.getByText("Status: Pendente");
    expect(el.closest("[aria-live]")).toBeNull();
    expect(el.closest('[role="status"]')).toBeNull();
  });
});

describe("InvoicesPanel - filtro de status (RF09, RF16-RF20, CA45-CA54)", () => {
  const azul: InvoiceDto = { card: { id: NUBANK.id, name: "Azul" }, referenceMonth: "2026-11", closingDate: "2026-10-10", dueDate: "2026-11-17", entryCount: 2, pendingCount: 1, totals: { total: "160.00", paid: "100.00", pending: "60.00" } };
  const roxo: InvoiceDto = { card: { id: "0192f1e2-0000-7000-8000-000000000002", name: "Roxo" }, referenceMonth: "2026-11", closingDate: "2026-10-25", dueDate: "2026-11-05", entryCount: 1, pendingCount: 0, totals: { total: "70.00", paid: "70.00", pending: "0.00" } };
  const inv = (raw: Record<string, string> = {}) => st({ tab: "invoices", ...raw });
  const live = () => document.querySelector('p.sr-only[aria-live="polite"]')?.textContent;

  it("CA45: sem f_status a API recebe {month, status:'PENDING'}; 'Pendente' selecionado; contagem '1 fatura'", async () => {
    ep.listInvoices.mockResolvedValue({ month: "2026-11", items: [azul] });
    wrap(await InvoicesPanel({ state: inv() }));
    expect(ep.listInvoices).toHaveBeenCalledWith({ month: "2026-11", status: "PENDING" });
    expect(screen.getAllByRole("radio", { name: "Pendente" })[0]).toBeChecked();
    expect(screen.getByRole("group", { name: "Azul" })).toBeInTheDocument();
    expect(screen.getByText("1 fatura.")).toBeInTheDocument();
  });

  it("CA47: Pago -> status=PAID; Todos (f_status=ALL) -> a API NAO recebe status", async () => {
    ep.listInvoices.mockResolvedValue({ month: "2026-11", items: [roxo] });
    const a = wrap(await InvoicesPanel({ state: inv({ f_status: "PAID" }) }));
    expect(ep.listInvoices).toHaveBeenLastCalledWith({ month: "2026-11", status: "PAID" });
    a.unmount();
    ep.listInvoices.mockResolvedValue({ month: "2026-11", items: [roxo, azul] });
    wrap(await InvoicesPanel({ state: inv({ f_status: "ALL" }) }));
    expect(ep.listInvoices).toHaveBeenLastCalledWith({ month: "2026-11" });
    expect(screen.getAllByRole("heading", { level: 3 }).map((h) => h.textContent)).toEqual(["Roxo", "Azul"]); // ordem de vencimento vinda da API
  });

  it("CA50: f_status invalido -> Pendente, sem erro", async () => {
    ep.listInvoices.mockResolvedValue({ month: "2026-11", items: [azul] });
    wrap(await InvoicesPanel({ state: inv({ f_status: "lixo" }) }));
    expect(ep.listInvoices).toHaveBeenCalledWith({ month: "2026-11", status: "PENDING" });
  });

  it("RF19: o status de Despesas nao afeta a leitura de Faturas", async () => {
    ep.listInvoices.mockResolvedValue({ month: "2026-11", items: [azul] });
    wrap(await InvoicesPanel({ state: inv({ d_status: "PAID" }) }));
    expect(ep.listInvoices).toHaveBeenCalledWith({ month: "2026-11", status: "PENDING" });
  });

  it("RF18/CA46: o bloco mostra totais da fatura inteira mesmo sob Pendente", async () => {
    ep.listInvoices.mockResolvedValue({ month: "2026-11", items: [azul] });
    wrap(await InvoicesPanel({ state: inv() }));
    const block = screen.getByRole("group", { name: "Azul" });
    expect(nbsp(block.textContent)).toMatch(/Total ?R\$ 160,00/);
    expect(nbsp(block.textContent)).toMatch(/Pago ?R\$ 100,00/);
    expect(screen.getByRole("button", { name: "Ver 2 despesas da fatura Azul" })).toBeInTheDocument();
  });

  it("anuncio (design 10.2): 'Mostrando 1 fatura de novembro de 2026, pendentes' / ', pagas' / sem qualificador em Todos", async () => {
    ep.listInvoices.mockResolvedValue({ month: "2026-11", items: [azul] });
    const a = wrap(await InvoicesPanel({ state: inv() }));
    expect(live()).toBe("Mostrando 1 fatura de novembro de 2026, pendentes");
    a.unmount();
    const b = wrap(await InvoicesPanel({ state: inv({ f_status: "PAID" }) }));
    expect(live()).toBe("Mostrando 1 fatura de novembro de 2026, pagas");
    b.unmount();
    wrap(await InvoicesPanel({ state: inv({ f_status: "ALL" }) }));
    expect(live()).toBe("Mostrando 1 fatura de novembro de 2026");
  });

  it("CA52: com cartao e so faturas pagas, o padrao mostra o vazio com filtros e 'Limpar filtros' (-> f_status=ALL)", async () => {
    ep.listInvoices.mockResolvedValue({ month: "2026-11", items: [] });
    wrap(await InvoicesPanel({ state: inv() }));
    expect(screen.getByText("Nenhuma fatura para os filtros selecionados em novembro de 2026")).toBeInTheDocument();
    expect(screen.getByText(/Não há faturas pendentes neste mês\./)).toBeInTheDocument();
    const clear = screen.getAllByRole("link", { name: "Limpar filtros" }).find((l) => l.getAttribute("href")?.includes("f_status=ALL"));
    expect(clear).toBeTruthy();
    expect(clear!.getAttribute("href")).toContain("tab=invoices");
    expect(screen.getByRole("button", { name: "+ Novo lançamento" })).toBeInTheDocument();
    expect(live()).toBe("Nenhuma fatura de novembro de 2026, pendentes");
  });

  it("vazio sob Pago: descricao 'faturas pagas'", async () => {
    ep.listInvoices.mockResolvedValue({ month: "2026-11", items: [] });
    wrap(await InvoicesPanel({ state: inv({ f_status: "PAID" }) }));
    expect(screen.getByText(/Não há faturas pagas neste mês\./)).toBeInTheDocument();
  });

  it("CA53: com cartao e Todos sem faturas -> 'Nenhuma fatura neste mes' (sem 'Cadastrar cartao')", async () => {
    ep.listInvoices.mockResolvedValue({ month: "2026-11", items: [] });
    wrap(await InvoicesPanel({ state: inv({ f_status: "ALL" }) }));
    expect(screen.getByText("Nenhuma fatura neste mês")).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Cadastrar cartão" })).not.toBeInTheDocument();
    expect(screen.getAllByRole("radio", { name: "Todos" })[0]).toBeChecked();
  });

  it("CA54: SEM cartao (leitura ok e vazia): 'Nenhuma fatura neste mes' + 'Cadastrar cartao'; filtro, 'Limpar filtros', 'Filtros', contador e 'Status:' escondidos, mesmo com f_status na URL", async () => {
    ep.listInvoices.mockResolvedValue({ month: "2026-11", items: [] });
    ep.listCards.mockResolvedValue({ items: [] });
    for (const raw of [{}, { f_status: "PAID" }, { f_status: "ALL" }] as Record<string, string>[]) {
      const v = wrap(await InvoicesPanel({ state: inv(raw) }));
      expect(screen.getByText("Nenhuma fatura neste mês")).toBeInTheDocument();
      expect(screen.getByRole("link", { name: "Cadastrar cartão" })).toHaveAttribute("href", "/cards");
      expect(screen.queryByRole("radio")).not.toBeInTheDocument();
      expect(screen.queryByRole("radiogroup")).not.toBeInTheDocument();
      expect(screen.queryByText(/Limpar/)).not.toBeInTheDocument();
      expect(screen.queryByRole("button", { name: /^Filtros/ })).not.toBeInTheDocument();
      expect(screen.queryByText(/^Status:/)).not.toBeInTheDocument();
      expect(screen.queryByText(/para os filtros selecionados/)).not.toBeInTheDocument();
      v.unmount();
    }
  });

  it("P12/CA54: se a leitura de cartoes FALHAR, nao se sabe que nao ha cartao: filtro visivel e vazio com filtros", async () => {
    ep.listInvoices.mockResolvedValue({ month: "2026-11", items: [] });
    ep.listCards.mockRejectedValue(new Error("x"));
    wrap(await InvoicesPanel({ state: inv() }));
    expect(screen.getAllByRole("radio", { name: "Pendente" })[0]).toBeChecked();
    expect(screen.getByText("Nenhuma fatura para os filtros selecionados em novembro de 2026")).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Cadastrar cartão" })).not.toBeInTheDocument();
  });

  it("o filtro e o 'Limpar filtros' ficam montados tambem no ramo vazio (sem desmontar o controle)", async () => {
    ep.listInvoices.mockResolvedValue({ month: "2026-11", items: [] });
    wrap(await InvoicesPanel({ state: inv({ f_status: "PAID" }) }));
    expect(screen.getAllByRole("radio", { name: "Pago" })[0]).toBeChecked();
    expect(screen.getAllByRole("button", { name: "Limpar filtros" }).length).toBeGreaterThan(0);
  });

  it("com Todos nao ha 'Limpar filtros' no controle; com fatura na lista o botao existe sob o padrao (RF11)", async () => {
    ep.listInvoices.mockResolvedValue({ month: "2026-11", items: [azul] });
    const a = wrap(await InvoicesPanel({ state: inv() }));
    expect(screen.getAllByRole("button", { name: "Limpar filtros" }).length).toBeGreaterThan(0);
    a.unmount();
    wrap(await InvoicesPanel({ state: inv({ f_status: "ALL" }) }));
    expect(screen.queryByRole("button", { name: "Limpar filtros" })).not.toBeInTheDocument();
  });

  it("a aba nao tem subtotal nem filtros de categoria/cartao (RF09, fora de escopo)", async () => {
    ep.listInvoices.mockResolvedValue({ month: "2026-11", items: [azul] });
    wrap(await InvoicesPanel({ state: inv() }));
    expect(screen.queryByTestId("subtotal")).not.toBeInTheDocument();
    expect(screen.queryByLabelText("Categoria")).not.toBeInTheDocument();
    expect(screen.queryByLabelText("Cartão")).not.toBeInTheDocument();
  });
});
