import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { FormState } from "@/lib/auth/form-state";

const login = vi.hoisted(() => ({ loginAction: vi.fn() }));
vi.mock("../actions", () => login);
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn(), replace: vi.fn(), refresh: vi.fn() }), usePathname: () => "/login" }));

import { LoginForm } from "./login-form";

const email = () => screen.getByLabelText("E-mail") as HTMLInputElement;
const password = () => screen.getByLabelText("Senha", { selector: "input" }) as HTMLInputElement;
const submit = () => screen.getByRole("button", { name: /^Entrar|Entrando/ });
const errorState = (over: Partial<FormState>): FormState => ({ status: "error", ...over });

/** Promises pendentes dos testes de "carregando": resolvidas no afterEach para o cleanup nao travar quando o teste falha antes. */
const release: Array<() => void> = [];
afterEach(() => release.splice(0).forEach((f) => f()));

beforeEach(() => {
  login.loginAction.mockReset().mockResolvedValue({ status: "idle" } satisfies FormState);
});

describe("LoginForm: campos (RF41, design 3.3)", () => {
  it("atributos de e-mail e senha, noValidate e botao 'Entrar'", () => {
    const { container } = render(<LoginForm next="/cards" />);
    // ADR 0013 / design DR1: o campo aceita o usuario `demo`, que nao e e-mail: type text, autocomplete username, sem inputmode.
    expect(email()).toHaveAttribute("type", "text");
    expect(email()).toHaveAttribute("name", "email");
    expect(email()).toHaveAttribute("autocomplete", "username");
    expect(email()).not.toHaveAttribute("inputmode");
    expect(email()).toHaveAttribute("autocapitalize", "none");
    expect(email()).toHaveAttribute("spellcheck", "false");
    expect(email()).toBeRequired();
    expect(password()).toHaveAttribute("autocomplete", "current-password");
    expect(password()).toBeRequired();
    expect(container.querySelector("form")).toHaveAttribute("novalidate");
    expect(submit()).toHaveAttribute("type", "submit");
  });

  it("next vai em campo hidden com o valor BRUTO (o servidor valida)", () => {
    const { container } = render(<LoginForm next="//evil.com" />);
    expect((container.querySelector("input[name='next']") as HTMLInputElement).value).toBe("//evil.com");
    expect(container.querySelector("input[name='next']")).toHaveAttribute("type", "hidden");
  });

  it("sem foco automatico no e-mail", () => {
    render(<LoginForm />);
    expect(email()).not.toHaveFocus();
  });

  it("nao oferece 'Criar conta' (RF06)", () => {
    render(<LoginForm />);
    expect(screen.queryByText(/Criar conta/i)).not.toBeInTheDocument();
  });
});

describe("LoginForm: rotulo condicional ao interruptor da dica (design DR2, PA1; CA10, CA11)", () => {
  it("demoHint ligado: rotulo 'E-mail ou usuário' e mensagem 'Informe o e-mail ou usuário.'", async () => {
    render(<LoginForm demoHint />);
    expect(screen.getByLabelText("E-mail ou usuário")).toBeInTheDocument();
    expect(screen.queryByLabelText("E-mail", { exact: true })).not.toBeInTheDocument();
    await userEvent.click(submit());
    expect(screen.getByText("Informe o e-mail ou usuário.")).toBeInTheDocument();
    expect(screen.queryByText("Informe o e-mail.")).not.toBeInTheDocument();
  });

  it("demoHint desligado (ou ausente): rotulo 'E-mail' e mensagem 'Informe o e-mail.'", async () => {
    render(<LoginForm demoHint={false} />);
    expect(screen.getByLabelText("E-mail")).toBeInTheDocument();
    expect(screen.queryByLabelText("E-mail ou usuário")).not.toBeInTheDocument();
    await userEvent.click(submit());
    expect(screen.getByText("Informe o e-mail.")).toBeInTheDocument();
  });

  it.each([true, false])("demoHint=%s: type text, autocomplete username, sem inputmode e sem placeholder (DR1, DR3)", (demoHint) => {
    render(<LoginForm demoHint={demoHint} />);
    const field = screen.getByLabelText(demoHint ? "E-mail ou usuário" : "E-mail");
    expect(field).toHaveAttribute("type", "text");
    expect(field).toHaveAttribute("autocomplete", "username");
    expect(field).toHaveAttribute("autocapitalize", "none");
    expect(field).toHaveAttribute("spellcheck", "false");
    expect(field).not.toHaveAttribute("inputmode");
    expect(field).not.toHaveAttribute("placeholder");
    expect(field).toHaveAttribute("name", "email");
  });

  it("CA12: 'demo' e 'demo' vao para a action sem bloqueio de formato (o servidor resolve o alias); Demo e ' demo ' tambem", async () => {
    render(<LoginForm demoHint />);
    for (const typed of ["demo", "Demo", " demo "]) {
      login.loginAction.mockClear();
      const field = screen.getByLabelText("E-mail ou usuário") as HTMLInputElement;
      await userEvent.clear(field);
      await userEvent.type(field, typed);
      await userEvent.clear(password());
      await userEvent.type(password(), "demo");
      await userEvent.click(submit());
      await waitFor(() => expect(login.loginAction).toHaveBeenCalledTimes(1));
      const data = login.loginAction.mock.calls[0][1] as FormData;
      expect(data.get("email")).toBe(typed);
      expect(data.get("password")).toBe("demo");
    }
  });

  it("CA14: o banner de credencial invalida continua 'E-mail ou senha inválidos.' mesmo com o rotulo 'E-mail ou usuário'", async () => {
    login.loginAction.mockResolvedValue(errorState({ code: "INVALID_CREDENTIALS", message: "E-mail ou senha inválidos." }));
    render(<LoginForm demoHint />);
    await userEvent.type(screen.getByLabelText("E-mail ou usuário"), "admin");
    await userEvent.type(password(), "x");
    await userEvent.click(submit());
    expect(await screen.findByRole("alert")).toHaveTextContent("E-mail ou senha inválidos.");
  });
});

