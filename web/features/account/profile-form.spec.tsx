import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AllProviders, router } from "@/test/helpers/providers";
import type { CurrentUserDto } from "@/lib/api/types";
import type { FormState } from "@/lib/auth/form-state";

const actions = vi.hoisted(() => ({ updateProfileAction: vi.fn() }));
vi.mock("@/app/(protected)/account/actions", () => actions);
vi.mock("next/navigation", () => ({ useRouter: () => router, usePathname: () => "/account" }));
vi.mock("next/link", () => ({ default: ({ children, href, scroll, prefetch, ...rest }: { children: ReactNode; href: string; scroll?: boolean; prefetch?: boolean } & Record<string, unknown>) => (void scroll, void prefetch, (<a href={href} {...rest}>{children}</a>)) }));

import { ProfileForm } from "./profile-form";

const ANA: CurrentUserDto = { id: "u1", name: "Ana Souza", email: "ana@exemplo.com", role: "USER", mustChangePassword: false };
const setup = (user = ANA) => render(<AllProviders><ProfileForm user={user} /></AllProviders>);
const name = () => screen.getByLabelText("Nome", { selector: "input" }) as HTMLInputElement;
const save = () => screen.getByRole("button", { name: /^Salvar$|^Salvando/ });

/** Promises pendentes dos testes de "carregando": resolvidas no afterEach para o cleanup nao travar quando o teste falha antes. */
const release: Array<() => void> = [];
afterEach(() => release.splice(0).forEach((f) => f()));

beforeEach(() => {
  actions.updateProfileAction.mockReset().mockResolvedValue({ status: "idle" } satisfies FormState);
  router.refresh.mockReset();
});

describe("ProfileForm: leitura (RF09, RF43, design 5.3)", () => {
  it("Nome editavel; E-mail e Nivel em <dl> de texto (nao inputs); indicacao para falar com administrador", () => {
    setup();
    expect(name().value).toBe("Ana Souza");
    expect(name()).toHaveAttribute("autocomplete", "name");
    expect(name()).toHaveAttribute("autocapitalize", "words");
    const dl = document.querySelector("dl") as HTMLElement;
    expect(within(dl).getByText("E-mail")).toBeInTheDocument();
    expect(within(dl).getByText("ana@exemplo.com")).toBeInTheDocument();
    expect(within(dl).getByText("Nível")).toBeInTheDocument();
    expect(within(dl).getByText("Usuário comum")).toBeInTheDocument();
    expect(screen.queryByLabelText("E-mail")).not.toBeInTheDocument();
    expect(screen.getByText("Para alterar, fale com um administrador.")).toBeInTheDocument();
  });

  it("administrador aparece como 'Administrador'", () => {
    setup({ ...ANA, role: "ADMIN" });
    expect(screen.getByText("Administrador")).toBeInTheDocument();
  });

  it("card 'Senha' com atalho 'Trocar senha' -> /account/password", () => {
    setup();
    expect(screen.getByText("Troque sua senha quando quiser.")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Trocar senha" })).toHaveAttribute("href", "/account/password");
  });
});

describe("ProfileForm: salvar (CA11)", () => {
  it("envia o nome DIGITADO (a normalizacao e do servidor)", async () => {
    setup();
    await userEvent.clear(name());
    await userEvent.type(name(), "  ana   lima ");
    await userEvent.click(save());
    await waitFor(() => expect(actions.updateProfileAction).toHaveBeenCalledTimes(1));
    expect((actions.updateProfileAction.mock.calls[0][1] as FormData).get("name")).toBe("  ana   lima ");
  });

  it("sucesso: campo mostra o valor NORMALIZADO da API, toast 'Perfil atualizado.' e router.refresh() (inicial da navbar)", async () => {
    actions.updateProfileAction.mockResolvedValue({ status: "success", values: { name: "ana lima" } } satisfies FormState);
    setup();
    await userEvent.clear(name());
    await userEvent.type(name(), "  ana   lima ");
    await userEvent.click(save());
    expect(await screen.findByText("Perfil atualizado.")).toBeInTheDocument();
    await waitFor(() => expect(name().value).toBe("ana lima"));
    expect(router.refresh).toHaveBeenCalled();
  });

  it("nome vazio: 'Informe seu nome.' no cliente, foco no campo, action nao chamada", async () => {
    setup();
    await userEvent.clear(name());
    await userEvent.click(save());
    expect(screen.getByText("Informe seu nome.")).toBeInTheDocument();
    expect(name()).toHaveFocus();
    expect(actions.updateProfileAction).not.toHaveBeenCalled();
  });

  it("TOO_LONG do servidor: 'Use ate 60 caracteres.'", async () => {
    actions.updateProfileAction.mockResolvedValue({ status: "error", fields: { name: "Use até 60 caracteres." } } satisfies FormState);
    setup();
    await userEvent.type(name(), "x");
    await userEvent.click(save());
    expect(await screen.findByText("Use até 60 caracteres.")).toBeInTheDocument();
  });

  it("contador 'n/60' aparece a partir de 50 caracteres", async () => {
    setup({ ...ANA, name: "a".repeat(49) });
    expect(screen.queryByText(/\/60/)).not.toBeInTheDocument();
    await userEvent.type(name(), "bb");
    expect(screen.getByText("51/60")).toBeInTheDocument();
  });

  it("rede: alerta no topo do card e valor digitado preservado", async () => {
    actions.updateProfileAction.mockResolvedValue({ status: "error", code: "NETWORK_ERROR", values: { name: "Ana Nova" } } satisfies FormState);
    setup();
    await userEvent.clear(name());
    await userEvent.type(name(), "Ana Nova");
    await userEvent.click(save());
    expect(await screen.findByRole("alert")).toHaveTextContent("Não foi possível salvar agora. Verifique sua conexão e tente novamente.");
    expect(name().value).toBe("Ana Nova");
  });

  it("carregando: 'Salvando…' e uma so chamada", async () => {
    actions.updateProfileAction.mockImplementation(() => new Promise<FormState>((r) => release.push(() => r({ status: "idle" }))));
    setup();
    await userEvent.type(name(), "x");
    await userEvent.click(save());
    const busy = await screen.findByRole("button", { name: "Salvando…" });
    await userEvent.click(busy);
    expect(actions.updateProfileAction).toHaveBeenCalledTimes(1);
  });
});
