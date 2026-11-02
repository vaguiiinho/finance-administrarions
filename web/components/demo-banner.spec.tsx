import { render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";
import type { CurrentUserDto } from "@/lib/api/types";

vi.mock("next/link", () => ({ default: ({ children, href, scroll, prefetch, ...rest }: { children: ReactNode; href: string; scroll?: boolean; prefetch?: boolean } & Record<string, unknown>) => (void scroll, void prefetch, (<a href={href} {...rest}>{children}</a>)) }));

import { DemoBanner } from "./demo-banner";

const ANA: CurrentUserDto = { id: "u1", name: "Ana Souza", email: "ana@exemplo.com", role: "USER", mustChangePassword: false, accountKind: "REGULAR", capabilities: ["CHANGE_OWN_PASSWORD", "MANAGE_EXPENSES", "UPDATE_OWN_PROFILE"] };

describe("DemoBanner (RF32, RF36, CA38, CA42, design 2.5)", () => {
  it("visitante: texto exato e UNICA acao 'Entrar' com next equivalente", () => {
    render(<DemoBanner user={null} path="/demo/cards" />);
    expect(screen.getByText("Você está vendo dados de exemplo.")).toBeInTheDocument();
    expect(screen.getByText("Os dados são fictícios e não podem ser alterados.")).toBeInTheDocument();
    const links = screen.getAllByRole("link");
    expect(links).toHaveLength(1);
    expect(links[0]).toHaveTextContent("Entrar");
    expect(links[0]).toHaveAttribute("href", "/login?next=/cards");
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });

  it("logado: 'Ir para meus dados' -> /entries, sem 'Entrar' (CA42)", () => {
    render(<DemoBanner user={ANA} path="/demo/entries" />);
    expect(screen.getByText("Você está vendo dados de exemplo.")).toBeInTheDocument();
    expect(screen.getByText("Seus lançamentos não aparecem aqui.")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Ir para meus dados" })).toHaveAttribute("href", "/entries");
    expect(screen.queryByRole("link", { name: "Entrar" })).not.toBeInTheDocument();
  });

  it("e uma regiao rotulada, estatica (sem alert/status) e sem botao de fechar", () => {
    render(<DemoBanner user={null} path="/demo/dashboard" />);
    expect(screen.getByRole("region")).toBeInTheDocument();
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });

  it("nao convida a criar conta", () => {
    render(<DemoBanner user={null} path="/demo/entries" />);
    expect(screen.queryByText(/Criar conta|Cadastre/i)).not.toBeInTheDocument();
  });
});
