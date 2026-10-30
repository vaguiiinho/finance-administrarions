import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { AllProviders, router } from "@/test/helpers/providers";
import { parseEntriesSearchParams } from "@/lib/filters/entries-search-params";
import type { EntryDto, InvoiceDto } from "@/lib/api/types";
import { InvoiceBlock } from "./invoice-block";

const payInvoice = vi.fn();
const loadInvoiceEntries = vi.fn();
vi.mock("@/app/(protected)/entries/actions", () => ({
  payInvoice: (...args: unknown[]) => payInvoice(...args),
  loadInvoiceEntries: (...args: unknown[]) => loadInvoiceEntries(...args),
}));
vi.mock("@/app/(public)/demo/actions", () => ({ loadDemoInvoiceEntries: vi.fn() }));
vi.mock("next/navigation", () => ({ useRouter: () => router, usePathname: () => "/entries" }));
vi.mock("next/link", () => ({ default: ({ children, href, ...rest }: { children: React.ReactNode; href: string }) => <a href={href} {...rest}>{children}</a> }));

const state = parseEntriesSearchParams({ month: "2026-11", tab: "invoices" }, new Date("2026-10-24T13:00:00.000Z"));
const nbsp = (s: string | null) => (s ?? "").replace(/ /g, " ");

const invoice = (over: Partial<InvoiceDto> = {}): InvoiceDto => ({
  card: { id: "0192f1e2-0000-7000-8000-000000000001", name: "Nubank" },
  referenceMonth: "2026-11",
  closingDate: "2026-10-25",
  dueDate: "2026-11-05",
  entryCount: 2,
  pendingCount: 2,
  totals: { total: "150.00", paid: "0.00", pending: "150.00" },
  ...over,
});

const expense = (id: string, description: string, amount: string): EntryDto => ({
  id,
  type: "EXPENSE",
  description,
  category: "Alimentação",
  date: "2026-10-10",
  amount,
  paymentMethod: "CARD",
  card: { id: "0192f1e2-0000-7000-8000-000000000001", name: "Nubank" },
  invoice: { closingDate: "2026-10-25", dueDate: "2026-11-05" },
  referenceMonth: "2026-11",
  status: "PENDING",
  paidAt: null,
  createdAt: "",
  updatedAt: "",
});

const setup = (inv: InvoiceDto = invoice()) =>
  render(
    <AllProviders>
      <InvoiceBlock invoice={inv} state={state} />
    </AllProviders>,
  );

beforeEach(() => {
  payInvoice.mockReset();
  loadInvoiceEntries.mockReset();
});

