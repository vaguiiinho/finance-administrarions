import { render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import Page, { metadata } from "./page";

afterEach(() => vi.restoreAllMocks());

// ADR 0011 9 / T-W1: pagina publica estatica exigida pela App Store (RSC, sem API, sem Server Action).
describe("/privacy: politica de privacidade (RF24, CA33)", () => {
  it("renderiza sem chamar a API nem fetch (pagina estatica)", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch");
    render(await Promise.resolve(<Page />));
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("tem titulo, h1 'Política de privacidade' e metadata de titulo", async () => {
    render(await Promise.resolve(<Page />));
    expect(screen.getByRole("heading", { level: 1, name: /política de privacidade/i })).toBeInTheDocument();
    expect(String(metadata.title)).toMatch(/privacidade/i);
  });

  it("informa os dados coletados (nome e e-mail), a finalidade funcional e que nao ha rastreamento", async () => {
    render(await Promise.resolve(<Page />));
    const text = document.body.textContent ?? "";
    expect(text).toMatch(/nome/i);
    expect(text).toMatch(/e-mail/i);
    expect(text).toMatch(/rastreamento|rastreia/i);
    expect(text).toMatch(/publicidade|an[úu]ncios/i);
  });

  it("explica como excluir a conta (via administrador) e a conta de demonstracao compartilhada com limpeza as 03:00", async () => {
    render(await Promise.resolve(<Page />));
    const text = document.body.textContent ?? "";
    expect(text).toMatch(/exclu[ií]/i);
    expect(text).toMatch(/administrador/i);
    expect(text).toMatch(/demonstra[çc][ãa]o/i);
    expect(text).toMatch(/03:00/);
  });

  it("nao exige login: nenhum formulario de entrada na pagina", async () => {
    render(await Promise.resolve(<Page />));
    expect(screen.queryByLabelText(/senha/i)).not.toBeInTheDocument();
  });
});
