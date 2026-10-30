import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { describe, expect, it } from "vitest";
import { ModalDialog } from "./modal-dialog";

function Harness() {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button onClick={() => setOpen(true)}>abrir</button>
      <button onClick={() => document.getElementById("outro")?.focus()}>mover</button>
      <button id="outro">outro</button>
      {open ? (
        <ModalDialog variant="modal" labelledBy="t" onClose={() => setOpen(false)}>
          <h2 id="t">Titulo</h2>
          <button onClick={() => setOpen(false)}>fechar</button>
        </ModalDialog>
      ) : null}
    </>
  );
}

describe("ModalDialog: devolucao do foco ao fechar", () => {
  it("o foco volta para quem abriu", async () => {
    render(<Harness />);
    await userEvent.click(screen.getByRole("button", { name: "abrir" }));
    await userEvent.click(screen.getByRole("button", { name: "fechar" }));
    expect(screen.getByRole("button", { name: "abrir" })).toHaveFocus();
  });
  it("se quem fechou mandou o foco para outro lugar, ele nao e roubado", async () => {
    function Mover() {
      const [open, setOpen] = useState(true);
      return (
        <>
          <button id="alvo">alvo</button>
          {open ? (
            <ModalDialog variant="modal" labelledBy="t" onClose={() => setOpen(false)}>
              <h2 id="t">T</h2>
              <button
                onClick={() => {
                  document.getElementById("alvo")?.focus();
                  setOpen(false);
                }}
              >
                ir
              </button>
            </ModalDialog>
          ) : null}
        </>
      );
    }
    render(<Mover />);
    await userEvent.click(screen.getByRole("button", { name: "ir" }));
    expect(screen.getByRole("button", { name: "alvo" })).toHaveFocus();
  });
});