describe("InvoiceBlock (RF21, CA72)", () => {
  it("mostra cartao, datas dd/MM/yyyy exatamente como vem da API e os tres totais", () => {
    setup();
    const block = screen.getByRole("group", { name: "Nubank" });
    expect(block).toHaveTextContent("Fecha 25/10/2026 · Vence 05/11/2026");
    expect(nbsp(block.textContent)).toMatch(/Total ?R\$ 150,00/);
    expect(nbsp(block.textContent)).toMatch(/Pago ?R\$ 0,00/);
    expect(nbsp(block.textContent)).toMatch(/Pendente ?R\$ 150,00/);
    expect(screen.getByRole("heading", { level: 3, name: "Nubank" })).toBeInTheDocument();
  });

  it("confirmacao mostra cartao, mes por extenso, vencimento, contagem e soma pendentes (da API, sem calculo no cliente)", async () => {
    setup();
    await userEvent.click(screen.getByRole("button", { name: /Pagar fatura/ }));
    const dialog = within(screen.getByRole("alertdialog"));
    expect(dialog.getByRole("heading", { name: "Pagar a fatura Nubank de novembro de 2026?" })).toBeInTheDocument();
    expect(dialog.getByText("Vence em 05/11/2026")).toBeInTheDocument();
    expect(dialog.getByText("2 lançamentos pendentes")).toBeInTheDocument();
    expect(nbsp(screen.getByRole("alertdialog").textContent)).toContain("Total: R$ 150,00");
    expect(dialog.getByText("Esta ação não pode ser desfeita.")).toBeInTheDocument();
    expect(dialog.getByRole("button", { name: "Cancelar" })).toHaveFocus();
  });

  it("cancelar fecha sem chamar a API e devolve o foco ao botao", async () => {
    setup();
    const pay = screen.getByRole("button", { name: /Pagar fatura/ });
    await userEvent.click(pay);
    await userEvent.click(within(screen.getByRole("alertdialog")).getByRole("button", { name: "Cancelar" }));
    expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument();
    expect(payInvoice).not.toHaveBeenCalled();
    expect(pay).toHaveFocus();
  });

  it("toast de sucesso usa os valores da RESPOSTA (P21): 'Fatura Nubank de nov/26 paga: 2 despesas, R$ 100,00.'", async () => {
    payInvoice.mockResolvedValue({ ok: true, data: { cardId: "c", referenceMonth: "2026-11", paidIds: ["a", "b"], paidCount: 2, paidAmount: "100.00" } });
    setup(invoice({ totals: { total: "150.00", paid: "50.00", pending: "100.00" } }));
    await userEvent.click(screen.getByRole("button", { name: /Pagar fatura/ }));
    await userEvent.click(within(screen.getByRole("alertdialog")).getByRole("button", { name: "Pagar fatura" }));
    expect(payInvoice).toHaveBeenCalledWith("0192f1e2-0000-7000-8000-000000000001", "2026-11");
    const toast = await screen.findByRole("status");
    expect(nbsp(toast.textContent)).toBe("Fatura Nubank de nov/26 paga: 2 despesas, R$ 100,00.");
    expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument();
    expect(screen.getByRole("heading", { level: 3, name: "Nubank" })).toHaveFocus();
  });

  it("valor pago diferente do exibido explica a divergencia", async () => {
    payInvoice.mockResolvedValue({ ok: true, data: { cardId: "c", referenceMonth: "2026-11", paidIds: ["a"], paidCount: 1, paidAmount: "80.00" } });
    setup();
    await userEvent.click(screen.getByRole("button", { name: /Pagar fatura/ }));
    await userEvent.click(within(screen.getByRole("alertdialog")).getByRole("button", { name: "Pagar fatura" }));
    expect(nbsp((await screen.findByRole("status")).textContent)).toBe("Fatura Nubank de nov/26 paga: 1 despesa, R$ 80,00. O valor difere do exibido porque a fatura mudou.");
  });

  it("quantidade 0: toast informativo 'Nada foi alterado'", async () => {
    payInvoice.mockResolvedValue({ ok: true, data: { cardId: "c", referenceMonth: "2026-11", paidIds: [], paidCount: 0, paidAmount: "0.00" } });
    setup();
    await userEvent.click(screen.getByRole("button", { name: /Pagar fatura/ }));
    await userEvent.click(within(screen.getByRole("alertdialog")).getByRole("button", { name: "Pagar fatura" }));
    expect(await screen.findByText("Nenhuma despesa pendente nesta fatura. Nada foi alterado.")).toBeInTheDocument();
  });

  it("404: fecha o modal e mostra toast de erro", async () => {
    payInvoice.mockResolvedValue({ ok: false, error: { status: 404, code: "CARD_NOT_FOUND", message: "x" } });
    setup();
    await userEvent.click(screen.getByRole("button", { name: /Pagar fatura/ }));
    await userEvent.click(within(screen.getByRole("alertdialog")).getByRole("button", { name: "Pagar fatura" }));
    // design 2.3: toasts de erro usam role=alert
    expect(await screen.findByRole("alert")).toHaveTextContent("Este cartão não foi encontrado. Nada foi alterado.");
    expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument();
  });

  it("500/rede: modal continua aberto com a mensagem inline (role=alert)", async () => {
    payInvoice.mockResolvedValue({ ok: false, error: { status: 500, code: "INTERNAL_ERROR", message: "x" } });
    setup();
    await userEvent.click(screen.getByRole("button", { name: /Pagar fatura/ }));
    await userEvent.click(within(screen.getByRole("alertdialog")).getByRole("button", { name: "Pagar fatura" }));
    const alert = await within(screen.getByRole("alertdialog")).findByRole("alert");
    expect(alert).toHaveTextContent("Não foi possível pagar a fatura. Nenhuma despesa foi alterada. Tente novamente.");
  });

  it("sem pendencias (CA45): botao desabilitado (aria-disabled) descrito por 'Fatura paga' e nao abre o modal", async () => {
    setup(invoice({ pendingCount: 0, totals: { total: "150.00", paid: "150.00", pending: "0.00" } }));
    const pay = screen.getByRole("button", { name: /Pagar fatura/ });
    expect(pay).toHaveAttribute("aria-disabled", "true");
    expect(pay).toHaveAccessibleDescription(/Fatura paga/);
    expect(screen.getByText("Fatura paga")).toBeInTheDocument();
    await userEvent.click(pay);
    expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument();
  });
});

