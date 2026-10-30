import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { AllProviders, router } from "@/test/helpers/providers";
import { pressEscapeInDialog } from "@/test/helpers/dialog";
import { BRUNO } from "./test-support";

const actions = vi.hoisted(() => ({ deactivateUserAction: vi.fn() }));
vi.mock("@/app/(protected)/admin/users/actions", () => actions);
vi.mock("next/navigation", () => ({ useRouter: () => router, usePathname: () => "/admin/users" }));

import { DeactivateUserDialog } from "./deactivate-user-dialog";

const onClose = vi.fn();
beforeEach(() => {
  actions.deactivateUserAction.mockReset();
  onClose.mockReset();
  router.refresh.mockReset();
});

describe("DeactivateUserDialog (RF14, CA20, design 6.7)", () => {
  const setup = () => render(<AllProviders><DeactivateUserDialog user={{ ...BRUNO, status: "ACTIVE" }} onClose={onClose} /></AllProviders>);

  it("e um alertdialog com titulo, consequencias, foco em Cancelar e sem a linha de irreversivel", () => {
    setup();
    const dialog = screen.getByRole("alertdialog");
    expect(within(dialog).getByRole("heading", { name: "Inativar Bruno Lima?" })).toBeInTheDocument();
    expect(dialog).toHaveTextContent("todas as sessões abertas serão encerradas agora");
    expect(dialog).toHaveTextContent("Os dados financeiros são mantidos");
    expect(within(dialog).getByRole("button", { name: "Cancelar" })).toHaveFocus();
    expect(dialog).not.toHaveTextContent("Esta ação não pode ser desfeita.");
  });

  it("Esc cancela e nao chama a API", async () => {
    setup();
    pressEscapeInDialog();
    expect(onClose).toHaveBeenCalled();
    expect(actions.deactivateUserAction).not.toHaveBeenCalled();
  });

  it("sucesso: toast 'Bruno Lima foi inativado.', fecha e recarrega", async () => {
    actions.deactivateUserAction.mockResolvedValue({ ok: true, data: { ...BRUNO } });
    setup();
    await userEvent.click(screen.getByRole("button", { name: "Inativar" }));
    await waitFor(() => expect(actions.deactivateUserAction).toHaveBeenCalledWith(BRUNO.id));
    expect(await screen.findByText("Bruno Lima foi inativado.")).toBeInTheDocument();
    expect(onClose).toHaveBeenCalled();
    expect(router.refresh).toHaveBeenCalled();
  });

  it("LAST_ADMIN: erro inline no dialogo, que continua aberto", async () => {
    actions.deactivateUserAction.mockResolvedValue({ ok: false, error: { status: 422, code: "LAST_ADMIN", message: "x" } });
    setup();
    await userEvent.click(screen.getByRole("button", { name: "Inativar" }));
    expect(await screen.findByText("É preciso manter pelo menos um administrador ativo.")).toBeInTheDocument();
    expect(onClose).not.toHaveBeenCalled();
  });
});
