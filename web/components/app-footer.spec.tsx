import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { AppFooter } from "./app-footer";

describe("AppFooter (design 17.8, PL3)", () => {
  it("e o landmark contentinfo com nome, ano e versao", () => {
    render(<AppFooter year={2026} version="0.1.0" />);
    const footer = screen.getByRole("contentinfo");
    expect(footer).toHaveTextContent("Finanças");
    expect(footer).toHaveTextContent("© 2026");
    expect(footer).toHaveTextContent("Versão 0.1.0");
  });

  it("sem versao no build, o trecho some (sem 'Versão undefined')", () => {
    render(<AppFooter year={2026} />);
    expect(screen.getByRole("contentinfo")).not.toHaveTextContent(/Vers/);
    expect(screen.getByRole("contentinfo")).not.toHaveTextContent("undefined");
  });

  it("RF03: o rodape nao tem link nenhum (sem 'Ver demonstração' nem href para /demo)", () => {
    render(<AppFooter year={2026} version="0.1.0" />);
    expect(screen.queryByRole("link")).not.toBeInTheDocument();
    expect(screen.queryByText(/demonstra/i)).not.toBeInTheDocument();
  });

  it("nao mostra dados pessoais nem 'Entrar' ", () => {
    render(<AppFooter year={2026} version="0.1.0" />);
    expect(screen.queryByRole("link", { name: "Entrar" })).not.toBeInTheDocument();
    expect(screen.getByRole("contentinfo")).not.toHaveTextContent(/@/);
  });

  it("separadores sao aria-hidden", () => {
    const { container } = render(<AppFooter year={2026} version="0.1.0" />);
    const seps = Array.from(container.querySelectorAll("[aria-hidden='true']")).filter((e) => e.textContent?.trim() === "·");
    expect(seps.length).toBeGreaterThan(0);
  });
});
