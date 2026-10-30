import { render, screen, within } from "@testing-library/react";
import type { ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";

vi.mock("next/navigation", () => ({ usePathname: () => "/demo/cards", useRouter: () => ({ push: vi.fn() }) }));
vi.mock("next/link", () => ({ default: ({ children, href, scroll, prefetch, ...rest }: { children: ReactNode; href: string; scroll?: boolean; prefetch?: boolean } & Record<string, unknown>) => (void scroll, void prefetch, (<a href={href} {...rest}>{children}</a>)) }));

import { AppSidebar } from "./app-sidebar";

describe("AppSidebar (design 17.5)", () => {
  it("uma <nav aria-label='Principal'> com os tres itens da demo e Cartoes ativo", () => {
    render(<AppSidebar basePath="/demo" />);
    const nav = screen.getByRole("navigation", { name: "Principal" });
    expect(within(nav).getAllByRole("link").map((l) => l.getAttribute("href"))).toEqual(["/demo/entries", "/demo/dashboard", "/demo/cards"]);
    expect(within(nav).getByRole("link", { name: "Cartões" })).toHaveAttribute("aria-current", "page");
  });

  it("nao e recolhivel: sem botao de recolher (DL3)", () => {
    render(<AppSidebar basePath="" />);
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });
});
