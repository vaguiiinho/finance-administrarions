import { act, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AllProviders, router } from "@/test/helpers/providers";
import type { FormState } from "@/lib/auth/form-state";

const actions = vi.hoisted(() => ({ changePasswordAction: vi.fn() }));
vi.mock("@/app/(protected)/account/password/actions", () => actions);
vi.mock("next/navigation", () => ({ useRouter: () => router, usePathname: () => "/account/password" }));
vi.mock("next/link", () => ({ default: ({ children, href, scroll, prefetch, ...rest }: { children: ReactNode; href: string; scroll?: boolean; prefetch?: boolean } & Record<string, unknown>) => (void scroll, void prefetch, (<a href={href} {...rest}>{children}</a>)) }));

import { ChangePasswordForm } from "./change-password-form";

const current = () => screen.getByLabelText("Senha atual", { selector: "input" }) as HTMLInputElement;
const next = () => screen.getByLabelText("Nova senha", { selector: "input" }) as HTMLInputElement;
const confirm = () => screen.getByLabelText("Confirmar nova senha", { selector: "input" }) as HTMLInputElement;
const save = () => screen.getByRole("button", { name: /^Salvar nova senha|^Salvando/ });
const setup = (props: Parameters<typeof ChangePasswordForm>[0]) => render(<AllProviders><ChangePasswordForm {...props} /></AllProviders>);
const fill = async (c = "Temp1234", n = "MinhaSenha9", k = n) => {
  await userEvent.type(current(), c);
  await userEvent.type(next(), n);
  await userEvent.type(confirm(), k);
};
const err = (over: Partial<FormState>): FormState => ({ status: "error", ...over });

/** Promises pendentes dos testes de "carregando": resolvidas no afterEach para o cleanup nao travar quando o teste falha antes. */
const release: Array<() => void> = [];
afterEach(() => release.splice(0).forEach((f) => f()));

beforeEach(() => {
  actions.changePasswordAction.mockReset().mockResolvedValue({ status: "idle" } satisfies FormState);
  router.replace.mockReset();
  router.push.mockReset();
});
afterEach(() => vi.useRealTimers());

describe("ChangePasswordForm: modo obrigatorio (RF07, RF42, CA08)", () => {
  it("explica 'Defina uma nova senha para continuar.' + destino, sem Cancelar", () => {
    setup({ mode: "required", next: "/cards", nextLabel: "Cartões" });
    expect(screen.getByText("Defina uma nova senha para continuar.")).toBeInTheDocument();
    expect(screen.getByText("Você entrou com uma senha temporária. Depois de salvar, você segue para Cartões.")).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Cancelar" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Cancelar" })).not.toBeInTheDocument();
  });

  it("sem destino conhecido, some a segunda frase", () => {
    setup({ mode: "required" });
    expect(screen.getByText("Defina uma nova senha para continuar.")).toBeInTheDocument();
    expect(screen.queryByText(/Depois de salvar, você segue para/)).not.toBeInTheDocument();
  });

  it("hidden mode=required e next preservado", () => {
    const { container } = setup({ mode: "required", next: "/cards" });
    expect((container.querySelector("input[name='mode']") as HTMLInputElement).value).toBe("required");
    expect((container.querySelector("input[name='next']") as HTMLInputElement).value).toBe("/cards");
  });
});

