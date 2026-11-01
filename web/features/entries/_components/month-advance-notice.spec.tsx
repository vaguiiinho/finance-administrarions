import { act, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AllProviders, router } from "@/test/helpers/providers";

vi.mock("next/navigation", () => ({ useRouter: () => router, usePathname: () => "/entries" }));

import { MonthAdvanceNotice } from "./month-advance-notice";

/**
 * Aviso de avanco de mes (RF05, RNF06; design secao 4 e 10.2; ADR 7.3).
 * CONTRATO PROPOSTO PELO TESTER: <MonthAdvanceNotice signal={{ advance, from } | null} month="YYYY-MM" />;
 * `signal` ja validado no servidor (parseAdvanceSignal) e `month` e o mes da tela. Montado sempre na mesma posicao.
 */
type Signal = { advance: "NEXT_PENDING" | "NO_PENDING_AHEAD"; from: string } | null;
const wrap = (signal: Signal, month: string) => (
  <AllProviders>
    <main id="conteudo" tabIndex={-1}>
      <MonthAdvanceNotice signal={signal} month={month} />
      <button type="button">depois</button>
    </main>
  </AllProviders>
);
const NEXT = (from: string): Signal => ({ advance: "NEXT_PENDING", from });
const NONE_AHEAD = (from: string): Signal => ({ advance: "NO_PENDING_AHEAD", from });

beforeEach(() => {
  window.history.replaceState(null, "", "/entries");
});
afterEach(() => {
  vi.useRealTimers();
});

describe("MonthAdvanceNotice - textos aprovados (design 4.1)", () => {
  it.each([
    ["CA07 proximo mes", NEXT("2026-10"), "2026-11", "Sem pendências em outubro de 2026. Mostrando novembro de 2026, o próximo mês com pendências."],
    ["CA06 salto de varios meses", NEXT("2026-10"), "2026-12", "Sem pendências em outubro de 2026. Mostrando dezembro de 2026, o próximo mês com pendências."],
    ["CA15 virada de ano", NEXT("2026-12"), "2027-01", "Sem pendências em dezembro de 2026. Mostrando janeiro de 2027, o próximo mês com pendências."],
    ["CA16 salto com virada", NEXT("2026-11"), "2027-02", "Sem pendências em novembro de 2026. Mostrando fevereiro de 2027, o próximo mês com pendências."],
    ["R3 salto muito longo", NEXT("2026-10"), "2036-03", "Sem pendências em outubro de 2026. Mostrando março de 2036, o próximo mês com pendências."],
    ["CA02 nenhuma a frente", NONE_AHEAD("2026-10"), "2026-11", "Sem pendências de outubro de 2026 em diante. Mostrando novembro de 2026."],
    ["CA17 nenhuma a frente com virada", NONE_AHEAD("2026-12"), "2027-01", "Sem pendências de dezembro de 2026 em diante. Mostrando janeiro de 2027."],
    ["CA14 so ha pendencia anterior", NONE_AHEAD("2026-10"), "2026-11", "Sem pendências de outubro de 2026 em diante. Mostrando novembro de 2026."],
  ])("%s", (_name, signal, month, text) => {
    render(wrap(signal, month));
    expect(screen.getByRole("note")).toHaveTextContent(text);
  });

  it("nunca afirma 'voce nao tem pendencias' (DL4: pode haver pendencia em mes anterior)", () => {
    render(wrap(NONE_AHEAD("2026-10"), "2026-11"));
    expect(screen.getByRole("note").textContent).not.toMatch(/você não tem|voce nao tem/i);
  });
});

describe("MonthAdvanceNotice - presenca", () => {
  it("sem sinal (CA01, CA26, CA27, falha da verificacao): nada e renderizado e nenhum espaco e reservado", () => {
    render(wrap(null, "2026-10"));
    expect(screen.queryByRole("note")).not.toBeInTheDocument();
    expect(document.querySelector("main [aria-live]")).toBeNull();
  });

  it("o aviso nao tem acao propria alem de fechar (DL3: 'Mes atual' fica no seletor)", () => {
    render(wrap(NEXT("2026-10"), "2026-12"));
    const note = screen.getByRole("note");
    expect(note.querySelectorAll("button")).toHaveLength(1);
    expect(note.querySelector("a")).toBeNull();
    expect(screen.getByRole("button", { name: "Fechar aviso de mês" })).toBeInTheDocument();
  });

  it("o foco NAO e movido na carga", () => {
    render(wrap(NEXT("2026-10"), "2026-12"));
    expect(document.body).toHaveFocus();
  });
});

describe("MonthAdvanceNotice - sinal na URL (ADR 7.3)", () => {
  it("na montagem remove adv e adv_from da URL e preserva o restante", () => {
    window.history.replaceState(null, "", "/entries?month=2026-12&adv=NEXT_PENDING&adv_from=2026-10&tab=invoices");
    render(wrap(NEXT("2026-10"), "2026-12"));
    const q = new URLSearchParams(window.location.search);
    expect(q.has("adv")).toBe(false);
    expect(q.has("adv_from")).toBe(false);
    expect(q.get("month")).toBe("2026-12");
    expect(q.get("tab")).toBe("invoices");
  });

  it("nao empilha entrada no historico (replaceState, nao pushState)", () => {
    window.history.replaceState(null, "", "/entries?month=2026-12&adv=NEXT_PENDING&adv_from=2026-10");
    const push = vi.spyOn(window.history, "pushState");
    const before = window.history.length;
    render(wrap(NEXT("2026-10"), "2026-12"));
    expect(push).not.toHaveBeenCalled();
    expect(window.history.length).toBe(before);
    push.mockRestore();
  });

  it("depois de limpar a URL o aviso continua visivel (o sinal fica em estado local)", () => {
    window.history.replaceState(null, "", "/entries?month=2026-12&adv=NEXT_PENDING&adv_from=2026-10");
    render(wrap(NEXT("2026-10"), "2026-12"));
    expect(screen.getByRole("note")).toBeInTheDocument();
  });
});

