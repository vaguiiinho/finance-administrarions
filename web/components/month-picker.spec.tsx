import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { MonthPicker } from "./month-picker";

describe("MonthPicker (seletor unico, sem intervalo - B6)", () => {
  it("setas anterior/proximo atravessam a virada de ano", async () => {
    const onSelect = vi.fn();
    render(<MonthPicker month="2026-01" currentMonth="2026-10" onSelect={onSelect} />);
    await userEvent.click(screen.getByRole("button", { name: "Mês anterior" }));
    expect(onSelect).toHaveBeenLastCalledWith("2025-12");
    await userEvent.click(screen.getByRole("button", { name: "Próximo mês" }));
    expect(onSelect).toHaveBeenLastCalledWith("2026-02");
  });

  it("mostra o mes por extenso e 'Mês atual' so quando o selecionado nao e o corrente", async () => {
    const onSelect = vi.fn();
    const { rerender } = render(<MonthPicker month="2026-11" currentMonth="2026-10" onSelect={onSelect} />);
    expect(screen.getByRole("button", { name: "novembro de 2026" })).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Mês atual" }));
    expect(onSelect).toHaveBeenCalledWith("2026-10");
    rerender(<MonthPicker month="2026-10" currentMonth="2026-10" onSelect={onSelect} />);
    expect(screen.queryByRole("button", { name: "Mês atual" })).not.toBeInTheDocument();
  });

  it("grade de 12 meses com navegacao de ano; Esc fecha e devolve o foco ao botao", async () => {
    const onSelect = vi.fn();
    render(<MonthPicker month="2026-11" currentMonth="2026-10" onSelect={onSelect} />);
    const toggle = screen.getByRole("button", { name: "novembro de 2026" });
    await userEvent.click(toggle);
    expect(toggle).toHaveAttribute("aria-expanded", "true");
    const grid = within(screen.getByRole("group", { name: "Escolher mês" }));
    expect(grid.getAllByRole("button", { name: /de 2026$/ })).toHaveLength(12);
    await userEvent.click(grid.getByRole("button", { name: "Próximo ano" }));
    await userEvent.click(grid.getByRole("button", { name: "março de 2027" }));
    expect(onSelect).toHaveBeenCalledWith("2027-03");
    await userEvent.click(toggle);
    await userEvent.keyboard("{Escape}");
    expect(screen.queryByRole("group", { name: "Escolher mês" })).not.toBeInTheDocument();
    expect(toggle).toHaveFocus();
  });

  it("variante compacta (faixa de abas): setas + 'out/26', sem grade", () => {
    render(<MonthPicker month="2026-10" currentMonth="2026-10" onSelect={() => {}} variant="compact" />);
    expect(screen.getByText("out/26")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /de 2026/ })).not.toBeInTheDocument();
    expect(screen.getAllByRole("button")).toHaveLength(2);
  });
});
