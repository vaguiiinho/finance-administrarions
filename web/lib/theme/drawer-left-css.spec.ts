// @vitest-environment node
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

// Design 17.6: `.drawer-left` (espelho da `.drawer-right`) opaco, encostado a esquerda, 100dvh, largura min(296px, 100vw - 56px).
const css = readFileSync(resolve(__dirname, "../../app/globals.css"), "utf8").replace(/\/\*[\s\S]*?\*\//g, "");
const ruleOf = (selector: string) => {
  const m = new RegExp(`${selector.replace(/[.]/g, "\\.")}\\s*\\{([^}]*)\\}`).exec(css);
  return m?.[1] ?? "";
};

describe("globals.css: .drawer-left (design 17.6)", () => {
  const body = ruleOf(".drawer-left");
  it("existe e fica encostada a esquerda", () => {
    expect(body).not.toBe("");
    expect(body).toMatch(/left:\s*0/);
  });
  it("altura 100dvh e largura min(296px, 100vw - 56px)", () => {
    expect(body).toMatch(/height:\s*100dvh/);
    expect(body.replace(/\s+/g, " ")).toMatch(/width:\s*min\(296px,\s*100vw\s*-\s*56px\)/);
  });
  it("material opaco: --surface, nunca vidro", () => {
    expect(body).toMatch(/var\(--surface\)/);
    expect(body).not.toMatch(/glass|backdrop-filter/);
  });
  it("entra deslizando da esquerda (translateX(-24px) -> 0) e respeita prefers-reduced-motion", () => {
    expect(css).toMatch(/translateX\(-24px\)/);
    expect(css).toMatch(/prefers-reduced-motion[\s\S]*drawer-left/);
  });
});
