import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { UserAvatar } from "./user-avatar";

describe("UserAvatar (design 2.3, CA45)", () => {
  it("mostra a inicial do nome normalizado e e aria-hidden", () => {
    const { container } = render(<UserAvatar name="  álvaro lima" />);
    expect(container.textContent).toBe("Á");
    expect((container.firstElementChild as HTMLElement).getAttribute("aria-hidden")).toBe("true");
  });
  it.each([
    ["md", /(^|\s)(size-11|h-11|w-11)|44/],
    ["lg", /(^|\s)(size-12|h-12|w-12)|48/],
  ] as const)("tamanho %s", (size, re) => {
    const { container } = render(<UserAvatar name="Ana" size={size} />);
    const el = container.firstElementChild as HTMLElement;
    expect(`${el.className} ${el.getAttribute("style") ?? ""}`).toMatch(re);
  });
  it("emoji aparece como veio", () => {
    const { container } = render(<UserAvatar name="😀 Carla" />);
    expect(container.textContent).toBe("😀");
  });
});
