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

  it("conta de demonstracao (ADR 0013, design 4.1): dados ficticios de exemplo, redefinida todos os dias as 03:00 (horario de Brasilia), sem dizer que sao 'apagados'", async () => {
    render(await Promise.resolve(<Page />));
    const text = document.body.textContent ?? "";
    expect(text).toMatch(/dados fict[íi]cios de exemplo/i);
    expect(text).toMatch(/redefinida todos os dias às 03:00 \(horário de Brasília\)/);
    expect(text).toMatch(/os dados de exemplo voltam ao estado original/i);
    expect(text).not.toMatch(/apagados todos os dias/i);
    expect(text).not.toMatch(/horário de São Paulo/i);
  });

  it("a credencial da conta demo nao aparece na politica de privacidade (so no login e nas notas de revisao)", async () => {
    render(await Promise.resolve(<Page />));
    const text = document.body.textContent ?? "";
    expect(text).not.toMatch(/senha demo|usuário demo|demo@showcase/i);
  });

  it("nao exige login: nenhum formulario de entrada na pagina", async () => {
    render(await Promise.resolve(<Page />));
    expect(screen.queryByLabelText(/senha/i)).not.toBeInTheDocument();
  });
});
