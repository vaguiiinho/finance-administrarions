import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const nav = vi.hoisted(() => ({ pathname: "/entries" }));
vi.mock("next/navigation", () => ({ usePathname: () => nav.pathname, useRouter: () => ({ push: vi.fn(), replace: vi.fn(), refresh: vi.fn() }) }));
vi.mock("next/link", () => ({ default: ({ children, href, scroll, prefetch, ...rest }: { children: ReactNode; href: string; scroll?: boolean; prefetch?: boolean } & Record<string, unknown>) => (void scroll, void prefetch, (<a href={href} {...rest}>{children}</a>)) }));

import { MainNav } from "./main-nav";

const links = () => within(screen.getByRole("navigation", { name: "Principal" })).getAllByRole("link");

beforeEach(() => {
  nav.pathname = "/entries";
});

describe("MainNav sem modo demonstracao (ADR 0013 9.4; design 17.4, 17.7)", () => {
  it("protegido: tres itens na ordem fixa, com ate hrefs sem prefixo", () => {
    render(<MainNav />);
    expect(links().map((l) => [l.textContent, l.getAttribute("href")])).toEqual([
      ["Lançamentos", "/entries"],
      ["Dashboard", "/dashboard"],
      ["Cartões", "/cards"],
    ]);
  });

  it("subcaminho ativa o item (/cards/abc); prefixo sem fronteira nao (/cardsx)", () => {
    nav.pathname = "/cards/abc";
    const { unmount } = render(<MainNav />);
    expect(screen.getByRole("link", { name: "Cartões" })).toHaveAttribute("aria-current", "page");
    unmount();
    nav.pathname = "/cardsx";
    render(<MainNav />);
    expect(links().filter((l) => l.getAttribute("aria-current"))).toHaveLength(0);
  });

  it("CA09: em /demo/* (rota que nao existe mais) nenhum item fica ativo e nenhum href aponta para /demo", () => {
    nav.pathname = "/demo/cards";
    render(<MainNav />);
    expect(links().filter((l) => l.getAttribute("aria-current"))).toHaveLength(0);
    for (const l of links()) expect(l.getAttribute("href")).not.toMatch(/\/demo/);
  });

  it.each(["/account", "/account/password", "/admin/users", "/login"])("em %s nenhum item fica ativo", (pathname) => {
    nav.pathname = pathname;
    render(<MainNav />);
    expect(links().filter((l) => l.getAttribute("aria-current"))).toHaveLength(0);
  });

  it("nao existe item de administracao no menu (DL4)", () => {
    render(<MainNav />);
    expect(screen.queryByRole("link", { name: /Usuários/ })).not.toBeInTheDocument();
  });

  it("cada item tem icone decorativo (aria-hidden) e texto visivel; itens em ul/li", () => {
    render(<MainNav />);
    for (const link of links()) {
      expect(link.querySelector("svg[aria-hidden='true']")).toBeInTheDocument();
      expect(link.closest("li")).not.toBeNull();
    }
    expect(screen.getByRole("list")).toBeInTheDocument();
  });

  it("onNavigate e chamado ao ativar um item (o drawer fecha)", async () => {
    const onNavigate = vi.fn();
    render(<MainNav onNavigate={onNavigate} />);
    await userEvent.click(screen.getByRole("link", { name: "Dashboard" }));
    expect(onNavigate).toHaveBeenCalledTimes(1);
  });
});
