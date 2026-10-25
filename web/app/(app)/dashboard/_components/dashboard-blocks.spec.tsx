import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { AllProviders, router } from "@/test/helpers/providers";
import { mockedRecharts } from "@/test/helpers/recharts-mock";

vi.mock("server-only", () => ({}));
const ep = vi.hoisted(() => ({ getSummary: vi.fn(), getMonthlySeries: vi.fn(), getCategoryDistribution: vi.fn(), listCards: vi.fn(), listCategories: vi.fn() }));
vi.mock("@/lib/api/endpoints", () => ep);
vi.mock("recharts", async (o) => mockedRecharts(await o<typeof import("recharts")>()));
vi.mock("next/navigation", () => ({ useRouter: () => router, usePathname: () => "/dashboard" }));
vi.mock("next/link", () => ({ default: ({ children, href, scroll, ...rest }: { children: ReactNode; href: string; scroll?: boolean } & Record<string, unknown>) => (void scroll, (<a href={href} {...rest}>{children}</a>)) }));

import { CategoryDonutBlock, MonthlyChartBlock, SummaryCards } from "./dashboard-blocks";
import { DashboardHeader } from "./dashboard-header";

const zero = { income: "0.00", expenses: { total: "0.00", paid: "0.00", pending: "0.00" }, balance: { realized: "0.00", projected: "0.00" } };

beforeEach(() => {
  Object.values(ep).forEach((f) => f.mockReset());
  router.push.mockClear();
});

describe("blocos do dashboard (RF15-RF17, RF26)", () => {
  it("cards do mes usam a mesma fonte S1 (CA59)", async () => {
    ep.getSummary.mockResolvedValue({ month: "2026-11", totals: { ...zero, income: "5000.00", balance: { realized: "5000.00", projected: "5000.00" } } });
    render(await SummaryCards({ month: "2026-11" }));
    expect(ep.getSummary).toHaveBeenCalledWith("2026-11");
    expect(screen.getByRole("region", { name: "Resumo de novembro de 2026" })).toBeInTheDocument();
  });

  it("grafico e donut recebem os dados dos endpoints D2 e D3", async () => {
    const months = ["2025-12", "2026-01", "2026-02", "2026-03", "2026-04", "2026-05", "2026-06", "2026-07", "2026-08", "2026-09", "2026-10", "2026-11"];
    ep.getMonthlySeries.mockResolvedValue({ from: "2025-12", to: "2026-11", points: months.map((month) => ({ month, totals: zero })) });
    ep.getCategoryDistribution.mockResolvedValue({ month: "2026-11", total: "0.00", items: [] });
    render(<>{await MonthlyChartBlock({ month: "2026-11" })}{await CategoryDonutBlock({ month: "2026-11" })}</>);
    expect(screen.getByText("Sem lançamentos de dez/25 a nov/26")).toBeInTheDocument();
    expect(screen.getByText("Nenhuma despesa em novembro de 2026")).toBeInTheDocument();
  });

  it("falha de um bloco rejeita so aquela leitura (a fronteira de erro cuida do resto)", async () => {
    ep.getMonthlySeries.mockRejectedValue(new Error("500"));
    await expect(MonthlyChartBlock({ month: "2026-11" })).rejects.toThrow("500");
  });
});

describe("DashboardHeader", () => {
  it("navega por mes na URL do dashboard e linka para os lancamentos do mesmo mes", async () => {
    render(<AllProviders><DashboardHeader month="2026-11" currentMonth="2026-10" /></AllProviders>);
    await userEvent.click(screen.getByRole("button", { name: "Próximo mês" }));
    expect(router.push).toHaveBeenLastCalledWith("/dashboard?month=2026-12", { scroll: false });
    expect(screen.getByRole("link", { name: "Ver lançamentos do mês" })).toHaveAttribute("href", "/entries?month=2026-11");
    await userEvent.click(screen.getByRole("button", { name: "Mês atual" }));
    expect(router.push).toHaveBeenLastCalledWith("/dashboard?month=2026-10", { scroll: false });
  });
});
