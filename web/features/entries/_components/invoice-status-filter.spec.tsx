import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { AllProviders, router } from "@/test/helpers/providers";
import { AppModeProvider, DEMO_MODE } from "@/components/app-mode";
import { parseEntriesSearchParams } from "@/lib/filters/entries-search-params";

vi.mock("next/navigation", () => ({ useRouter: () => router, usePathname: () => "/entries" }));
vi.mock("next/link", () => ({ default: ({ children, href, scroll, ...rest }: { children: ReactNode; href: string; scroll?: boolean } & Record<string, unknown>) => (void scroll, (<a href={href} {...rest}>{children}</a>)) }));

import { InvoiceStatusFilter } from "./invoice-status-filter";

/**
 * Controle de status da aba Faturas (RF16, RF11, RF19, RF23; design 3.1/3.2; ADR 7.4).
 * CONTRATO PROPOSTO PELO TESTER: <InvoiceStatusFilter state={EntriesState} /> (mesma forma de ExpenseFilters).
 */
const NOW = new Date("2026-10-24T13:00:00.000Z");
const st = (raw: Record<string, string> = {}) => parseEntriesSearchParams({ month: "2026-11", tab: "invoices", ...raw }, NOW);
const wrap = (ui: ReactNode) => render(<AllProviders>{ui}</AllProviders>);
const lastHref = () => router.push.mock.lastCall![0] as string;
const params = (href: string) => new URLSearchParams(href.split("?")[1]);

beforeEach(() => {
  router.push.mockClear();
  router.refresh.mockClear();
});

describe("InvoiceStatusFilter - >= md (aplica ao mudar)", () => {
  it("RF16: opcoes Todos / Pendente / Pago, nesta ordem, com o rotulo 'Status'", () => {
    wrap(<InvoiceStatusFilter state={st()} />);
    const group = screen.getAllByRole("radiogroup")[0];
    expect(within(group).getAllByRole("radio").map((r) => r.getAttribute("aria-label") ?? r.textContent)).toEqual(["Todos", "Pendente", "Pago"]);
    expect(group).toHaveAccessibleName("Status");
  });

  it("RF09/CA45: sem f_status, 'Pendente' esta selecionado; CA50: valor invalido tambem", () => {
    const a = wrap(<InvoiceStatusFilter state={st()} />);
    expect(screen.getAllByRole("radio", { name: "Pendente" })[0]).toBeChecked();
    a.unmount();
    wrap(<InvoiceStatusFilter state={st({ f_status: "lixo" })} />);
    expect(screen.getAllByRole("radio", { name: "Pendente" })[0]).toBeChecked();
  });

  it.each([["ALL", "Todos"], ["PAID", "Pago"]])("f_status=%s seleciona '%s'", (status, label) => {
    wrap(<InvoiceStatusFilter state={st({ f_status: status })} />);
    expect(screen.getAllByRole("radio", { name: label })[0]).toBeChecked();
  });

  it("CA47: selecionar 'Pago' navega para f_status=PAID mantendo mes e aba, na pagina 1", async () => {
    wrap(<InvoiceStatusFilter state={st({ page: "3" })} />);
    await userEvent.click(screen.getAllByRole("radio", { name: "Pago" })[0]);
    const q = params(lastHref());
    expect(lastHref().startsWith("/entries?")).toBe(true);
    expect(q.get("f_status")).toBe("PAID");
    expect(q.get("month")).toBe("2026-11");
    expect(q.get("tab")).toBe("invoices");
    expect(q.has("page")).toBe(false);
  });

  it("selecionar 'Todos' escreve f_status=ALL; selecionar 'Pendente' volta ao padrao (sem parametro)", async () => {
    const a = wrap(<InvoiceStatusFilter state={st()} />);
    await userEvent.click(screen.getAllByRole("radio", { name: "Todos" })[0]);
    expect(params(lastHref()).get("f_status")).toBe("ALL");
    a.unmount();
    wrap(<InvoiceStatusFilter state={st({ f_status: "ALL" })} />);
    await userEvent.click(screen.getAllByRole("radio", { name: "Pendente" })[0]);
    expect(params(lastHref()).has("f_status")).toBe(false);
  });

  it("RF19/CA49: mudar o status de Faturas preserva d_status (e demais filtros de Despesas)", async () => {
    wrap(<InvoiceStatusFilter state={st({ d_status: "PAID", d_category: "Moradia" })} />);
    await userEvent.click(screen.getAllByRole("radio", { name: "Todos" })[0]);
    const q = params(lastHref());
    expect(q.get("d_status")).toBe("PAID");
    expect(q.get("d_category")).toBe("Moradia");
  });

  it("navegacao dentro da aba Faturas por /demo respeita o basePath", async () => {
    render(
      <AppModeProvider mode={DEMO_MODE}>
        <AllProviders>
          <InvoiceStatusFilter state={st()} />
        </AllProviders>
      </AppModeProvider>,
    );
    await userEvent.click(screen.getAllByRole("radio", { name: "Pago" })[0]);
    expect(lastHref().startsWith("/demo/entries?")).toBe(true);
  });
});

