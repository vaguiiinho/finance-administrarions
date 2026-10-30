import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { pressEscapeInDialog } from "@/test/helpers/dialog";
import { AlertDialog } from "./dialogs";
import { ModalDialog } from "./modal-dialog";
import { InlineAlert } from "./states";

describe("InlineAlert tone=warning (design 10.1)", () => {
  it("renderiza com role alert e usa estilo proprio de aviso (borda/icone --warning), distinto de danger e info", () => {
    const { container, rerender } = render(<InlineAlert tone="warning">Muitas tentativas.</InlineAlert>);
    expect(screen.getByRole("alert")).toHaveTextContent("Muitas tentativas.");
    const warning = (container.firstElementChild as HTMLElement).outerHTML;
    expect(warning).toMatch(/warning/);
    rerender(<InlineAlert tone="info">x</InlineAlert>);
    expect((container.firstElementChild as HTMLElement).outerHTML).not.toMatch(/warning/);
    rerender(<InlineAlert tone="danger">x</InlineAlert>);
    expect((container.firstElementChild as HTMLElement).outerHTML).not.toMatch(/warning/);
  });
  it("aceita role=status (aviso de auto-rebaixamento)", () => {
    render(
      <InlineAlert tone="warning" role="status">
        Você deixará de ter acesso à gestão de usuários.
      </InlineAlert>,
    );
    expect(screen.getByRole("status")).toHaveTextContent("Você deixará de ter acesso à gestão de usuários.");
  });
});

describe("AlertDialog: linha 'nao pode ser desfeita' opcional (design 6.7)", () => {
  const props = { title: "Inativar Bruno Lima?", confirmLabel: "Inativar", onConfirm: vi.fn(), onCancel: vi.fn() };
  it("padrao ligado (usos atuais nao mudam)", () => {
    render(<AlertDialog {...props}>corpo</AlertDialog>);
    expect(screen.getByText("Esta ação não pode ser desfeita.")).toBeInTheDocument();
  });
  it("irreversible={false} remove a linha", () => {
    render(
      <AlertDialog {...props} irreversible={false}>
        corpo
      </AlertDialog>,
    );
    expect(screen.queryByText("Esta ação não pode ser desfeita.")).not.toBeInTheDocument();
    expect(screen.getByText("corpo")).toBeInTheDocument();
  });
});

describe("ModalDialog variant=drawer-left (design 17.6, 17.12)", () => {
  it("usa a classe .drawer-left (espelho da .drawer-right) e o comportamento de dialogo modal", async () => {
    const onClose = vi.fn();
    render(
      <ModalDialog variant="drawer-left" labelledBy="t" onClose={onClose}>
        <h2 id="t">Menu de navegação</h2>
      </ModalDialog>,
    );
    const dialog = screen.getByRole("dialog", { name: "Menu de navegação" });
    expect(dialog.className).toContain("drawer-left");
    expect(dialog.className).not.toContain("drawer-right");
    expect(dialog).toHaveAttribute("aria-modal", "true");
    pressEscapeInDialog();
    expect(onClose).toHaveBeenCalled();
  });
});