describe("LoginForm: validacao so de presenca (D13, design 3.4)", () => {
  it("sem erro enquanto digita/sai do campo; no envio vazio mostra os dois erros, foco no e-mail, action NAO chamada", async () => {
    render(<LoginForm />);
    await userEvent.click(email());
    await userEvent.tab();
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    await userEvent.click(submit());
    expect(screen.getByText("Informe o e-mail.")).toBeInTheDocument();
    expect(screen.getByText("Informe a senha.")).toBeInTheDocument();
    expect(email()).toHaveAttribute("aria-invalid", "true");
    expect(email()).toHaveFocus();
    expect(login.loginAction).not.toHaveBeenCalled();
  });

  it("so a senha faltando: foco na senha", async () => {
    render(<LoginForm />);
    await userEvent.type(email(), "ana@exemplo.com");
    await userEvent.click(submit());
    expect(screen.queryByText("Informe o e-mail.")).not.toBeInTheDocument();
    expect(password()).toHaveFocus();
  });

  it("depois de um envio com erro, o erro some assim que o valor fica valido", async () => {
    render(<LoginForm />);
    await userEvent.click(submit());
    await userEvent.type(email(), "a");
    expect(screen.queryByText("Informe o e-mail.")).not.toBeInTheDocument();
    expect(screen.getByText("Informe a senha.")).toBeInTheDocument();
  });

  it("nao valida formato de e-mail no login: 'ana@' vai para a action", async () => {
    render(<LoginForm />);
    await userEvent.type(email(), "ana@");
    await userEvent.type(password(), "x");
    await userEvent.click(submit());
    await waitFor(() => expect(login.loginAction).toHaveBeenCalledTimes(1));
  });

  it("a action recebe e-mail, senha e next no FormData", async () => {
    render(<LoginForm next="/cards" />);
    await userEvent.type(email(), "ana@exemplo.com");
    await userEvent.type(password(), "segredo123");
    await userEvent.click(submit());
    await waitFor(() => expect(login.loginAction).toHaveBeenCalledTimes(1));
    const data = login.loginAction.mock.calls[0][1] as FormData;
    expect(Object.fromEntries(data.entries())).toMatchObject({ email: "ana@exemplo.com", password: "segredo123", next: "/cards" });
  });
});

