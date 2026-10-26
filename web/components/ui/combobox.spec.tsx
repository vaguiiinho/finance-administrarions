import { act, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { describe, expect, it, vi } from "vitest";
import { CategoryCombobox } from "./combobox";

function Harness({ onValue }: { onValue?: (v: string) => void }) {
  const [value, setValue] = useState("");
  return (
    <CategoryCombobox
      label="Categoria"
      required
      name="category"
      value={value}
      onValueChange={(v) => {
        setValue(v);
        onValue?.(v);
      }}
      options={["Alimentação", "Moradia", "Mercado"]}
    />
  );
}
const input = () => screen.getByRole("combobox", { name: /^Categoria/ });

describe("CategoryCombobox (design 3.9, ARIA combobox + listbox)", () => {
  it("papeis e estado: combobox com aria-expanded/controls/autocomplete; lista fechada ate focar", async () => {
    render(<Harness />);
    expect(input()).toHaveAttribute("aria-expanded", "false");
    expect(input()).toHaveAttribute("aria-autocomplete", "list");
    await userEvent.click(input());
    expect(input()).toHaveAttribute("aria-expanded", "true");
    const list = screen.getByRole("listbox");
    expect(input().getAttribute("aria-controls")).toBe(list.id);
    expect(screen.getAllByRole("option").map((o) => o.textContent)).toEqual(["Alimentação", "Moradia", "Mercado"]);
  });

  it("busca sem diferenciar maiusculas e com trim; opcao `Usar \"texto\"` so para categoria nova", async () => {
    render(<Harness />);
    await userEvent.type(input(), "  MER");
    expect(screen.getAllByRole("option").map((o) => o.textContent)).toEqual(["Mercado", 'Usar "MER"']);
    await userEvent.clear(input());
    await userEvent.type(input(), "moradia");
    expect(screen.getAllByRole("option").map((o) => o.textContent)).toEqual(["Moradia"]); // igual (case-insensitive): sem "Usar"
  });

  it("teclado: setas navegam com aria-activedescendant, Enter escolhe, Home/End, Esc fecha so a lista", async () => {
    const onValue = vi.fn();
    render(<Harness onValue={onValue} />);
    await userEvent.click(input());
    await userEvent.keyboard("{ArrowDown}{ArrowDown}");
    const options = screen.getAllByRole("option");
    expect(options[1]).toHaveAttribute("aria-selected", "true");
    expect(input().getAttribute("aria-activedescendant")).toBe(options[1].id);
    await userEvent.keyboard("{End}");
    expect(screen.getAllByRole("option")[2]).toHaveAttribute("aria-selected", "true");
    await userEvent.keyboard("{Home}{ArrowUp}");
    expect(screen.getAllByRole("option")[2]).toHaveAttribute("aria-selected", "true"); // volta ao fim
    await userEvent.keyboard("{Enter}");
    expect(onValue).toHaveBeenLastCalledWith("Mercado");
    expect(input()).toHaveValue("Mercado");
    expect(input()).toHaveAttribute("aria-expanded", "false");
    await userEvent.keyboard("{ArrowDown}");
    expect(input()).toHaveAttribute("aria-expanded", "true");
    const escape = vi.fn();
    document.addEventListener("keydown", escape);
    await userEvent.keyboard("{Escape}");
    document.removeEventListener("keydown", escape);
    expect(input()).toHaveAttribute("aria-expanded", "false");
    expect(escape).not.toHaveBeenCalled(); // nao propaga (nao fecha o drawer)
  });

  it("Enter sem opcao ativa mantem o texto livre; escolher `Usar` grava o texto sem espacos nas pontas", async () => {
    render(<Harness />);
    await userEvent.type(input(), " Pets {Enter}");
    expect(input()).toHaveValue(" Pets ");
    await userEvent.click(screen.getByRole("option", { name: 'Usar "Pets"' }));
    expect(input()).toHaveValue("Pets");
  });

  it("clique numa sugestao escolhe sem perder o foco; Tab fecha", async () => {
    render(<Harness />);
    await userEvent.click(input());
    await userEvent.click(screen.getByRole("option", { name: "Alimentação" }));
    expect(input()).toHaveValue("Alimentação");
    expect(input()).toHaveFocus();
    await userEvent.type(input(), "{Backspace}");
    await userEvent.tab();
    expect(input()).toHaveAttribute("aria-expanded", "false");
  });

  it("exibe erro ligado por aria-describedby", () => {
    render(<CategoryCombobox label="Categoria" error="Informe a categoria." value="" onValueChange={() => {}} options={[]} />);
    expect(input()).toHaveAccessibleDescription("Informe a categoria.");
    expect(input()).toHaveAttribute("aria-invalid", "true");
  });
});

describe("CategoryCombobox - somente leitura e rolagem", () => {
  it("readOnly (durante o envio): nao abre a lista, ignora teclado e nao troca a categoria", async () => {
    const onValue = vi.fn();
    render(<CategoryCombobox label="Categoria" value="Moradia" onValueChange={onValue} options={["Alimentação", "Moradia"]} readOnly />);
    await userEvent.click(input());
    await userEvent.keyboard("{ArrowDown}{Enter}");
    expect(input()).toHaveAttribute("aria-expanded", "false");
    expect(screen.queryAllByRole("option")).toHaveLength(0);
    expect(onValue).not.toHaveBeenCalled();
  });
  it("disabled tambem nao abre", async () => {
    render(<CategoryCombobox label="Categoria" value="" onValueChange={() => {}} options={["A"]} disabled />);
    await userEvent.click(input());
    expect(input()).toHaveAttribute("aria-expanded", "false");
  });
  it("a opcao ativa e rolada para a vista (scrollIntoView nearest)", async () => {
    const spy = vi.fn();
    Element.prototype.scrollIntoView = spy;
    render(<Harness />);
    await userEvent.click(input());
    await userEvent.keyboard("{ArrowDown}{ArrowDown}");
    expect(spy).toHaveBeenLastCalledWith({ block: "nearest" });
  });
  it("compoe handlers recebidos por props (onFocus/onKeyDown/onBlur) em vez de sobrescrever", async () => {
    const onFocus = vi.fn();
    const onKeyDown = vi.fn();
    const onBlur = vi.fn();
    render(<CategoryCombobox label="Categoria" value="" onValueChange={() => {}} options={["A"]} onFocus={onFocus} onKeyDown={onKeyDown} onBlur={onBlur} />);
    await userEvent.click(input());
    await userEvent.keyboard("{ArrowDown}");
    expect(onFocus).toHaveBeenCalled();
    expect(onKeyDown).toHaveBeenCalled();
    expect(input()).toHaveAttribute("aria-expanded", "true");
    await userEvent.tab();
    expect(onBlur).toHaveBeenCalled();
  });
});

describe("CategoryCombobox - abertura da lista (F1, design 3.9.1/3.9.2)", () => {
  it("foco programatico (envio invalido) NAO abre a lista", () => {
    render(<Harness />);
    act(() => input().focus());
    expect(input()).toHaveFocus();
    expect(input()).toHaveAttribute("aria-expanded", "false");
    expect(screen.queryAllByRole("option")).toHaveLength(0);
  });

  it("foco por Tab (teclado) tambem nao abre a lista", async () => {
    render(<Harness />);
    await userEvent.tab();
    expect(input()).toHaveFocus();
    expect(input()).toHaveAttribute("aria-expanded", "false");
  });

  it("com o campo vazio e focado, a lista nao cobre a mensagem de erro nem a ajuda", () => {
    render(<CategoryCombobox label="Categoria" error="Informe a categoria." help="Ex.: Moradia" value="" onValueChange={() => {}} options={["Alimentação", "Moradia"]} />);
    act(() => input().focus());
    expect(input()).toHaveAttribute("aria-expanded", "false");
    expect(screen.queryAllByRole("option")).toHaveLength(0);
    expect(screen.getByText("Informe a categoria.")).toBeVisible();
  });

  it("abre ao digitar", async () => {
    render(<Harness />);
    act(() => input().focus());
    await userEvent.keyboard("a");
    expect(input()).toHaveAttribute("aria-expanded", "true");
  });

  it("abre com ArrowDown e com ArrowUp", async () => {
    render(<Harness />);
    act(() => input().focus());
    await userEvent.keyboard("{ArrowDown}");
    expect(input()).toHaveAttribute("aria-expanded", "true");
    await userEvent.keyboard("{Escape}");
    expect(input()).toHaveAttribute("aria-expanded", "false");
    await userEvent.keyboard("{ArrowUp}");
    expect(input()).toHaveAttribute("aria-expanded", "true");
  });

  it("abre com clique no input, tambem apos Esc com o foco mantido", async () => {
    render(<Harness />);
    await userEvent.click(input());
    expect(input()).toHaveAttribute("aria-expanded", "true");
    await userEvent.keyboard("{Escape}");
    expect(input()).toHaveAttribute("aria-expanded", "false");
    await userEvent.click(input());
    expect(input()).toHaveAttribute("aria-expanded", "true");
  });

  it("Enter com a lista aberta e sem opcao ativa nao envia o formulario (design 3.9.1: nao faz nada)", async () => {
    const submit = vi.fn((e: React.FormEvent) => e.preventDefault());
    render(
      <form onSubmit={submit}>
        <Harness />
      </form>,
    );
    await userEvent.type(input(), "Pets{Enter}");
    expect(submit).not.toHaveBeenCalled();
    await userEvent.keyboard("{Escape}{Enter}"); // lista fechada: Enter volta ao comportamento nativo
    expect(submit).toHaveBeenCalledTimes(1);
  });

  it("opcoes que diferem so na caixa aparecem uma vez", async () => {
    render(<CategoryCombobox label="Categoria" value="" onValueChange={() => {}} options={["Moradia", "moradia", "MORADIA", "Saúde"]} />);
    await userEvent.click(input());
    expect(screen.getAllByRole("option").map((o) => o.textContent)).toEqual(["Moradia", "Saúde"]);
  });
});
