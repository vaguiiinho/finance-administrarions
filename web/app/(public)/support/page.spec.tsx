import { render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import Page, { metadata } from "./page";

afterEach(() => vi.restoreAllMocks());

describe("/support: suporte (RF24, CA33)", () => {
  it("renderiza sem chamar a API nem fetch (pagina estatica)", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch");
    render(await Promise.resolve(<Page />));
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("tem h1 'Suporte' e metadata de titulo", async () => {
    render(await Promise.resolve(<Page />));
    expect(screen.getByRole("heading", { level: 1, name: /suporte/i })).toBeInTheDocument();
    expect(String(metadata.title)).toMatch(/suporte/i);
  });

  it("oferece um contato acessivel (link mailto:) e orienta pedir acesso, senha e exclusao de conta ao administrador", async () => {
    render(await Promise.resolve(<Page />));
    const mail = screen.getAllByRole("link").find((a) => a.getAttribute("href")?.startsWith("mailto:"));
    expect(mail).toBeDefined();
    const text = document.body.textContent ?? "";
    expect(text).toMatch(/administrador/i);
    expect(text).toMatch(/senha/i);
    expect(text).toMatch(/exclus[ãa]o|excluir/i);
  });
});
