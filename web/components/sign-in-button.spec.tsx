import { render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";

const nav = vi.hoisted(() => ({ pathname: "/demo/cards" }));
vi.mock("next/navigation", () => ({ usePathname: () => nav.pathname }));
vi.mock("next/link", () => ({ default: ({ children, href, scroll, prefetch, ...rest }: { children: ReactNode; href: string; scroll?: boolean; prefetch?: boolean } & Record<string, unknown>) => (void scroll, void prefetch, (<a href={href} {...rest}>{children}</a>)) }));

import { SignInButton } from "./sign-in-button";

describe("SignInButton (RF37, CA43, design 2.2)", () => {
  it.each([
    ["/demo/cards", "/login?next=/cards"],
    ["/demo/entries", "/login?next=/entries"],
    ["/demo/dashboard", "/login?next=/dashboard"],
    ["/demo/cards/abc", "/login?next=/cards"],
    ["/login", "/login"],
    ["/qualquer", "/login"],
  ])("em %s leva a %s", (pathname, href) => {
    nav.pathname = pathname;
    render(<SignInButton />);
    expect(screen.getByRole("link", { name: "Entrar" })).toHaveAttribute("href", href);
  });

  it("so o caminho vai no next: query da demo (mes, filtros, ids) nao vaza para os dados do usuario", () => {
    nav.pathname = "/demo/entries";
    render(<SignInButton />);
    expect(screen.getByRole("link", { name: "Entrar" }).getAttribute("href")).not.toMatch(/month|\?.*\?/);
  });

  it("e um link (<a>) com alvo de pelo menos 44px de altura minima", () => {
    nav.pathname = "/demo/cards";
    render(<SignInButton />);
    const link = screen.getByRole("link", { name: "Entrar" });
    expect(link.tagName).toBe("A");
    expect(link.className).toMatch(/min-h-11|h-11|min-h-\[44px\]|h-\[44px\]/);
  });

  it("nao oferece 'Criar conta'", () => {
    render(<SignInButton />);
    expect(screen.queryByText(/Criar conta/i)).not.toBeInTheDocument();
  });
});