describe("InvoiceBlock - lista expansivel carregada sob demanda (DR7, ADR 9.2)", () => {
  it("recolhida por padrao; expandir busca a lista uma vez e mostra loading -> itens + link para a aba Despesas filtrada", async () => {
    loadInvoiceEntries.mockResolvedValue({ ok: true, data: [expense("e1", "Mercado", "100.00"), expense("e2", "Farmácia", "50.00")] });
    setup();
    const toggle = screen.getByRole("button", { name: "Ver 2 despesas da fatura Nubank" });
    expect(toggle).toHaveAttribute("aria-expanded", "false");
    expect(loadInvoiceEntries).not.toHaveBeenCalled();
    await userEvent.click(toggle);
    expect(toggle).toHaveAttribute("aria-expanded", "true");
    expect(await screen.findByText("Mercado")).toBeInTheDocument();
    expect(screen.getByText("Farmácia")).toBeInTheDocument();
    expect(loadInvoiceEntries).toHaveBeenCalledTimes(1);
    expect(screen.getByRole("link", { name: "Pagar despesas individualmente na aba Despesas" })).toHaveAttribute(
      "href",
      "/entries?month=2026-11&d_card=0192f1e2-0000-7000-8000-000000000001",
    );
    await userEvent.click(toggle); // ocultar e reabrir usa o cache
    await userEvent.click(toggle);
    expect(loadInvoiceEntries).toHaveBeenCalledTimes(1);
  });

  it("erro da lista fica no bloco: mensagem + 'Tentar novamente' refaz so a lista; totais e 'Pagar fatura' continuam", async () => {
    loadInvoiceEntries.mockResolvedValueOnce({ ok: false, error: { status: 500, code: "INTERNAL_ERROR", message: "x" } });
    loadInvoiceEntries.mockResolvedValueOnce({ ok: true, data: [expense("e1", "Mercado", "100.00")] });
    setup();
    await userEvent.click(screen.getByRole("button", { name: /Ver 2 despesas/ }));
    expect(await screen.findByText("Não foi possível carregar as despesas desta fatura.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Pagar fatura/ })).not.toHaveAttribute("aria-disabled");
    await userEvent.click(screen.getByRole("button", { name: "Tentar novamente" }));
    expect(await screen.findByText("Mercado")).toBeInTheDocument();
    expect(loadInvoiceEntries).toHaveBeenCalledTimes(2);
  });

  it("cache descartado quando a fatura muda (chave com pendente/pago): rebusca a lista aberta", async () => {
    loadInvoiceEntries.mockResolvedValueOnce({ ok: true, data: [expense("e1", "Mercado", "100.00")] });
    const { rerender } = setup();
    await userEvent.click(screen.getByRole("button", { name: /Ver 2 despesas/ }));
    expect(await screen.findByText("Mercado")).toBeInTheDocument();
    loadInvoiceEntries.mockResolvedValueOnce({ ok: true, data: [{ ...expense("e1", "Mercado", "100.00"), status: "PAID" }] });
    rerender(
      <AllProviders>
        <InvoiceBlock invoice={invoice({ pendingCount: 0, totals: { total: "150.00", paid: "150.00", pending: "0.00" } })} state={state} />
      </AllProviders>,
    );
    await waitFor(() => expect(loadInvoiceEntries).toHaveBeenCalledTimes(2));
    expect(await within(screen.getByRole("list", { name: "Despesas da fatura Nubank" })).findByText("Pago")).toBeInTheDocument();
  });
});

describe("InvoiceBlock - Server Action que rejeita", () => {
  it("pagar: sai do ocupado com mensagem inline; lista: cai no estado de erro com 'Tentar novamente'", async () => {
    payInvoice.mockRejectedValue(new Error("rede"));
    loadInvoiceEntries.mockRejectedValue(new Error("rede"));
    setup();
    await userEvent.click(screen.getByRole("button", { name: /Pagar fatura/ }));
    const dialog = within(screen.getByRole("alertdialog"));
    await userEvent.click(dialog.getByRole("button", { name: "Pagar fatura" }));
    expect(await dialog.findByRole("alert")).toHaveTextContent("Não foi possível pagar a fatura");
    expect(dialog.getByRole("button", { name: "Pagar fatura" })).not.toHaveAttribute("aria-busy");
    await userEvent.click(dialog.getByRole("button", { name: "Cancelar" }));
    await userEvent.click(screen.getByRole("button", { name: /Ver 2 despesas/ }));
    expect(await screen.findByText("Não foi possível carregar as despesas desta fatura.")).toBeInTheDocument();
  });
});
