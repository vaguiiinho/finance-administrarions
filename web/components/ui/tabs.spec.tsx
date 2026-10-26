import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { AllProviders, router } from "@/test/helpers/providers";
import { Tabs } from "./tabs";

vi.mock("next/navigation", () => ({ useRouter: () => router, usePathname: () => "/entries" }));
vi.mock("next/link", () => ({
  default: ({ children, href, scroll, ...rest }: { children: ReactNode; href: string; scroll?: boolean } & Record<string, unknown>) => (
    void scroll,
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));

const items = [
  { id: "expenses", label: "Despesas", href: "/entries?month=2026-11" },
  { id: "invoices", label: "Faturas", href: "/entries?month=2026-11&tab=invoices" },
  { id: "income", label: "Receitas", href: "/entries?month=2026-11&tab=income" },
] as const;

const setup = () =>
  render(
    <AllProviders>
      <Tabs items={items} activeId="expenses" label="Lançamentos do mês" idPrefix="entries" />
    </AllProviders>,
  );

beforeEach(() => {
  router.push.mockClear();
});

describe("Tabs (D18, design 3.4): abas-link com ativacao manual", () => {
  it("tablist/tab com aria-selected, aria-controls e tabindex movel", () => {
    setup();
    expect(screen.getByRole("tablist", { name: "Lançamentos do mês" })).toBeInTheDocument();
    const tabs = screen.getAllByRole("tab");
    expect(tabs.map((t) => t.textContent)).toEqual(["Despesas", "Faturas", "Receitas"]);
    expect(tabs.map((t) => t.getAttribute("aria-selected"))).toEqual(["true", "false", "false"]);
    expect(tabs.map((t) => t.getAttribute("tabindex"))).toEqual(["0", "-1", "-1"]);
    expect(tabs[1]).toHaveAttribute("aria-controls", "entries-panel-invoices");
    expect(tabs[1]).toHaveAttribute("href", "/entries?month=2026-11&tab=invoices");
  });

  it("setas, Home e End MOVEM o foco sem ativar (nenhuma navegacao)", async () => {
    setup();
    const [despesas, faturas, receitas] = screen.getAllByRole("tab");
    despesas.focus();
    await userEvent.keyboard("{ArrowRight}");
    expect(faturas).toHaveFocus();
    await userEvent.keyboard("{End}");
    expect(receitas).toHaveFocus();
    await userEvent.keyboard("{ArrowRight}");
    expect(despesas).toHaveFocus();
    await userEvent.keyboard("{ArrowLeft}");
    expect(receitas).toHaveFocus();
    await userEvent.keyboard("{Home}");
    expect(despesas).toHaveFocus();
    expect(router.push).not.toHaveBeenCalled();
  });

  it("Enter e Espaco ativam a aba focada (navegacao para a URL da aba)", async () => {
    setup();
    const [, faturas, receitas] = screen.getAllByRole("tab");
    faturas.focus();
    await userEvent.keyboard("{Enter}");
    expect(router.push).toHaveBeenLastCalledWith("/entries?month=2026-11&tab=invoices", { scroll: false });
    receitas.focus();
    await userEvent.keyboard(" ");
    expect(router.push).toHaveBeenLastCalledWith("/entries?month=2026-11&tab=income", { scroll: false });
  });

  it("clique com Ctrl/Cmd preserva o comportamento nativo de link (nova aba)", async () => {
    setup();
    const swallowNativeNavigation = (e: Event) => e.preventDefault(); // jsdom nao navega
    document.addEventListener("click", swallowNativeNavigation);
    fireEvent.click(screen.getByRole("tab", { name: "Faturas" }), { ctrlKey: true });
    fireEvent.click(screen.getByRole("tab", { name: "Receitas" }), { metaKey: true });
    document.removeEventListener("click", swallowNativeNavigation);
    expect(router.push).not.toHaveBeenCalled();
  });
});
