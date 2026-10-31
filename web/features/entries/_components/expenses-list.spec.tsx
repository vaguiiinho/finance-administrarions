import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { AllProviders, router } from "@/test/helpers/providers";
import type { EntryDto } from "@/lib/api/types";
import { ExpensesList } from "./expenses-list";

const payEntries = vi.fn();
const payEntry = vi.fn();
vi.mock("@/app/(protected)/entries/actions", () => ({
  payEntries: (...args: unknown[]) => payEntries(...args),
  payEntry: (...args: unknown[]) => payEntry(...args),
}));
vi.mock("next/navigation", () => ({ useRouter: () => router, usePathname: () => "/entries" }));
vi.mock("next/link", () => ({ default: ({ children, href, ...rest }: { children: React.ReactNode; href: string }) => <a href={href} {...rest}>{children}</a> }));

const nbsp = (s: string | null) => (s ?? "").replace(/ /g, " ");

const entry = (id: string, description: string, amount: string, over: Partial<EntryDto> = {}): EntryDto => ({
  id,
  type: "EXPENSE",
  description,
  category: "Moradia",
  date: "2026-10-15",
  amount,
  paymentMethod: "PIX",
  card: null,
  invoice: null,
  referenceMonth: "2026-10",
  status: "PENDING",
  paidAt: null,
  createdAt: "",
  updatedAt: "",
  ...over,
});

const ITEMS = [
  entry("e1", "Mercado", "100.00", { paymentMethod: "CARD", card: { id: "c1", name: "Nubank" }, invoice: { closingDate: "2026-10-25", dueDate: "2026-11-05" }, referenceMonth: "2026-11" }),
  entry("e2", "Internet", "80.00"),
  entry("e3", "Aluguel", "30.00", { status: "PAID", paidAt: "2026-10-02T13:00:00.000Z" }),
];

// A lista renderiza tabela (>= md) e cards (< md) no mesmo DOM; os testes usam a tabela, que e a primeira.
const table = () => within(screen.getByRole("table", { hidden: true }));
const rowCheckbox = (name: RegExp) => table().getByRole("checkbox", { name, hidden: true });

// `statusFilter`: PROP PROPOSTA PELO TESTER (ADR 0007 6.2 / design 6.2): o filtro de status vigente da aba, para decidir o foco.
const setup = (items = ITEMS, statusFilter?: "ALL" | "PENDING" | "PAID") =>
  render(
    <AllProviders>
      <h2 id="panel-title" tabIndex={-1}>
        Despesas
      </h2>
      <ExpensesList items={items} panelTitleId="panel-title" {...(statusFilter ? { statusFilter } : {})} />
    </AllProviders>,
  );

beforeEach(() => {
  payEntries.mockReset();
  payEntry.mockReset();
});

