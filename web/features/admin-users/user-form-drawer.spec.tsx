import { act, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AllProviders, router } from "@/test/helpers/providers";
import type { ActionResult } from "@/lib/api/types";
import { ANA, VAGNER, adminUser } from "./test-support";

const actions = vi.hoisted(() => ({ createUserAction: vi.fn(), updateUserAction: vi.fn() }));
vi.mock("@/app/(protected)/admin/users/actions", () => actions);
vi.mock("next/navigation", () => ({ useRouter: () => router, usePathname: () => "/admin/users" }));

import { UserFormDrawer } from "./user-form-drawer";

const onClose = vi.fn();
const setup = (props: Partial<Parameters<typeof UserFormDrawer>[0]> = {}) => render(<AllProviders><UserFormDrawer currentUserId={VAGNER.id} onClose={onClose} {...props} /></AllProviders>);
const name = () => screen.getByLabelText("Nome", { selector: "input" }) as HTMLInputElement;
const email = () => screen.getByLabelText("E-mail", { selector: "input" }) as HTMLInputElement;
const temp = () => screen.getByLabelText("Senha temporária", { selector: "input" }) as HTMLInputElement;
const role = (label: "Usuário comum" | "Administrador") => screen.getByRole("radio", { name: label });
const submit = (label: string) => screen.getByRole("button", { name: label });
const fail = (status: number, code: string, fields: { field: string; code: string }[] = [], extra: Record<string, unknown> = {}): ActionResult<never> => ({
  ok: false,
  error: { status, code, message: code, fields: fields.map((f) => ({ ...f, message: "x" })), ...extra },
});

beforeEach(() => {
  Object.values(actions).forEach((f) => f.mockReset());
  onClose.mockReset();
  router.refresh.mockReset();
  router.push.mockReset();
  router.replace.mockReset();
});
afterEach(() => vi.useRealTimers());

