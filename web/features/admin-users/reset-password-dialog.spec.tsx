import { act, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AllProviders, router } from "@/test/helpers/providers";
import { pressEscapeInDialog } from "@/test/helpers/dialog";
import type { ActionResult } from "@/lib/api/types";
import { ANA, BRUNO } from "./test-support";

const actions = vi.hoisted(() => ({ resetUserPasswordAction: vi.fn() }));
vi.mock("@/app/(protected)/admin/users/actions", () => actions);
vi.mock("next/navigation", () => ({ useRouter: () => router, usePathname: () => "/admin/users" }));

import { ResetPasswordDialog } from "./reset-password-dialog";

const onClose = vi.fn();
const setup = (user = ANA) => render(<AllProviders><ResetPasswordDialog user={user} onClose={onClose} /></AllProviders>);
const password = () => screen.getByLabelText("Nova senha temporária", { selector: "input" }) as HTMLInputElement;
const submit = () => screen.getByRole("button", { name: /^Redefinir senha$|^Redefinindo/ });
const fail = (status: number, code: string, extra: Record<string, unknown> = {}): ActionResult<never> => ({ ok: false, error: { status, code, message: code, ...extra } });

beforeEach(() => {
  actions.resetUserPasswordAction.mockReset();
  onClose.mockReset();
  router.refresh.mockReset();
  router.replace.mockReset();
});
afterEach(() => vi.useRealTimers());

describe("ResetPasswordDialog (RF16, CA22, design 6.6)", () => {
  it("modal com titulo, consequencias em lista e foco no campo de senha (visivel por padrao)", () => {
    setup();
    const dialog = screen.getByRole("dialog", { name: "Redefinir senha de Ana Souza" });
    expect(within(dialog).getByRole("list")).toHaveTextContent(/A senha atual de Ana Souza deixa de valer\./);
    expect(dialog).toHaveTextContent(/sessões abertas/);
    expect(dialog).toHaveTextContent(/nova senha/i);
    expect(password().type).toBe("text");
    expect(password()).toHaveAttribute("autocomplete", "off");
    expect(password()).toHaveFocus();
    expect(screen.getByText("Informe-a a essa pessoa fora do sistema.")).toBeInTheDocument();
  });

  it("usuario inativo: acrescenta 'A nova senha passa a valer quando a conta for reativada.'", () => {
    setup(BRUNO);
    expect(screen.getByText("A nova senha passa a valer quando a conta for reativada.")).toBeInTheDocument();
  });

  it("usuario ativo nao mostra a frase de reativacao", () => {
    setup();
    expect(screen.queryByText("A nova senha passa a valer quando a conta for reativada.")).not.toBeInTheDocument();
  });

  it("senha vazia: 'Informe a senha temporaria.' e a action nao e chamada", async () => {
    setup();
    await userEvent.click(submit());
    expect(screen.getByText("Informe a senha temporária.")).toBeInTheDocument();
    expect(actions.resetUserPasswordAction).not.toHaveBeenCalled();
  });

  it("sucesso: action com id e senha, fecha, toast exato e recarga", async () => {
    actions.resetUserPasswordAction.mockResolvedValue({ ok: true, data: { ...ANA, mustChangePassword: true } });
    setup();
    await userEvent.type(password(), "Nova1234");
    await userEvent.click(submit());
    await waitFor(() => expect(actions.resetUserPasswordAction).toHaveBeenCalledWith(ANA.id, { password: "Nova1234" }));
    expect(await screen.findByText("Senha de Ana Souza redefinida. Informe a nova senha temporária a essa pessoa.")).toBeInTheDocument();
    expect(onClose).toHaveBeenCalled();
    expect(router.refresh).toHaveBeenCalled();
  });

  it("400 TOO_SHORT / TOO_LONG inline no campo", async () => {
    actions.resetUserPasswordAction.mockResolvedValue(fail(400, "VALIDATION_ERROR", { fields: [{ field: "password", code: "TOO_SHORT", message: "x" }] }));
    setup();
    await userEvent.type(password(), "123");
    await userEvent.click(submit());
    expect(await screen.findByText("A senha precisa ter pelo menos 8 caracteres.")).toBeInTheDocument();
    expect(onClose).not.toHaveBeenCalled();
  });

  it("CANNOT_TARGET_SELF: texto de erro (role alert) acima dos botoes; modal continua aberto", async () => {
    actions.resetUserPasswordAction.mockResolvedValue(fail(422, "CANNOT_TARGET_SELF"));
    setup();
    await userEvent.type(password(), "Nova1234");
    await userEvent.click(submit());
    expect(await screen.findByRole("alert")).toHaveTextContent("Você não pode executar esta ação na sua própria conta.");
    expect(onClose).not.toHaveBeenCalled();
  });

  it("Esc fecha; durante o envio Esc e ignorado", async () => {
    actions.resetUserPasswordAction.mockReturnValue(new Promise(() => {}));
    setup();
    await userEvent.type(password(), "Nova1234");
    await userEvent.click(submit());
    await screen.findByRole("button", { name: "Redefinindo…" });
    pressEscapeInDialog();
    expect(onClose).not.toHaveBeenCalled();
  });

  it("Esc fora do envio fecha", async () => {
    setup();
    pressEscapeInDialog();
    expect(onClose).toHaveBeenCalled();
  });

  it("Cancelar fecha sem chamar a API", async () => {
    setup();
    await userEvent.click(screen.getByRole("button", { name: "Cancelar" }));
    expect(onClose).toHaveBeenCalled();
    expect(actions.resetUserPasswordAction).not.toHaveBeenCalled();
  });

  it("clique no scrim NAO fecha (ha dado digitado)", async () => {
    setup();
    await userEvent.type(password(), "Nova");
    await userEvent.click(screen.getByRole("dialog"));
    expect(onClose).not.toHaveBeenCalled();
  });

  it("sessao expirada: alerta exato e login apos 1,5 s", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    actions.resetUserPasswordAction.mockResolvedValue(fail(401, "SESSION_EXPIRED", { message: "Sua sessão expirou. Entre novamente.", redirectUrl: "/login?reason=expired" }));
    setup();
    await userEvent.type(password(), "Nova1234");
    await userEvent.click(submit());
    expect(await screen.findByRole("alert")).toHaveTextContent("Sua sessão expirou. Entre novamente.");
    await act(async () => vi.advanceTimersByTime(1600));
    expect(router.replace).toHaveBeenCalledWith("/login?reason=expired");
  });
});
