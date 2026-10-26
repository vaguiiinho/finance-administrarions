import { act, fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ThemeToggle } from "./theme-toggle";

function mockSystem(dark: boolean) {
  const listeners = new Set<() => void>();
  const media = {
    matches: dark,
    addEventListener: (_: string, cb: () => void) => listeners.add(cb),
    removeEventListener: (_: string, cb: () => void) => listeners.delete(cb),
  };
  vi.stubGlobal("matchMedia", () => media);
  return {
    change(next: boolean) {
      media.matches = next;
      listeners.forEach((cb) => cb());
    },
  };
}

beforeEach(() => {
  delete document.documentElement.dataset.theme;
  document.cookie = "theme=; Max-Age=0; Path=/";
  vi.stubGlobal("requestAnimationFrame", (cb: FrameRequestCallback) => setTimeout(() => cb(0), 0));
});
afterEach(() => vi.unstubAllGlobals());

describe("ThemeToggle (CA78-CA81, design 2.2)", () => {
  it("rotulo fixo 'Tema escuro', aria-pressed reflete o tema efetivo e os dois icones estao no DOM", () => {
    mockSystem(false);
    document.documentElement.dataset.theme = "dark";
    const { container } = render(<ThemeToggle initialTheme="dark" />);
    const button = screen.getByRole("button", { name: "Tema escuro" });
    expect(button).toHaveAttribute("aria-pressed", "true");
    expect(container.querySelector(".theme-icon-sun")).toBeInTheDocument();
    expect(container.querySelector(".theme-icon-moon")).toBeInTheDocument();
    expect(container.querySelectorAll("svg[aria-hidden='true']")).toHaveLength(2);
  });

  it("clique alterna claro <-> escuro, grava o cookie e o atributo do <html>, e mantem o foco", async () => {
    mockSystem(true);
    document.documentElement.dataset.theme = "dark";
    render(<ThemeToggle initialTheme="dark" />);
    const button = screen.getByRole("button", { name: "Tema escuro" });
    await userEvent.click(button);
    expect(document.documentElement.dataset.theme).toBe("light");
    expect(document.cookie).toContain("theme=light");
    expect(button).toHaveAttribute("aria-pressed", "false");
    expect(button).toHaveAttribute("aria-label", "Tema escuro");
    expect(button).toHaveFocus();
    await userEvent.click(button);
    expect(document.documentElement.dataset.theme).toBe("dark");
    expect(button).toHaveAttribute("aria-pressed", "true");
  });

  it.each(["{Enter}", " "])("teclado (%j) alterna e o foco permanece", async (key) => {
    mockSystem(false);
    render(<ThemeToggle />);
    const button = screen.getByRole("button", { name: "Tema escuro" });
    button.focus();
    await userEvent.keyboard(key);
    expect(document.documentElement.dataset.theme).toBe("dark");
    expect(button).toHaveAttribute("aria-pressed", "true");
    expect(button).toHaveFocus();
  });

  it("troca instantanea: marca data-theme-switching por um quadro e depois remove", async () => {
    vi.useFakeTimers();
    mockSystem(false);
    render(<ThemeToggle />);
    fireEvent.click(screen.getByRole("button", { name: "Tema escuro" }));
    expect(document.documentElement.dataset.themeSwitching).toBeDefined();
    await act(async () => {
      await vi.runAllTimersAsync();
    });
    expect(document.documentElement.dataset.themeSwitching).toBeUndefined();
    vi.useRealTimers();
  });

  it("sem preferencia segue o sistema ao vivo (CA79)", () => {
    const system = mockSystem(false);
    render(<ThemeToggle />);
    const button = screen.getByRole("button", { name: "Tema escuro" });
    expect(button).toHaveAttribute("aria-pressed", "false");
    act(() => system.change(true));
    expect(button).toHaveAttribute("aria-pressed", "true");
  });

  it("com preferencia, a mudanca do sistema nao sobrepoe (CA80)", () => {
    const system = mockSystem(false);
    document.documentElement.dataset.theme = "light";
    render(<ThemeToggle initialTheme="light" />);
    act(() => system.change(true));
    expect(screen.getByRole("button", { name: "Tema escuro" })).toHaveAttribute("aria-pressed", "false");
  });

  it("alternar nao desmonta nem toca o estado de outras arvores (CA84)", async () => {
    mockSystem(false);
    render(
      <>
        <input aria-label="digitado" defaultValue="" />
        <ThemeToggle />
      </>,
    );
    await userEvent.type(screen.getByLabelText("digitado"), "texto");
    for (let i = 0; i < 5; i++) await userEvent.click(screen.getByRole("button", { name: "Tema escuro" }));
    expect(screen.getByLabelText("digitado")).toHaveValue("texto");
  });
});