describe("LoginForm: banners (design 3.5, CA03, CA04)", () => {
  it("CA03: INVALID_CREDENTIALS -> banner exato (role alert), e-mail mantido, senha limpa, foco na senha", async () => {
    login.loginAction.mockResolvedValue(errorState({ code: "INVALID_CREDENTIALS", message: "E-mail ou senha inválidos.", values: { email: "ana@exemplo.com" } }));
    render(<LoginForm />);
    await userEvent.type(email(), "ana@exemplo.com");
    await userEvent.type(password(), "errada");
    await userEvent.click(submit());
    expect(await screen.findByRole("alert")).toHaveTextContent("E-mail ou senha inválidos.");
    expect(email().value).toBe("ana@exemplo.com");
    expect(password().value).toBe("");
    await waitFor(() => expect(password()).toHaveFocus());
  });

  it("CA04: 429 -> aviso com horario, botao aria-disabled ligado ao banner, senha NAO limpa, campos editaveis", async () => {
    login.loginAction.mockResolvedValue(errorState({ code: "TOO_MANY_ATTEMPTS", retryAfterSeconds: 180 }));
    render(<LoginForm />);
    await userEvent.type(email(), "ana@exemplo.com");
    await userEvent.type(password(), "segredo123");
    await userEvent.click(submit());
    const banner = await screen.findByRole("alert");
    expect(banner.textContent).toMatch(/^Muitas tentativas\. Tente novamente em 3 minutos, às \d{2}:\d{2}\.$/);
    expect(submit()).toHaveAttribute("aria-disabled", "true");
    expect(submit().getAttribute("aria-describedby")).toContain(banner.id);
    expect(password().value).toBe("segredo123");
    expect(email()).not.toHaveAttribute("readonly");
  });

  it("429: clicar no botao enquanto bloqueado NAO envia de novo", async () => {
    login.loginAction.mockResolvedValue(errorState({ code: "TOO_MANY_ATTEMPTS", retryAfterSeconds: 180 }));
    render(<LoginForm />);
    await userEvent.type(email(), "a@b.c");
    await userEvent.type(password(), "x");
    await userEvent.click(submit());
    await screen.findByRole("alert");
    await userEvent.click(submit());
    await userEvent.type(password(), "{Enter}");
    expect(login.loginAction).toHaveBeenCalledTimes(1);
  });

  it("rede/5xx -> banner de falha com a orientacao de conexao", async () => {
    login.loginAction.mockResolvedValue(errorState({ code: "NETWORK_ERROR" }));
    render(<LoginForm />);
    await userEvent.type(email(), "a@b.c");
    await userEvent.type(password(), "x");
    await userEvent.click(submit());
    expect(await screen.findByRole("alert")).toHaveTextContent("Não foi possível entrar agora. Verifique sua conexão e tente novamente.");
  });

  it("erro de campo do servidor (400): mensagem inline e foco no primeiro invalido", async () => {
    login.loginAction.mockResolvedValue(errorState({ fields: { email: "Informe o e-mail." } }));
    render(<LoginForm />);
    await userEvent.type(email(), " ");
    await userEvent.type(password(), "x");
    await userEvent.click(submit());
    expect(await screen.findByText("Informe o e-mail.")).toBeInTheDocument();
    await waitFor(() => expect(email()).toHaveFocus());
  });

  it("reason=expired: banner info (role status) 'Sua sessao expirou. Entre novamente.' ja na primeira renderizacao", () => {
    render(<LoginForm next="/cards" reason="expired" />);
    expect(screen.getByRole("status")).toHaveTextContent("Sua sessão expirou. Entre novamente.");
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("no maximo um banner por vez: o erro de credenciais substitui o de sessao expirada", async () => {
    login.loginAction.mockResolvedValue(errorState({ code: "INVALID_CREDENTIALS", message: "E-mail ou senha inválidos." }));
    render(<LoginForm reason="expired" />);
    await userEvent.type(email(), "a@b.c");
    await userEvent.type(password(), "x");
    await userEvent.click(submit());
    await screen.findByRole("alert");
    expect(screen.queryByText("Sua sessão expirou. Entre novamente.")).not.toBeInTheDocument();
  });
});

describe("LoginForm: carregando e envio duplo (design 3.6, RF41)", () => {
  it("pendente: 'Entrando…', aria-busy, campos readOnly; so uma chamada mesmo com cliques e Enter repetidos", async () => {
    login.loginAction.mockImplementation(() => new Promise<FormState>((r) => release.push(() => r({ status: "idle" }))));
    render(<LoginForm />);
    await userEvent.type(email(), "ana@exemplo.com");
    await userEvent.type(password(), "segredo123");
    await userEvent.click(submit());
    const busy = await screen.findByRole("button", { name: "Entrando…" });
    expect(busy).toHaveAttribute("aria-busy", "true");
    expect(email()).toHaveAttribute("readonly");
    expect(password()).toHaveAttribute("readonly");
    await userEvent.click(busy);
    await userEvent.click(busy);
    password().focus();
    await userEvent.keyboard("{Enter}");
    expect(login.loginAction).toHaveBeenCalledTimes(1);
  });
});
