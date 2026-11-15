import { render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";
import { AllProviders, router } from "@/test/helpers/providers";
import type { FinanceReader } from "@/lib/api/finance-reader";

vi.mock("server-only", () => ({}));
vi.mock("next/navigation", () => ({ useRouter: () => router, usePathname: () => "/dashboard" }));
vi.mock("next/link", () => ({ default: ({ children, href }: { children: ReactNode; href: string }) => <a href={href}>{children}</a> }));

// jsdom nao renderiza Server Components assincronos: os blocos viram componentes sincronos controlados pelo teste (ADR 0012 9.1).
const { mode, behave } = vi.hoisted(() => ({
  mode: { monthly: "ok" as "ok" | "throw" | "pending", categories: "ok" as "ok" | "throw" | "pending" },
  behave: (how: "ok" | "throw" | "pending") => {
    if (how === "throw") throw new Error("boom");
    if (how === "pending") throw new Promise(() => {});
  },
}));
vi.mock("./_components/dashboard-blocks", () => ({
  SummaryCards: () => <section aria-label="Resumo do mes">resumo</section>,
  MonthlyChartBlock: () => (behave(mode.monthly), (<figure aria-label="Evolução mensal">evolucao</figure>)),
  CategoryDonutBlock: () => (behave(mode.categories), (<figure aria-label="Despesas por categoria">categorias</figure>)),
}));
vi.mock("./_components/dashboard-header", () => ({ DashboardHeader: () => <h1>Dashboard</h1> }));
// catchError do Next exige o runtime do Next; o contrato testado e: mensagem do bloco + isolamento entre blocos (RF06).
vi.mock("@/components/ui/block-error-boundary", async () => {
  const { Component } = await import("react");
  class Boundary extends Component<{ message: string; children: ReactNode }, { failed: boolean }> {
    state = { failed: false };
    static getDerivedStateFromError() {
      return { failed: true };
    }
    render() {
      return this.state.failed ? <div role="alert">{this.props.message}</div> : this.props.children;
    }
  }
  return { BlockErrorBoundary: Boundary };
});

import { DashboardScreen } from "./dashboard-screen";

const reader = {} as FinanceReader;
const FORBIDDEN = /(^|:)(col-span-|col-start-|row-start-|order-|grid-cols-(?!1$)|flex-row|flex-col-reverse|flex-row-reverse)/;
const precedes = (a: Element, b: Element) => Boolean(a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING);

function renderScreen(month = "2026-11") {
  mode.monthly = "ok";
  mode.categories = "ok";
  return render(
    <AllProviders>
      <DashboardScreen searchParams={{ month }} reader={reader} />
    </AllProviders>,
  );
}

describe("DashboardScreen (ADR 0012, RF01-RF07)", () => {
  it("evolucao mensal vem antes de despesas por categoria no DOM (CA01, CA06)", () => {
    renderScreen("2026-11");
    const monthly = screen.getByRole("figure", { name: "Evolução mensal" });
    const categories = screen.getByRole("figure", { name: "Despesas por categoria" });
    expect(precedes(screen.getByRole("heading", { name: "Dashboard" }), screen.getByRole("region", { name: "Resumo do mes" }))).toBe(true);
    expect(precedes(screen.getByRole("region", { name: "Resumo do mes" }), monthly)).toBe(true);
    expect(precedes(monthly, categories)).toBe(true);
  });

  it("nenhum ancestral dos dois blocos coloca colunas lado a lado, reordena ou usa lg:col-span-8/4 (CA02)", () => {
    const { container } = renderScreen();
    for (const name of ["Evolução mensal", "Despesas por categoria"]) {
      for (let el: Element | null = screen.getByRole("figure", { name }).parentElement; el && el !== container; el = el.parentElement) {
        expect([...el.classList].filter((c) => FORBIDDEN.test(c)), `${name} -> ${el.className}`).toEqual([]);
      }
    }
  });

  it("cada bloco tem a propria UpdatingRegion (aria-busy), sem compartilhar com o outro (RF06)", () => {
    renderScreen();
    const regionOf = (name: string) => screen.getByRole("figure", { name }).closest("[aria-busy]");
    const a = regionOf("Evolução mensal");
    const b = regionOf("Despesas por categoria");
    expect(a).not.toBeNull();
    expect(b).not.toBeNull();
    expect(a).not.toBe(b);
    expect(a!.contains(b)).toBe(false);
    expect(b!.contains(a)).toBe(false);
  });

  it("erro so em despesas por categoria: mensagem do bloco, evolucao mensal intacta e acima (CA05)", () => {
    mode.monthly = "ok";
    mode.categories = "throw";
    vi.spyOn(console, "error").mockImplementation(() => {});
    render(
      <AllProviders>
        <DashboardScreen searchParams={{ month: "2026-11" }} reader={reader} />
      </AllProviders>,
    );
    const alert = screen.getByRole("alert");
    expect(alert).toHaveTextContent("Não foi possível carregar as despesas por categoria.");
    expect(precedes(screen.getByRole("figure", { name: "Evolução mensal" }), alert)).toBe(true);
    vi.restoreAllMocks();
  });

  it("erro so na evolucao mensal: mensagem em cima e donut embaixo (CA05, inverso)", () => {
    mode.monthly = "throw";
    mode.categories = "ok";
    vi.spyOn(console, "error").mockImplementation(() => {});
    render(
      <AllProviders>
        <DashboardScreen searchParams={{ month: "2026-11" }} reader={reader} />
      </AllProviders>,
    );
    const alert = screen.getByRole("alert");
    expect(alert).toHaveTextContent("Não foi possível carregar a evolução mensal.");
    expect(precedes(alert, screen.getByRole("figure", { name: "Despesas por categoria" }))).toBe(true);
    vi.restoreAllMocks();
  });

  it("fallbacks de Suspense: skeleton das barras antes do skeleton do donut, ambos anunciados (RF05, CA04)", () => {
    mode.monthly = "pending";
    mode.categories = "pending";
    render(
      <AllProviders>
        <DashboardScreen searchParams={{ month: "2026-11" }} reader={reader} />
      </AllProviders>,
    );
    const monthly = screen.getByText("Carregando evolução mensal");
    const donut = screen.getByText("Carregando despesas por categoria");
    expect(precedes(monthly, donut)).toBe(true);
  });
});
