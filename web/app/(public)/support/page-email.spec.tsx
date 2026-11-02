import { render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import Page from "./page";

afterEach(() => vi.unstubAllEnvs());

describe("/support: e-mail vindo de SUPPORT_EMAIL", () => {
  it("variavel presente -> link mailto: com o valor", () => {
    vi.stubEnv("SUPPORT_EMAIL", "ajuda@example.org");
    render(<Page />);
    expect(screen.getByRole("link", { name: "ajuda@example.org" })).toHaveAttribute("href", "mailto:ajuda@example.org");
  });

  it.each(["", "   "])("variavel ausente ou vazia (%j) -> texto neutro, sem mailto", (value) => {
    vi.stubEnv("SUPPORT_EMAIL", value);
    render(<Page />);
    expect(screen.queryAllByRole("link")).toHaveLength(0);
    expect(screen.getByText(/entre em contato com o administrador/i)).toBeInTheDocument();
  });
});
