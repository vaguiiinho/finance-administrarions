import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { clearFlash, setFlash, takeFlash } from "./flash";

beforeEach(() => window.sessionStorage.clear());
afterEach(() => vi.useRealTimers());

describe("flash (aviso entre telas, design 4.4)", () => {
  it("guarda e entrega uma vez so", () => {
    setFlash("Senha alterada.");
    expect(takeFlash()).toBe("Senha alterada.");
    expect(takeFlash()).toBeNull();
  });
  it("clearFlash descarta o aviso pendente", () => {
    setFlash("x");
    clearFlash();
    expect(takeFlash()).toBeNull();
  });
  it("aviso antigo (mais de 15 s) nao aparece em outra navegacao", () => {
    vi.useFakeTimers({ now: new Date("2026-11-02T12:00:00Z") });
    setFlash("velho");
    vi.setSystemTime(new Date("2026-11-02T12:00:16Z"));
    expect(takeFlash()).toBeNull();
  });
  it("sessionStorage indisponivel ou corrompido nao quebra", () => {
    window.sessionStorage.setItem("fa_flash", "{nao-e-json");
    expect(takeFlash()).toBeNull();
    const spy = vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new Error("cheio");
    });
    expect(() => setFlash("x")).not.toThrow();
    spy.mockRestore();
  });
});