describe("ChangePasswordForm: modo opcional", () => {
  it("sem explicacao obrigatoria; subtitulo sobre as outras sessoes; Cancelar leva a /account", () => {
    setup({ mode: "optional" });
    expect(screen.queryByText("Defina uma nova senha para continuar.")).not.toBeInTheDocument();
    expect(screen.getByText("Depois de salvar, as outras sessões abertas são encerradas.")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Cancelar" })).toHaveAttribute("href", "/account");
  });
});

describe("ChangePasswordForm: campos e validacao (design 4.3, CA10)", () => {
  it("autocomplete, regra visivel 'De 8 a 72 caracteres.' e botao 'Salvar nova senha'", () => {
    setup({ mode: "optional" });
    expect(current()).toHaveAttribute("autocomplete", "current-password");
    expect(next()).toHaveAttribute("autocomplete", "new-password");
    expect(confirm()).toHaveAttribute("autocomplete", "new-password");
    expect(screen.getByText("De 8 a 72 caracteres.")).toBeInTheDocument();
    expect(save()).toBeInTheDocument();
  });

  it("envio vazio: tres mensagens, foco na primeira invalida, action nao chamada", async () => {
    setup({ mode: "optional" });
    await userEvent.click(save());
    expect(screen.getByText("Informe a senha atual.")).toBeInTheDocument();
    expect(screen.getByText("Informe a nova senha.")).toBeInTheDocument();
    expect(screen.getByText("Confirme a nova senha.")).toBeInTheDocument();
    expect(current()).toHaveFocus();
    expect(actions.changePasswordAction).not.toHaveBeenCalled();
  });

  it("CA10: confirmacao diferente -> 'As senhas nao conferem.' no web, sem chamar a action", async () => {
    setup({ mode: "optional" });
    await fill("Temp1234", "MinhaSenha9", "OutraSenha9");
    await userEvent.click(save());
    expect(screen.getByText("As senhas não conferem.")).toBeInTheDocument();
    expect(confirm()).toHaveAttribute("aria-invalid", "true");
    expect(actions.changePasswordAction).not.toHaveBeenCalled();
  });

  it("dados validos: a action recebe as tres senhas, mode e next", async () => {
    setup({ mode: "required", next: "/cards" });
    await fill();
    await userEvent.click(save());
    await waitFor(() => expect(actions.changePasswordAction).toHaveBeenCalledTimes(1));
    const data = actions.changePasswordAction.mock.calls[0][1] as FormData;
    expect(Object.fromEntries(data.entries())).toMatchObject({ currentPassword: "Temp1234", newPassword: "MinhaSenha9", confirmPassword: "MinhaSenha9", mode: "required", next: "/cards" });
  });
});

describe("ChangePasswordForm: respostas do servidor", () => {
  it("INCORRECT: mensagem no campo, senha atual limpa e com foco; nova e confirmacao preservadas", async () => {
    actions.changePasswordAction.mockResolvedValue(err({ fields: { currentPassword: "Senha atual incorreta." } }));
    setup({ mode: "optional" });
    await fill("errada123", "MinhaSenha9");
    await userEvent.click(save());
    expect(await screen.findByText("Senha atual incorreta.")).toBeInTheDocument();
    expect(current().value).toBe("");
    await waitFor(() => expect(current()).toHaveFocus());
    expect(next().value).toBe("MinhaSenha9");
    expect(confirm().value).toBe("MinhaSenha9");
  });

  it("SAME_AS_CURRENT na nova senha, com foco nela", async () => {
    actions.changePasswordAction.mockResolvedValue(err({ fields: { newPassword: "A nova senha deve ser diferente da atual." } }));
    setup({ mode: "optional" });
    await fill("Igual1234", "Igual1234");
    await userEvent.click(save());
    expect(await screen.findByText("A nova senha deve ser diferente da atual.")).toBeInTheDocument();
    await waitFor(() => expect(next()).toHaveFocus());
  });

  it("429: aviso com horario, botao aria-disabled, nada limpo", async () => {
    actions.changePasswordAction.mockResolvedValue(err({ code: "TOO_MANY_ATTEMPTS", retryAfterSeconds: 120 }));
    setup({ mode: "optional" });
    await fill("errada123", "MinhaSenha9");
    await userEvent.click(save());
    const banner = await screen.findByRole("alert");
    expect(banner.textContent).toMatch(/Muitas tentativas\. Tente novamente em 2 minutos, às \d{2}:\d{2}\./);
    expect(save()).toHaveAttribute("aria-disabled", "true");
    expect(current().value).toBe("errada123");
  });

  it("sucesso no modo opcional: campos limpos e toast 'Senha alterada.'", async () => {
    actions.changePasswordAction.mockResolvedValue({ status: "success", message: "Senha alterada." } satisfies FormState);
    setup({ mode: "optional" });
    await fill();
    await userEvent.click(save());
    expect(await screen.findByText("Senha alterada.")).toBeInTheDocument();
    await waitFor(() => {
      expect(current().value).toBe("");
      expect(next().value).toBe("");
      expect(confirm().value).toBe("");
    });
  });

  it("sessao expirada: alerta inline exato, botao sai do carregando e vai ao login apos 1,5 s", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    actions.changePasswordAction.mockResolvedValue(err({ code: "SESSION_EXPIRED", message: "Sua sessão expirou. Entre novamente.", redirectUrl: "/login?next=%2Faccount%2Fpassword&reason=expired" }));
    setup({ mode: "optional" });
    await fill();
    await userEvent.click(save());
    expect(await screen.findByRole("alert")).toHaveTextContent("Sua sessão expirou. Entre novamente.");
    expect(save()).not.toHaveAttribute("aria-busy", "true");
    expect(router.replace).not.toHaveBeenCalled();
    await act(async () => vi.advanceTimersByTime(1600));
    expect(router.replace).toHaveBeenCalledWith("/login?next=%2Faccount%2Fpassword&reason=expired");
  });

  it("sessao expirada: o link 'Entrar novamente' navega na hora", async () => {
    actions.changePasswordAction.mockResolvedValue(err({ code: "SESSION_EXPIRED", message: "Sua sessão expirou. Entre novamente.", redirectUrl: "/login?reason=expired" }));
    setup({ mode: "optional" });
    await fill();
    await userEvent.click(save());
    await userEvent.click(await screen.findByRole("link", { name: "Entrar novamente" }));
    expect(router.replace.mock.calls.length + router.push.mock.calls.length).toBeGreaterThan(0);
  });

  it("rede: banner de erro e valores preservados", async () => {
    actions.changePasswordAction.mockResolvedValue(err({ code: "NETWORK_ERROR" }));
    setup({ mode: "optional" });
    await fill();
    await userEvent.click(save());
    expect(await screen.findByRole("alert")).toHaveTextContent(/Não foi possível salvar agora\. Verifique sua conexão e tente novamente\./);
    expect(next().value).toBe("MinhaSenha9");
  });

  it("carregando: 'Salvando…', aria-busy, readOnly, uma unica chamada", async () => {
    actions.changePasswordAction.mockImplementation(() => new Promise<FormState>((r) => release.push(() => r({ status: "idle" }))));
    setup({ mode: "optional" });
    await fill();
    await userEvent.click(save());
    const busy = await screen.findByRole("button", { name: "Salvando…" });
    expect(busy).toHaveAttribute("aria-busy", "true");
    expect(current()).toHaveAttribute("readonly");
    await userEvent.click(busy);
    expect(actions.changePasswordAction).toHaveBeenCalledTimes(1);
  });
});