describe("UserFormDrawer: criar (RF12, CA16-CA18, design 6.4)", () => {
  it("titulo, campos, nivel sem valor inicial, senha temporaria VISIVEL por padrao (PA6) e ajuda", () => {
    setup();
    expect(screen.getByRole("dialog", { name: "Novo usuário" })).toBeInTheDocument();
    expect(name()).toHaveAttribute("autocomplete", "off");
    expect(email()).toHaveAttribute("type", "email");
    expect(email()).toHaveAttribute("autocomplete", "off");
    expect(screen.getByRole("radiogroup", { name: "Nível" })).toBeInTheDocument();
    expect(role("Usuário comum")).toHaveAttribute("aria-checked", "false");
    expect(role("Administrador")).toHaveAttribute("aria-checked", "false");
    expect(screen.getByText("Administradores gerenciam contas, mas não veem dados financeiros de outras pessoas.")).toBeInTheDocument();
    expect(temp().type).toBe("text");
    expect(temp()).toHaveAttribute("autocomplete", "off");
    expect(screen.getByText("A pessoa precisará trocá-la no primeiro acesso. Informe-a fora do sistema.")).toBeInTheDocument();
    expect(submit("Criar usuário")).toBeInTheDocument();
    expect(name()).toHaveFocus();
  });

  it("envio vazio: erros de campo inline de uma vez, foco no primeiro, action nao chamada", async () => {
    setup();
    await userEvent.click(submit("Criar usuário"));
    expect(screen.getByText("Informe o nome.")).toBeInTheDocument();
    expect(screen.getByText("Informe o e-mail.")).toBeInTheDocument();
    expect(screen.getByText("Escolha o nível.")).toBeInTheDocument();
    expect(screen.getByText("Informe a senha temporária.")).toBeInTheDocument();
    expect(name()).toHaveFocus();
    expect(actions.createUserAction).not.toHaveBeenCalled();
  });

  it("sucesso: envia os valores, fecha, toast com o nome, recarrega a lista", async () => {
    actions.createUserAction.mockResolvedValue({ ok: true, data: adminUser({ name: "Carla Dias", email: "carla@exemplo.com", mustChangePassword: true }) } satisfies ActionResult<ReturnType<typeof adminUser>>);
    setup();
    await userEvent.type(name(), "Carla Dias");
    await userEvent.type(email(), "carla@exemplo.com");
    await userEvent.click(role("Usuário comum"));
    await userEvent.type(temp(), "Temp1234");
    await userEvent.click(submit("Criar usuário"));
    await waitFor(() => expect(actions.createUserAction).toHaveBeenCalledWith({ name: "Carla Dias", email: "carla@exemplo.com", role: "USER", password: "Temp1234" }));
    expect(await screen.findByText("Usuário criado: Carla Dias. Informe a senha temporária a essa pessoa.")).toBeInTheDocument();
    expect(onClose).toHaveBeenCalled();
    expect(router.refresh).toHaveBeenCalled();
  });

  it("CA17: EMAIL_TAKEN vai para o campo E-mail com foco; valores preservados", async () => {
    actions.createUserAction.mockResolvedValue(fail(409, "EMAIL_TAKEN", [{ field: "email", code: "EMAIL_TAKEN" }]));
    setup();
    await userEvent.type(name(), "Outra");
    await userEvent.type(email(), "ANA@exemplo.com");
    await userEvent.click(role("Administrador"));
    await userEvent.type(temp(), "Temp1234");
    await userEvent.click(submit("Criar usuário"));
    expect(await screen.findByText("Este e-mail já está em uso.")).toBeInTheDocument();
    await waitFor(() => expect(email()).toHaveFocus());
    expect(name().value).toBe("Outra");
    expect(temp().value).toBe("Temp1234");
    expect(onClose).not.toHaveBeenCalled();
  });

  it("CA18: 400 acumulado mostra os quatro campos de uma vez", async () => {
    actions.createUserAction.mockResolvedValue(fail(400, "VALIDATION_ERROR", [{ field: "name", code: "REQUIRED" }, { field: "email", code: "INVALID_FORMAT" }, { field: "role", code: "INVALID_VALUE" }, { field: "password", code: "TOO_SHORT" }]));
    setup();
    await userEvent.type(name(), " ");
    await userEvent.type(email(), "ana@");
    await userEvent.click(role("Usuário comum"));
    await userEvent.type(temp(), "1234567");
    await userEvent.click(submit("Criar usuário"));
    expect(await screen.findByText("Informe um e-mail válido, como nome@exemplo.com.")).toBeInTheDocument();
    expect(screen.getByText("Informe o nome.")).toBeInTheDocument();
    expect(screen.getByText("Escolha um nível válido.")).toBeInTheDocument();
    expect(screen.getByText("A senha precisa ter pelo menos 8 caracteres.")).toBeInTheDocument();
  });

  it("rede/5xx: alerta no topo do corpo e valores preservados", async () => {
    actions.createUserAction.mockResolvedValue(fail(0, "NETWORK_ERROR"));
    setup();
    await userEvent.type(name(), "Carla");
    await userEvent.type(email(), "carla@exemplo.com");
    await userEvent.click(role("Usuário comum"));
    await userEvent.type(temp(), "Temp1234");
    await userEvent.click(submit("Criar usuário"));
    expect(await screen.findByRole("alert")).toHaveTextContent("Não foi possível salvar agora. Verifique sua conexão e tente novamente.");
    expect(name().value).toBe("Carla");
  });

  it("sessao expirada: alerta exato, botao sai do carregando, login apos 1,5 s", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    actions.createUserAction.mockResolvedValue(fail(401, "SESSION_EXPIRED", [], { message: "Sua sessão expirou. Entre novamente.", redirectUrl: "/login?reason=expired" }));
    setup();
    await userEvent.type(name(), "Carla");
    await userEvent.type(email(), "carla@exemplo.com");
    await userEvent.click(role("Usuário comum"));
    await userEvent.type(temp(), "Temp1234");
    await userEvent.click(submit("Criar usuário"));
    expect(await screen.findByRole("alert")).toHaveTextContent("Sua sessão expirou. Entre novamente.");
    await act(async () => vi.advanceTimersByTime(1600));
    expect(router.replace).toHaveBeenCalledWith("/login?reason=expired");
  });

  it("carregando: 'Criando…' e uma chamada so", async () => {
    actions.createUserAction.mockReturnValue(new Promise(() => {}));
    setup();
    await userEvent.type(name(), "Carla");
    await userEvent.type(email(), "carla@exemplo.com");
    await userEvent.click(role("Usuário comum"));
    await userEvent.type(temp(), "Temp1234");
    await userEvent.click(submit("Criar usuário"));
    const busy = await screen.findByRole("button", { name: "Criando…" });
    await userEvent.click(busy);
    expect(actions.createUserAction).toHaveBeenCalledTimes(1);
  });

  it("contador do nome a partir de 50 caracteres", async () => {
    setup();
    await userEvent.type(name(), "a".repeat(50));
    expect(screen.getByText("50/60")).toBeInTheDocument();
  });
});

