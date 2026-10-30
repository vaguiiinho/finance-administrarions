import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { PasswordField } from "./password-field";

const input = () => screen.getByLabelText("Senha", { selector: "input" }) as HTMLInputElement;
const eye = () => screen.getByRole("button", { name: "Mostrar senha" });

describe("PasswordField (design 10.2, PA6)", () => {
  it("oculto por padrao: type=password; botao 'Mostrar senha' aria-pressed=false e aria-controls no input", () => {
    render(<PasswordField label="Senha" name="password" />);
    expect(input().type).toBe("password");
    expect(eye()).toHaveAttribute("aria-pressed", "false");
    expect(eye()).toHaveAttribute("aria-controls", input().id);
    expect(eye()).toHaveAttribute("type", "button");
  });

  it("clicar alterna a visibilidade, mantem o nome acessivel fixo, o foco no botao e o valor", async () => {
    render(<PasswordField label="Senha" name="password" defaultValue="segredo123" />);
    await userEvent.click(eye());
    expect(input().type).toBe("text");
    expect(eye()).toHaveAttribute("aria-pressed", "true");
    expect(eye()).toHaveAttribute("aria-label", "Mostrar senha");
    expect(eye()).toHaveFocus();
    expect(input().value).toBe("segredo123");
    await userEvent.click(eye());
    expect(input().type).toBe("password");
  });

  it("initiallyVisible (senha temporaria): comeca em texto, aria-pressed=true", () => {
    render(<PasswordField label="Senha" name="password" initiallyVisible />);
    expect(input().type).toBe("text");
    expect(eye()).toHaveAttribute("aria-pressed", "true");
  });

  it("o botao de olho tem alvo de 44px", () => {
    render(<PasswordField label="Senha" name="password" />);
    expect(eye().className).toMatch(/size-11|h-11|min-h-11|w-11|min-w-11/);
  });

  it("espacos sao permitidos e nao sofrem trim", async () => {
    render(<PasswordField label="Senha" name="password" />);
    await userEvent.type(input(), " a b ");
    expect(input().value).toBe(" a b ");
  });

  it("erro: aria-invalid, mensagem role=alert ligada por aria-describedby", () => {
    render(<PasswordField label="Senha" name="password" error="Informe a senha." />);
    expect(input()).toHaveAttribute("aria-invalid", "true");
    const alert = screen.getByRole("alert");
    expect(alert).toHaveTextContent("Informe a senha.");
    expect(input().getAttribute("aria-describedby")).toContain(alert.id);
  });

  it("autocomplete e repassado (current-password / new-password / off)", () => {
    render(<PasswordField label="Senha" name="password" autoComplete="new-password" />);
    expect(input()).toHaveAttribute("autocomplete", "new-password");
  });

  it("lengthHint: 'De 8 a 72 caracteres.' sempre visivel e ligado ao campo; sem anuncio ao vivo", async () => {
    render(<PasswordField label="Senha" name="password" lengthHint />);
    const hint = screen.getByText("De 8 a 72 caracteres.");
    expect(input().getAttribute("aria-describedby")).toContain(hint.closest("[id]")?.id ?? "__none__");
    expect(hint.closest("[aria-live]")).toBeNull();
  });

  it("lengthHint: o indicador muda de 'fora da faixa' para 'dentro' entre 8 e 72 caracteres", async () => {
    const { container } = render(<PasswordField label="Senha" name="password" lengthHint />);
    const state = () => container.querySelector("[data-length-ok]")?.getAttribute("data-length-ok");
    expect(state()).toBe("false");
    await userEvent.type(input(), "1234567");
    expect(state()).toBe("false");
    await userEvent.type(input(), "8");
    expect(state()).toBe("true");
  });

  it("Caps Lock ativo com o campo focado mostra 'Caps Lock está ativado.'; some quando desativa", async () => {
    render(<PasswordField label="Senha" name="password" />);
    input().focus();
    expect(screen.queryByText("Caps Lock está ativado.")).not.toBeInTheDocument();
    fireEvent.keyDown(input(), { key: "A", modifierCapsLock: true });
    expect(await screen.findByText("Caps Lock está ativado.")).toBeInTheDocument();
    fireEvent.keyDown(input(), { key: "a", modifierCapsLock: false });
    expect(screen.queryByText("Caps Lock está ativado.")).not.toBeInTheDocument();
  });
});