describe("ExpensesList - selecao em lote (CA70, CA71, P11, P12)", () => {
  it("so despesas PENDENTES sao selecionaveis; pagas ficam desabilitadas ('X já pago')", () => {
    setup();
    expect(rowCheckbox(/Selecionar Mercado, R\$\s100,00, 15\/10\/2026/)).toBeEnabled();
    expect(rowCheckbox(/Aluguel já pago/)).toBeDisabled();
  });

  it("toolbar sem selecao: instrucao + 'Marcar como pago' desabilitado; com selecao: contagem, soma por centavos e 'Limpar seleção'", async () => {
    setup();
    expect(screen.getAllByText("Selecione despesas pendentes para pagar em lote").length).toBeGreaterThan(0);
    await userEvent.click(rowCheckbox(/Mercado/));
    await userEvent.click(rowCheckbox(/Internet/));
    const summary = screen.getAllByText(/selecionados/).map((n) => nbsp(n.textContent));
    expect(summary[0]).toBe("2 selecionados · R$ 180,00");
    expect(screen.getAllByRole("button", { name: "Marcar como pago (2)", hidden: true }).length).toBeGreaterThan(0);
    await userEvent.click(screen.getByRole("button", { name: "Limpar seleção", hidden: true }));
    expect(rowCheckbox(/Mercado/)).not.toBeChecked();
    expect(screen.getAllByRole("button", { name: "Marcar como pago", hidden: true })[0]).toHaveAttribute("aria-disabled", "true");
  });

  it("cabecalho tri-state: 'Selecionar todas as pendentes desta pagina'; indeterminado com parte selecionada", async () => {
    setup();
    const header = table().getByRole("checkbox", { name: "Selecionar todas as despesas pendentes desta página", hidden: true }) as HTMLInputElement;
    expect(header.indeterminate).toBe(false);
    await userEvent.click(rowCheckbox(/Mercado/));
    expect(header.indeterminate).toBe(true);
    await userEvent.click(header);
    expect(rowCheckbox(/Mercado/)).toBeChecked();
    expect(rowCheckbox(/Internet/)).toBeChecked();
    expect(rowCheckbox(/Aluguel/)).not.toBeChecked();
    expect(header.checked).toBe(true);
    await userEvent.click(header);
    expect(rowCheckbox(/Internet/)).not.toBeChecked();
  });

  it("cabecalho desabilitado quando nao ha pendentes na pagina", () => {
    setup([ITEMS[2]]);
    expect(table().getByRole("checkbox", { name: /Selecionar todas/, hidden: true })).toBeDisabled();
  });

  it("confirmacao do lote: titulo, total, itens; foco em Cancelar; confirmar chama payEntries com os ids e limpa a selecao", async () => {
    payEntries.mockResolvedValue({ ok: true, data: { paidIds: ["e1", "e2"], alreadyPaidIds: [] } });
    setup();
    await userEvent.click(rowCheckbox(/Mercado/));
    await userEvent.click(rowCheckbox(/Internet/));
    await userEvent.click(screen.getAllByRole("button", { name: "Marcar como pago (2)", hidden: true })[0]);
    const dialog = within(screen.getByRole("alertdialog"));
    expect(dialog.getByRole("heading", { name: "Marcar 2 despesas como pagas?" })).toBeInTheDocument();
    expect(nbsp(screen.getByRole("alertdialog").textContent)).toContain("Total: R$ 180,00");
    expect(dialog.getByText("Mercado")).toBeInTheDocument();
    expect(dialog.getByText("Esta ação não pode ser desfeita.")).toBeInTheDocument();
    expect(dialog.getByRole("button", { name: "Cancelar" })).toHaveFocus();
    await userEvent.click(dialog.getByRole("button", { name: "Marcar como pago" }));
    expect(payEntries).toHaveBeenCalledWith(["e1", "e2"]);
    expect(await screen.findByText("2 despesas marcadas como pagas.")).toBeInTheDocument();
    expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument();
    expect(rowCheckbox(/Mercado/)).not.toBeChecked();
    expect(document.getElementById("panel-title")).toHaveFocus();
  });

  it("'já estava paga' aparece no toast quando a API informa alreadyPaidIds", async () => {
    payEntries.mockResolvedValue({ ok: true, data: { paidIds: ["e1"], alreadyPaidIds: ["e2"] } });
    setup();
    await userEvent.click(rowCheckbox(/Mercado/));
    await userEvent.click(rowCheckbox(/Internet/));
    await userEvent.click(screen.getAllByRole("button", { name: "Marcar como pago (2)", hidden: true })[0]);
    await userEvent.click(within(screen.getByRole("alertdialog")).getByRole("button", { name: "Marcar como pago" }));
    expect(await screen.findByText("1 despesa marcada como paga. 1 já estava paga.")).toBeInTheDocument();
  });

  it("Cancelar nao chama a API e mantem a selecao", async () => {
    setup();
    await userEvent.click(rowCheckbox(/Mercado/));
    await userEvent.click(screen.getAllByRole("button", { name: "Marcar como pago (1)", hidden: true })[0]);
    await userEvent.click(within(screen.getByRole("alertdialog")).getByRole("button", { name: "Cancelar" }));
    expect(payEntries).not.toHaveBeenCalled();
    expect(rowCheckbox(/Mercado/)).toBeChecked();
  });

  it("404 do lote: fecha, banner persistente (role=alert) com as descricoes ausentes e a selecao perde so os ausentes", async () => {
    payEntries.mockResolvedValue({ ok: false, error: { status: 404, code: "ENTRIES_NOT_FOUND", message: "x", missingIds: ["e2"] } });
    setup();
    await userEvent.click(rowCheckbox(/Mercado/));
    await userEvent.click(rowCheckbox(/Internet/));
    await userEvent.click(screen.getAllByRole("button", { name: "Marcar como pago (2)", hidden: true })[0]);
    await userEvent.click(within(screen.getByRole("alertdialog")).getByRole("button", { name: "Marcar como pago" }));
    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent("Nenhuma despesa foi alterada. 1 despesa selecionada não foi encontrada:");
    expect(alert).toHaveTextContent("Internet");
    expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument();
    expect(rowCheckbox(/Mercado/)).toBeChecked();
    expect(rowCheckbox(/Internet/)).not.toBeChecked();
  });

  it("422 do lote: banner explica que receitas nao podem ser pagas", async () => {
    payEntries.mockResolvedValue({ ok: false, error: { status: 422, code: "ENTRIES_NOT_PAYABLE", message: "x", incomeIds: ["e1"] } });
    setup();
    await userEvent.click(rowCheckbox(/Mercado/));
    await userEvent.click(screen.getAllByRole("button", { name: "Marcar como pago (1)", hidden: true })[0]);
    await userEvent.click(within(screen.getByRole("alertdialog")).getByRole("button", { name: "Marcar como pago" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Receitas não podem ser marcadas como pagas:");
  });

  it("500: modal continua aberto com a mensagem inline", async () => {
    payEntries.mockResolvedValue({ ok: false, error: { status: 500, code: "INTERNAL_ERROR", message: "x" } });
    setup();
    await userEvent.click(rowCheckbox(/Mercado/));
    await userEvent.click(screen.getAllByRole("button", { name: "Marcar como pago (1)", hidden: true })[0]);
    await userEvent.click(within(screen.getByRole("alertdialog")).getByRole("button", { name: "Marcar como pago" }));
    await waitFor(() => expect(within(screen.getByRole("alertdialog")).getByRole("alert")).toHaveTextContent("Não foi possível marcar como pago. Nenhuma despesa foi alterada. Tente novamente."));
  });
});

describe("ExpensesList - pagamento individual e apresentacao", () => {
  it("botao da linha usa 'Marcar X como pago', confirma e mostra '\"X\" marcado como pago.'", async () => {
    payEntry.mockResolvedValue({ ok: true, data: { ...ITEMS[1], status: "PAID" } });
    setup();
    await userEvent.click(table().getByRole("button", { name: "Marcar Internet como pago", hidden: true }));
    expect(within(screen.getByRole("alertdialog")).getByRole("heading", { name: 'Marcar "Internet" como pago?' })).toBeInTheDocument();
    await userEvent.click(within(screen.getByRole("alertdialog")).getByRole("button", { name: "Marcar como pago" }));
    expect(payEntry).toHaveBeenCalledWith("e2");
    expect(await screen.findByText('"Internet" marcado como pago.')).toBeInTheDocument();
  });

  it("404 individual: toast de erro 'Esta despesa não foi encontrada. A lista foi atualizada.'", async () => {
    payEntry.mockResolvedValue({ ok: false, error: { status: 404, code: "ENTRY_NOT_FOUND", message: "x" } });
    setup();
    await userEvent.click(table().getByRole("button", { name: "Marcar Internet como pago", hidden: true }));
    await userEvent.click(within(screen.getByRole("alertdialog")).getByRole("button", { name: "Marcar como pago" }));
    // design 2.3: toasts de erro usam role=alert
    expect(await screen.findByRole("alert")).toHaveTextContent("Esta despesa não foi encontrada. A lista foi atualizada.");
  });

  it("chip 'Fatura nov/26' so quando o mes de referencia difere do mes da data (RF20); pago mostra 'Pago em dd/MM/yyyy' (design 4.x)", () => {
    setup();
    const mercado = within(screen.getByRole("row", { name: /Mercado/, hidden: true }));
    expect(mercado.getByText("Fatura nov/26")).toBeInTheDocument();
    expect(mercado.getByText("Fatura de novembro de 2026")).toBeInTheDocument();
    expect(within(screen.getByRole("row", { name: /Internet/, hidden: true })).queryByText(/Fatura/)).not.toBeInTheDocument();
    expect(within(screen.getByRole("row", { name: /Aluguel/, hidden: true })).getByText("Pago em 02/10/2026")).toBeInTheDocument();
  });

  it("valores monetarios formatados pt-BR a partir da string decimal", () => {
    setup();
    expect(nbsp(within(screen.getByRole("row", { name: /Mercado/, hidden: true })).getByText(/R\$/).textContent)).toBe("R$ 100,00");
  });
});

describe("ExpensesList - Server Action que rejeita (falha de transporte)", () => {
  it("sai do estado ocupado e mostra a mensagem generica no modal aberto", async () => {
    payEntries.mockRejectedValue(new Error("rede"));
    setup();
    await userEvent.click(rowCheckbox(/Mercado/));
    await userEvent.click(screen.getAllByRole("button", { name: "Marcar como pago (1)", hidden: true })[0]);
    const dialog = within(screen.getByRole("alertdialog"));
    await userEvent.click(dialog.getByRole("button", { name: "Marcar como pago" }));
    await waitFor(() => expect(dialog.getByRole("alert")).toHaveTextContent("Não foi possível marcar como pago"));
    expect(dialog.getByRole("button", { name: "Marcar como pago" })).not.toHaveAttribute("aria-busy");
    expect(dialog.getByRole("button", { name: "Cancelar" })).not.toHaveAttribute("aria-disabled");
  });
});

describe("ExpensesList - foco depois do pagamento individual (RF24, CA61, design 6.2)", () => {
  const payOne = async (name = "Internet") => {
    await userEvent.click(table().getByRole("button", { name: `Marcar ${name} como pago`, hidden: true }));
    await userEvent.click(within(screen.getByRole("alertdialog")).getByRole("button", { name: "Marcar como pago" }));
  };

  it("CA61: sob 'Pendente' a linha sai da lista, entao o foco vai para o h2 do painel (depois de o modal fechar)", async () => {
    payEntry.mockResolvedValue({ ok: true, data: { ...ITEMS[1], status: "PAID" } });
    setup(ITEMS, "PENDING");
    await payOne();
    expect(await screen.findByText('"Internet" marcado como pago.')).toBeInTheDocument();
    expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Despesas" })).toHaveFocus();
  });

  it("CA61: tambem quando a despesa paga era a ULTIMA da lista", async () => {
    payEntry.mockResolvedValue({ ok: true, data: { ...ITEMS[1], status: "PAID" } });
    setup([ITEMS[1]], "PENDING");
    await payOne();
    await screen.findByText('"Internet" marcado como pago.');
    expect(screen.getByRole("heading", { name: "Despesas" })).toHaveFocus();
  });

  it("sob 'Todos' a linha permanece como paga e o foco vai para a PROPRIA linha (alvo estavel: o gatilho some na revalidacao, design 6.2)", async () => {
    payEntry.mockResolvedValue({ ok: true, data: { ...ITEMS[1], status: "PAID" } });
    const view = setup(ITEMS, "ALL");
    await payOne();
    await screen.findByText('"Internet" marcado como pago.');
    expect(screen.getByRole("heading", { name: "Despesas" })).not.toHaveFocus();
    const row = table().getByRole("row", { name: /Internet/, hidden: true });
    expect(row).toHaveFocus();
    expect(row).toHaveAttribute("tabindex", "-1");
    // a revalidacao marca a despesa como paga: o gatilho desaparece e o foco continua na linha (nao cai em body)
    view.rerender(
      <AllProviders>
        <h2 id="panel-title" tabIndex={-1}>
          Despesas
        </h2>
        <ExpensesList items={ITEMS.map((e) => (e.id === ITEMS[1].id ? { ...e, status: "PAID" as const } : e))} panelTitleId="panel-title" statusFilter="ALL" />
      </AllProviders>,
    );
    expect(table().queryByRole("button", { name: "Marcar Internet como pago", hidden: true })).not.toBeInTheDocument();
    expect(table().getByRole("row", { name: /Internet/, hidden: true })).toHaveFocus();
  });

  it("sob 'Todos', se a linha ja nao existe quando o dialogo fecha, o foco cai no h2 do painel (nao no gatilho)", async () => {
    let resolvePay!: (v: unknown) => void;
    payEntry.mockReturnValue(new Promise((r) => (resolvePay = r)));
    const view = setup(ITEMS, "ALL");
    await userEvent.click(table().getByRole("button", { name: "Marcar Internet como pago", hidden: true }));
    await userEvent.click(within(screen.getByRole("alertdialog")).getByRole("button", { name: "Marcar como pago" }));
    view.rerender(
      <AllProviders>
        <h2 id="panel-title" tabIndex={-1}>
          Despesas
        </h2>
        <ExpensesList items={ITEMS.filter((e) => e.id !== ITEMS[1].id)} panelTitleId="panel-title" statusFilter="ALL" />
      </AllProviders>,
    );
    resolvePay({ ok: true, data: { ...ITEMS[1], status: "PAID" } });
    await screen.findByText('"Internet" marcado como pago.');
    expect(screen.getByRole("heading", { name: "Despesas" })).toHaveFocus();
  });

  it("pagamento em LOTE mantem o foco atual: h2 do painel, em qualquer filtro (RF24)", async () => {
    for (const status of ["PENDING", "ALL"] as const) {
      payEntries.mockResolvedValue({ ok: true, data: { paidIds: ["e1", "e2"], alreadyPaidIds: [] } });
      const view = setup(ITEMS, status);
      await userEvent.click(table().getByRole("checkbox", { name: /Selecionar Internet/, hidden: true }));
      await userEvent.click(screen.getAllByRole("button", { name: /Marcar como pago \(1\)/ })[0]);
      await userEvent.click(within(screen.getByRole("alertdialog")).getByRole("button", { name: /Marcar como pago/ }));
      await screen.findByText(/marcadas como pagas/);
      expect(screen.getByRole("heading", { name: "Despesas" })).toHaveFocus();
      view.unmount();
    }
  });
});
