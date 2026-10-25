import { describe, expect, it } from "vitest";
import { THEME_COOKIE, parseTheme, resolveEffectiveTheme, themeCookieString } from "./theme";

describe("lib/theme (CA79-CA81)", () => {
  it("o cookie se chama 'theme'", () => {
    expect(THEME_COOKIE).toBe("theme");
  });

  it.each([
    ["light", "light"],
    ["dark", "dark"],
    ["LIGHT", undefined],
    ["", undefined],
    ["system", undefined],
    ["escuro", undefined],
    [undefined, undefined],
    [null, undefined],
  ])("parseTheme(%j) -> %s (valor invalido = ausente)", (input, expected) => {
    expect(parseTheme(input as string | undefined)).toBe(expected);
  });

  it("themeCookieString: Path=/, Max-Age de 1 ano, SameSite=Lax, sem HttpOnly", () => {
    const cookie = themeCookieString("dark");
    expect(cookie).toContain("theme=dark");
    expect(cookie).toContain("Path=/");
    expect(cookie).toContain("Max-Age=31536000");
    expect(cookie).toContain("SameSite=Lax");
    expect(cookie).not.toMatch(/HttpOnly/i);
    expect(cookie).not.toMatch(/Secure/i);
  });

  it("themeCookieString inclui Secure em HTTPS", () => {
    expect(themeCookieString("light", { secure: true })).toMatch(/; Secure/);
  });

  it("resolveEffectiveTheme: a preferencia vence o sistema; sem preferencia segue o sistema (CA79/CA80)", () => {
    expect(resolveEffectiveTheme("light", true)).toBe("light");
    expect(resolveEffectiveTheme("dark", false)).toBe("dark");
    expect(resolveEffectiveTheme(undefined, true)).toBe("dark");
    expect(resolveEffectiveTheme(undefined, false)).toBe("light");
  });
});
