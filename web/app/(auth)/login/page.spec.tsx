import { render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("../actions", () => ({ loginAction: vi.fn().mockResolvedValue({ status: "idle" }) }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn(), replace: vi.fn(), refresh: vi.fn() }), usePathname: () => "/login" }));

import LoginPage from "./page";

/**
 * Tela /login depois da remocao da demonstracao publica (spec: RF03, RF09, RF10, CA10, CA11, CA16; design 2).
 * Renderiza o server component com `searchParams`; a flag DEMO_ACCOUNT_HINT e lida por requisicao.
 */
const NOTE_NAME = "Conta de demonstração";
const render_ = async (params: Record<string, string> = {}) => render(await LoginPage({ searchParams: Promise.resolve(params) } as never));
const note = () => screen.queryByRole("note", { name: NOTE_NAME });

beforeEach(() => {
  vi.stubEnv("DEMO_ACCOUNT_HINT", "on");
});
afterEach(() => {
  vi.unstubAllEnvs();
});

describe("/login com a conta demo habilitada (DEMO_ACCOUNT_HINT=on) (CA10)", () => {
  it("mostra o rotulo 'E-mail ou usuário', 'Senha', 'Entrar' e o texto de orientacao", async () => {
    await render_();
    expect(screen.getByLabelText("E-mail ou usuário")).toBeInTheDocument();
    expect(screen.getByLabelText("Senha", { selector: "input" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Entrar" })).toBeInTheDocument();
    expect(screen.getByText("Não tem acesso ou esqueceu a senha? Fale com um administrador.")).toBeInTheDocument();
  });

  it("mostra a dica: 'Para testar, use o usuário demo e a senha demo.' (textContent, com a credencial em destaque)", async () => {
    await render_();
    expect(note()).toBeInTheDocument();
    expect(note()!.textContent).toContain("Para testar, use o usuário demo e a senha demo.");
  });

  it("a credencial fica em <strong><code translate='no'> (peso e fonte, nao so cor; sem traducao automatica) (RNF07)", async () => {
    await render_();
    const codes = within(note()!).getAllByText("demo", { selector: "code" });
    expect(codes).toHaveLength(2);
    for (const code of codes) {
      expect(code).toHaveAttribute("translate", "no");
      expect(code.closest("strong")).not.toBeNull();
    }
  });

  it("segunda linha: conta compartilhada, nao registre dados pessoais, redefinida todos os dias as 03:00 (horario de Brasilia)", async () => {
    await render_();
    const text = note()!.textContent ?? "";
    expect(text).toContain("Conta compartilhada: não registre dados pessoais.");
    expect(text).toContain("redefinida todos os dias às 03:00 (horário de Brasília)");
  });

  it("nao ha link 'Ver demonstração' nem nenhum link para /demo (RF03, CA10)", async () => {
    const { container } = await render_();
    expect(screen.queryByText(/Ver demonstração/i)).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: /demonstra/i })).not.toBeInTheDocument();
    for (const a of container.querySelectorAll("a[href]")) expect(a.getAttribute("href")).not.toMatch(/\/demo(\/|$|\?)/);
  });

  it("CA16: a dica e texto comum: vem DEPOIS do formulario no DOM, antes do rodape, fora do <form>, sem foco e sem nada focavel dentro", async () => {
    const { container } = await render_();
    const form = container.querySelector("form")!;
    const footerText = screen.getByText("Não tem acesso ou esqueceu a senha? Fale com um administrador.");
    expect(form.contains(note())).toBe(false);
    expect(form.compareDocumentPosition(note()!) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(note()!.compareDocumentPosition(footerText) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(note()).not.toHaveAttribute("tabindex");
    expect(note()!.querySelectorAll("a, button, input, select, textarea, [tabindex]")).toHaveLength(0);
    expect(document.activeElement === document.body || !note()!.contains(document.activeElement)).toBe(true);
  });

  it("CA16: a dica nao e regiao viva (nao e anunciada ao carregar)", async () => {
    await render_();
    expect(note()).not.toHaveAttribute("aria-live");
    expect(note()).not.toHaveAttribute("role", "alert");
    expect(note()).not.toHaveAttribute("role", "status");
  });

  it("o campo de identificador nao bloqueia valor sem @: type text, autocomplete username, sem inputmode (DR1)", async () => {
    await render_();
    const field = screen.getByLabelText("E-mail ou usuário");
    expect(field).toHaveAttribute("type", "text");
    expect(field).toHaveAttribute("autocomplete", "username");
    expect(field).not.toHaveAttribute("inputmode");
    expect(field).toHaveAttribute("name", "email");
  });

  it("RF10: a dica aparece tambem com o banner de sessao expirada", async () => {
    await render_({ reason: "expired", next: "/cards" });
    expect(screen.getByRole("status")).toHaveTextContent("Sua sessão expirou. Entre novamente.");
    expect(note()).toBeInTheDocument();
  });

  it("RF10/CA08: a dica aparece com o contexto de `next` ('Entre para continuar em ...')", async () => {
    await render_({ next: "/dashboard?month=2026-11" });
    expect(screen.getByText(/Entre para continuar em/)).toBeInTheDocument();
    expect(note()).toBeInTheDocument();
  });

  it("e so informativa: nao ha botao 'Preencher' nem 'Entrar como demo' (fora de escopo)", async () => {
    await render_();
    expect(screen.queryByRole("button", { name: /preencher|usar conta demo|entrar como/i })).not.toBeInTheDocument();
  });
});

describe("/login com a conta demo desabilitada (CA11, B4, DR2)", () => {
  it.each([[undefined], [""], ["off"], ["true"]])("DEMO_ACCOUNT_HINT=%j: sem dica, rotulo 'E-mail', nada reservado no DOM", async (value) => {
    vi.stubEnv("DEMO_ACCOUNT_HINT", value as never);
    await render_();
    expect(note()).not.toBeInTheDocument();
    expect(screen.queryByText(/Para testar/)).not.toBeInTheDocument();
    expect(document.body.textContent).not.toMatch(/senha demo/i);
    expect(screen.getByLabelText("E-mail")).toBeInTheDocument();
    expect(screen.queryByLabelText("E-mail ou usuário")).not.toBeInTheDocument();
  });

  it("sem a dica continuam: orientacao do rodape e nenhum link para /demo", async () => {
    vi.stubEnv("DEMO_ACCOUNT_HINT", "off");
    const { container } = await render_();
    expect(screen.getByText("Não tem acesso ou esqueceu a senha? Fale com um administrador.")).toBeInTheDocument();
    expect(screen.queryByText(/Ver demonstração/i)).not.toBeInTheDocument();
    for (const a of container.querySelectorAll("a[href]")) expect(a.getAttribute("href")).not.toMatch(/\/demo(\/|$|\?)/);
  });

  it("o campo continua type text/username mesmo sem a dica (o comportamento do campo nao muda com a env, so o rotulo)", async () => {
    vi.stubEnv("DEMO_ACCOUNT_HINT", "off");
    await render_();
    const field = screen.getByLabelText("E-mail");
    expect(field).toHaveAttribute("type", "text");
    expect(field).toHaveAttribute("autocomplete", "username");
    expect(field).toHaveAttribute("name", "email");
  });

  it("a flag e lida por requisicao: a mesma pagina renderizada com a env trocada muda de acordo", async () => {
    vi.stubEnv("DEMO_ACCOUNT_HINT", "on");
    const first = await render_();
    expect(note()).toBeInTheDocument();
    first.unmount();
    vi.stubEnv("DEMO_ACCOUNT_HINT", "off");
    await render_();
    expect(note()).not.toBeInTheDocument();
  });
});
