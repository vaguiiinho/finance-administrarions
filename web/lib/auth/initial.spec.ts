import { describe, expect, it } from "vitest";
import { userInitial } from "./initial";

describe("userInitial (CA45, RF40, ADR 9.7)", () => {
  it.each([
    ["Ana Souza", "A"],
    ["ana lima", "A"],
    ["  álvaro lima", "Á"],
    ["\t  bruno", "B"],
    ["çaça", "Ç"],
    ["ìtalo", "Ì"],
  ])("%j -> %j", (name, initial) => {
    expect(userInitial(name)).toBe(initial);
  });

  it("emoji e digito aparecem como vierem (primeiro grafema, P05)", () => {
    expect(userInitial("😀 Carla")).toBe("😀");
    expect(userInitial("1o Usuario")).toBe("1");
  });

  it("grafema composto (bandeira, familia, letra + combinante) nao e cortado ao meio", () => {
    expect(userInitial("🇧🇷 Brasil")).toBe("🇧🇷");
    expect(userInitial("👨‍👩‍👧 Familia")).toBe("👨‍👩‍👧");
    expect(userInitial("álvaro")).toBe("Á");
  });

  it("nome so com espacos nao quebra", () => {
    expect(() => userInitial("   ")).not.toThrow();
    expect(userInitial("   ")).toBe("");
  });
});
