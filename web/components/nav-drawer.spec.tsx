import { act, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { pressEscapeInDialog } from "@/test/helpers/dialog";

const nav = vi.hoisted(() => ({ pathname: "/dashboard" }));
vi.mock("next/navigation", () => ({ usePathname: () => nav.pathname, useRouter: () => ({ push: vi.fn(), replace: vi.fn(), refresh: vi.fn() }) }));
vi.mock("next/link", () => ({ default: ({ children, href, scroll, prefetch, ...rest }: { children: ReactNode; href: string; scroll?: boolean; prefetch?: boolean } & Record<string, unknown>) => (void scroll, void prefetch, (<a href={href} {...rest}>{children}</a>)) }));

import { NavDrawer } from "./nav-drawer";

const trigger = () => screen.getByRole("button", { name: "Abrir menu de navegação" });

beforeEach(() => {
  nav.pathname = "/dashboard";
});

describe("NavDrawer: botao de menu (design 17.6, 17.14)", () => {
  it("fechado: aria-haspopup=dialog, aria-expanded=false, sem aria-controls e sem dialogo no DOM", () => {
    render(<NavDrawer />);
    expect(trigger()).toHaveAttribute("aria-haspopup", "dialog");
    expect(trigger()).toHaveAttribute("aria-expanded", "false");
    expect(trigger()).not.toHaveAttribute("aria-controls");
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("abre por clique: dialogo 'Menu de navegacao' com a navegacao Principal, fechar e foco no item ativo", async () => {
    render(<NavDrawer />);
    await userEvent.click(trigger());
    const dialog = screen.getByRole("dialog", { name: "Menu de navegação" });
    expect(trigger()).toHaveAttribute("aria-expanded", "true");
    expect(trigger()).toHaveAttribute("aria-controls");
    expect(within(dialog).getByRole("navigation", { name: "Principal" })).toBeInTheDocument();
    expect(within(dialog).getByRole("button", { name: "Fechar menu de navegação" })).toBeInTheDocument();
    expect(within(dialog).getByRole("link", { name: "Dashboard" })).toHaveFocus();
    expect(within(dialog).getByRole("link", { name: "Dashboard" })).toHaveAttribute("aria-current", "page");
  });

  it("sem item ativo (ex.: /account) o foco vai para o primeiro item", async () => {
    nav.pathname = "/account";
    render(<NavDrawer />);
    await userEvent.click(trigger());
    expect(screen.getByRole("link", { name: "Lançamentos" })).toHaveFocus();
  });

  it("abre por teclado (Enter e Espaco)", async () => {
    render(<NavDrawer />);
    trigger().focus();
    await userEvent.keyboard("{Enter}");
    expect(screen.getByRole("dialog")).toBeInTheDocument();
    pressEscapeInDialog();
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    trigger().focus();
    await userEvent.keyboard(" ");
    expect(screen.getByRole("dialog")).toBeInTheDocument();
  });

  it("Esc (evento cancel do dialog) fecha; o foco de volta ao botao e verificado no Playwright", async () => {
    render(<NavDrawer />);
    await userEvent.click(trigger());
    pressEscapeInDialog();
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(trigger()).toHaveAttribute("aria-expanded", "false");
  });

  it("clicar no scrim (o proprio <dialog>) fecha sem navegar", async () => {
    render(<NavDrawer />);
    await userEvent.click(trigger());
    await userEvent.click(screen.getByRole("dialog"));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("'Fechar menu de navegacao' fecha", async () => {
    render(<NavDrawer />);
    await userEvent.click(trigger());
    await userEvent.click(screen.getByRole("button", { name: "Fechar menu de navegação" }));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("ativar um item fecha o drawer; o item da pagina atual so fecha", async () => {
    render(<NavDrawer />);
    await userEvent.click(trigger());
    await userEvent.click(screen.getByRole("link", { name: "Cartões" }));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    await userEvent.click(trigger());
    await userEvent.click(screen.getByRole("link", { name: "Dashboard" }));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("mudar o pathname (voltar do navegador) fecha o drawer", async () => {
    const { rerender } = render(<NavDrawer />);
    await userEvent.click(trigger());
    nav.pathname = "/cards";
    rerender(<NavDrawer />);
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("viewport passa a >= xl com o drawer aberto: fecha", async () => {
    const listeners: Array<(e: { matches: boolean }) => void> = [];
    vi.stubGlobal("matchMedia", (q: string) => ({ matches: false, media: q, addEventListener: (_: string, cb: (e: { matches: boolean }) => void) => listeners.push(cb), removeEventListener: vi.fn(), addListener: vi.fn(), removeListener: vi.fn() }));
    render(<NavDrawer />);
    await userEvent.click(trigger());
    act(() => {
      Object.defineProperty(window, "innerWidth", { configurable: true, value: 1300 });
      window.dispatchEvent(new Event("resize"));
      listeners.forEach((cb) => cb({ matches: true }));
    });
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    vi.unstubAllGlobals();
  });

  it("sem chip de demonstracao, sem itens de administracao e sem href para /demo", async () => {
    render(<NavDrawer />);
    await userEvent.click(trigger());
    const dialog = screen.getByRole("dialog");
    expect(within(dialog).queryByText("Demonstração")).not.toBeInTheDocument();
    expect(within(dialog).queryByRole("link", { name: /Usuários/ })).not.toBeInTheDocument();
    for (const l of within(dialog).getAllByRole("link")) expect(l.getAttribute("href")).not.toMatch(/\/demo/);
  });
});