describe("UserFormDrawer: editar (RF13, CA19, CA24, PA7)", () => {
  it("titulo 'Editar <nome>', valores atuais, nivel atual, SEM campo de senha, botao 'Salvar alteracoes'", () => {
    setup({ user: ANA });
    expect(screen.getByRole("dialog", { name: "Editar Ana Souza" })).toBeInTheDocument();
    expect(name().value).toBe("Ana Souza");
    expect(email().value).toBe("ana@exemplo.com");
    expect(role("Usuário comum")).toHaveAttribute("aria-checked", "true");
    expect(screen.queryByLabelText("Senha temporária")).not.toBeInTheDocument();
    expect(submit("Salvar alterações")).toBeInTheDocument();
  });

  it("sucesso: action com id e valores, toast 'Alteracoes salvas.', fecha e recarrega", async () => {
    actions.updateUserAction.mockResolvedValue({ ok: true, data: { user: adminUser({ name: "Ana Lima", role: "ADMIN" }), selfDemoted: false } });
    setup({ user: ANA });
    await userEvent.clear(name());
    await userEvent.type(name(), "Ana Lima");
    await userEvent.click(role("Administrador"));
    await userEvent.click(submit("Salvar alterações"));
    await waitFor(() => expect(actions.updateUserAction).toHaveBeenCalledWith(ANA.id, { name: "Ana Lima", email: "ana@exemplo.com", role: "ADMIN" }));
    expect(await screen.findByText("Alterações salvas.")).toBeInTheDocument();
    expect(onClose).toHaveBeenCalled();
    expect(router.refresh).toHaveBeenCalled();
  });

  it("CA24: LAST_ADMIN vai para o campo Nivel com foco no grupo; nada fecha", async () => {
    actions.updateUserAction.mockResolvedValue(fail(422, "LAST_ADMIN", [{ field: "role", code: "LAST_ADMIN" }]));
    setup({ user: VAGNER });
    await userEvent.click(role("Usuário comum"));
    await userEvent.click(submit("Salvar alterações"));
    expect(await screen.findByText("É preciso manter pelo menos um administrador ativo.")).toBeInTheDocument();
    await waitFor(() => expect(within(screen.getByRole("radiogroup", { name: "Nível" })).getByRole("radio", { checked: true })).toHaveFocus());
    expect(onClose).not.toHaveBeenCalled();
  });

  it("editando a si mesmo com outro nivel: aviso warning 'Voce deixara de ter acesso a gestao de usuarios.' (nao bloqueia)", async () => {
    setup({ user: VAGNER });
    expect(screen.queryByText("Você deixará de ter acesso à gestão de usuários.")).not.toBeInTheDocument();
    await userEvent.click(role("Usuário comum"));
    expect(screen.getByRole("status")).toHaveTextContent("Você deixará de ter acesso à gestão de usuários.");
    expect(submit("Salvar alterações")).toBeEnabled();
  });

  it("editando OUTRA pessoa nao mostra o aviso", async () => {
    setup({ user: ANA });
    await userEvent.click(role("Administrador"));
    await userEvent.click(role("Usuário comum"));
    expect(screen.queryByText("Você deixará de ter acesso à gestão de usuários.")).not.toBeInTheDocument();
  });

  it("PA7: auto-rebaixamento bem sucedido leva a /entries com o toast especifico", async () => {
    actions.updateUserAction.mockResolvedValue({ ok: true, data: { user: { ...VAGNER, role: "USER" }, selfDemoted: true } });
    setup({ user: VAGNER });
    await userEvent.click(role("Usuário comum"));
    await userEvent.click(submit("Salvar alterações"));
    expect(await screen.findByText("Alterações salvas. Você não tem mais acesso à gestão de usuários.")).toBeInTheDocument();
    await waitFor(() => expect(router.push.mock.calls.concat(router.replace.mock.calls).flat()).toContain("/entries"));
  });

  it("USER_NOT_FOUND (CA26): fecha, toast de erro e recarga", async () => {
    actions.updateUserAction.mockResolvedValue(fail(404, "USER_NOT_FOUND"));
    setup({ user: ANA });
    await userEvent.click(submit("Salvar alterações"));
    expect(await screen.findByText("Usuário não encontrado. A lista foi atualizada.")).toBeInTheDocument();
    expect(onClose).toHaveBeenCalled();
    expect(router.refresh).toHaveBeenCalled();
  });

  it("EMAIL_TAKEN na edicao (CA17)", async () => {
    actions.updateUserAction.mockResolvedValue(fail(409, "EMAIL_TAKEN", [{ field: "email", code: "EMAIL_TAKEN" }]));
    setup({ user: ANA });
    await userEvent.click(submit("Salvar alterações"));
    expect(await screen.findByText("Este e-mail já está em uso.")).toBeInTheDocument();
  });
});