describe("InvoiceStatusFilter - 'Limpar filtros' (RF11, CA51)", () => {
  it("visivel enquanto o padrao Pendente (ou Pago) estiver ativo; leva a Todos sem mudar mes e aba", async () => {
    wrap(<InvoiceStatusFilter state={st()} />);
    await userEvent.click(screen.getAllByRole("button", { name: "Limpar filtros" })[0]);
    const q = params(lastHref());
    expect(q.get("f_status")).toBe("ALL");
    expect(q.get("month")).toBe("2026-11");
    expect(q.get("tab")).toBe("invoices");
  });

  it("some quando Todos esta selecionado (a lista mostra tudo)", () => {
    wrap(<InvoiceStatusFilter state={st({ f_status: "ALL" })} />);
    expect(screen.queryAllByRole("button", { name: /^Limpar/ })).toHaveLength(0); // inline e mobile (nome acessivel "Limpar filtros")
  });

  it("'Limpar filtros' de Faturas nao altera d_status", async () => {
    wrap(<InvoiceStatusFilter state={st({ d_status: "PAID" })} />);
    await userEvent.click(screen.getAllByRole("button", { name: "Limpar filtros" })[0]);
    expect(params(lastHref()).get("d_status")).toBe("PAID");
  });
});

describe("InvoiceStatusFilter - < md (folha com 'Aplicar', RF16, CA37-like, CA51, CA60)", () => {
  it("botao 'Filtros (1)' com o padrao; 'Filtros' sem contador quando Todos", () => {
    const a = wrap(<InvoiceStatusFilter state={st()} />);
    expect(screen.getByRole("button", { name: "Filtros (1)" })).toBeInTheDocument();
    a.unmount();
    wrap(<InvoiceStatusFilter state={st({ f_status: "ALL" })} />);
    expect(screen.getByRole("button", { name: "Filtros" })).toBeInTheDocument();
  });

  it("a folha so navega em 'Aplicar'; 'Limpar' da folha muda o rascunho para Todos", async () => {
    wrap(<InvoiceStatusFilter state={st()} />);
    await userEvent.click(screen.getByRole("button", { name: "Filtros (1)" }));
    const sheet = within(screen.getByRole("dialog"));
    await userEvent.click(sheet.getByRole("radio", { name: "Pago" }));
    expect(router.push).not.toHaveBeenCalled();
    await userEvent.click(sheet.getByRole("button", { name: "Limpar" }));
    expect(sheet.getByRole("radio", { name: "Todos" })).toBeChecked();
    expect(router.push).not.toHaveBeenCalled();
    await userEvent.click(sheet.getByRole("button", { name: "Aplicar" }));
    expect(params(lastHref()).get("f_status")).toBe("ALL");
  });

  it("o botao 'Limpar' fora da folha aplica Todos na hora", async () => {
    wrap(<InvoiceStatusFilter state={st()} />);
    // botao mobile: texto visivel "Limpar", nome acessivel "Limpar filtros" (design 3.2); o inline tem o texto "Limpar filtros"
    const mobile = screen.getByText("Limpar", { selector: "button" });
    expect(mobile).toHaveAccessibleName("Limpar filtros");
    await userEvent.click(mobile);
    expect(params(lastHref()).get("f_status")).toBe("ALL");
  });

  it("RF23/CA60: 'Status: Pendente' fora da folha; mostra o status APLICADO, nao o rascunho", async () => {
    wrap(<InvoiceStatusFilter state={st()} />);
    expect(screen.getByText("Status: Pendente")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Filtros (1)" }));
    await userEvent.click(within(screen.getByRole("dialog")).getByRole("radio", { name: "Pago" }));
    expect(screen.getByText("Status: Pendente")).toBeInTheDocument();
    expect(screen.queryByText("Status: Pago")).not.toBeInTheDocument();
  });

  it.each([["ALL", "Status: Todos"], ["PAID", "Status: Pago"]])("f_status=%s -> '%s'", (status, text) => {
    wrap(<InvoiceStatusFilter state={st({ f_status: status })} />);
    expect(screen.getByText(text)).toBeInTheDocument();
  });

  it("a indicacao 'Status:' e texto estatico, fora de regiao viva", () => {
    wrap(<InvoiceStatusFilter state={st()} />);
    expect(screen.getByText("Status: Pendente").closest("[aria-live], [role='status']")).toBeNull();
  });
});