describe("MonthAdvanceNotice - ciclo de vida (design 4.3)", () => {
  it("troca de aba/filtro/pagina (mesmo mes, sem sinal novo) NAO remove o aviso", () => {
    const { rerender } = render(wrap(NEXT("2026-10"), "2026-12"));
    rerender(wrap(null, "2026-12"));
    expect(screen.getByRole("note")).toHaveTextContent("Mostrando dezembro de 2026");
  });

  it("CA25: trocar de mes remove o aviso e ele nao volta nem ao retornar ao mesmo mes", () => {
    const { rerender } = render(wrap(NEXT("2026-10"), "2026-12"));
    expect(screen.getByRole("note")).toBeInTheDocument(); // precondicao: sem ela o teste passaria com um componente que nao renderiza nada
    rerender(wrap(null, "2026-10"));
    expect(screen.queryByRole("note")).not.toBeInTheDocument();
    rerender(wrap(null, "2026-12"));
    expect(screen.queryByRole("note")).not.toBeInTheDocument();
  });

  it("fechar remove o aviso e leva o foco para <main id='conteudo'>", async () => {
    render(wrap(NEXT("2026-10"), "2026-12"));
    await userEvent.click(screen.getByRole("button", { name: "Fechar aviso de mês" }));
    expect(screen.queryByRole("note")).not.toBeInTheDocument();
    expect(document.getElementById("conteudo")).toHaveFocus();
  });

  it("Esc NAO fecha o aviso (so o botao, design 4.3)", async () => {
    render(wrap(NEXT("2026-10"), "2026-12"));
    await userEvent.keyboard("{Escape}");
    expect(screen.getByRole("note")).toBeInTheDocument();
  });

  it("depois de fechado nao reaparece em re-render com o mesmo mes", async () => {
    const { rerender } = render(wrap(NEXT("2026-10"), "2026-12"));
    await userEvent.click(screen.getByRole("button", { name: "Fechar aviso de mês" }));
    rerender(wrap(null, "2026-12"));
    expect(screen.queryByRole("note")).not.toBeInTheDocument();
  });

  it("B-1: limpar a URL nao carrega o estado do history (o patch do Next ignora `__NA` e o canonicalUrl manteria adv)", () => {
    window.history.replaceState({ __NA: true }, "", "/entries?month=2026-12&adv=NEXT_PENDING&adv_from=2026-10");
    const replace = vi.spyOn(window.history, "replaceState");
    render(wrap(NEXT("2026-10"), "2026-12"));
    expect(replace).toHaveBeenCalledTimes(1);
    expect(replace.mock.calls[0][0]).toBeNull();
    replace.mockRestore();
  });
});

describe("MonthAdvanceNotice - acessibilidade (RNF06, design 10.2)", () => {
  // so dentro do <main>: o ToastProvider tem a sua propria regiao viva, fora do escopo do aviso
  const liveRegions = () => [...document.querySelectorAll('main [aria-live="polite"]')];

  it("o banner visivel e estatico (role=note), sem regiao viva propria: servidor renderizado nao seria anunciado", () => {
    render(wrap(NEXT("2026-10"), "2026-12"));
    const note = screen.getByRole("note");
    expect(note.hasAttribute("aria-live")).toBe(false);
    expect(note.closest("[aria-live]")).toBeNull();
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("uma regiao polite OCULTA nasce vazia e recebe o texto ~500 ms depois da montagem", () => {
    vi.useFakeTimers();
    render(wrap(NEXT("2026-10"), "2026-12"));
    const regions = liveRegions();
    expect(regions).toHaveLength(1);
    expect(regions[0].textContent).toBe("");
    expect(regions[0].className).toMatch(/sr-only/);
    act(() => void vi.advanceTimersByTime(600));
    expect(regions[0].textContent).toBe("Sem pendências em outubro de 2026. Mostrando dezembro de 2026, o próximo mês com pendências.");
  });

  it("a regiao e esvaziada apos 10 s, para o texto nao ser lido duas vezes na navegacao por leitura", () => {
    vi.useFakeTimers();
    render(wrap(NONE_AHEAD("2026-10"), "2026-11"));
    act(() => void vi.advanceTimersByTime(600));
    expect(liveRegions()[0].textContent).toContain("Mostrando novembro de 2026");
    act(() => void vi.advanceTimersByTime(10_000));
    expect(liveRegions()[0].textContent).toBe("");
  });

  it("fechar esvazia a regiao viva", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    render(wrap(NEXT("2026-10"), "2026-12"));
    act(() => void vi.advanceTimersByTime(600));
    await userEvent.click(screen.getByRole("button", { name: "Fechar aviso de mês" }));
    expect(liveRegions().every((r) => r.textContent === "")).toBe(true);
  });
});
