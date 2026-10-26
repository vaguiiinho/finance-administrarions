import { describe, expect, it } from "vitest";
import { evaluateButton, incompleteVerdict, resolveBackground, type ButtonStyleSnapshot, type TextContrastResult } from "./contrast";

/** Testes do helper de contraste do Playwright (ADR 0002 T2): matematica pura, sem navegador. */
const base: ButtonStyleSnapshot = {
  label: "Salvar",
  color: "rgb(255, 255, 255)",
  ownBackgrounds: ["rgb(29, 78, 216)", "rgba(0, 0, 0, 0)"],
  surroundBackgrounds: ["rgba(0, 0, 0, 0)", "rgb(255, 255, 255)"],
  borderWidth: 1,
  borderColor: "rgb(30, 64, 175)",
  outlineStyle: "none",
  outlineWidth: 0,
  outlineColor: "rgb(0, 0, 0)",
  textDecorationLine: "none",
};

describe("resolveBackground", () => {
  it("transparente sobe ate o primeiro ancestral opaco", () => {
    expect(resolveBackground(["rgba(0, 0, 0, 0)", "rgb(10, 20, 30)", "rgb(255, 255, 255)"])).toEqual({ r: 10, g: 20, b: 30, a: 1 });
  });
  it("compoe o alfa sobre o fundo de baixo (50% preto sobre branco = cinza medio)", () => {
    const bg = resolveBackground(["rgba(0, 0, 0, 0.5)", "rgb(255, 255, 255)"]);
    expect(bg.r).toBeCloseTo(127.5, 1);
    expect(bg.a).toBe(1);
  });
  it("cadeia vazia ou toda transparente cai no fundo de reserva (branco)", () => {
    expect(resolveBackground([])).toEqual({ r: 255, g: 255, b: 255, a: 1 });
    expect(resolveBackground(["rgba(0, 0, 0, 0)"], { r: 11, g: 15, b: 26, a: 1 })).toEqual({ r: 11, g: 15, b: 26, a: 1 });
  });
});

describe("evaluateButton", () => {
  it("botao primario legivel passa", () => {
    expect(evaluateButton(base, { state: "default" })).toEqual([]);
  });
  it("texto fraco (cinza claro sobre branco) reprova com a razao no relatorio", () => {
    const problems = evaluateButton({ ...base, color: "rgb(200, 200, 200)", ownBackgrounds: ["rgb(255, 255, 255)"] }, { state: "default" });
    expect(problems.some((p) => /texto .*:1 < 4.5:1/.test(p))).toBe(true);
  });
  it("desabilitado aceita >= 3:1 no texto, mas reprova abaixo disso", () => {
    const grey = { ...base, ownBackgrounds: ["rgb(255, 255, 255)"], color: "rgb(140, 140, 140)", borderWidth: 0 };
    expect(evaluateButton(grey, { state: "default" })).not.toEqual([]); // 3,4:1 nao basta para texto ativo
    expect(evaluateButton(grey, { state: "disabled" })).toEqual([]);
    expect(evaluateButton({ ...grey, color: "rgb(200, 200, 200)" }, { state: "disabled" })).not.toEqual([]);
  });
  it("borda quase igual ao fundo ao redor reprova (>= 3:1)", () => {
    const problems = evaluateButton({ ...base, borderColor: "rgb(250, 250, 250)", ownBackgrounds: ["rgb(255, 255, 255)"], color: "rgb(0, 0, 0)" }, { state: "default" });
    expect(problems.some((p) => p.includes("borda"))).toBe(true);
  });
  it("borda transparente ou de largura 0 nao e avaliada (terciario e icone)", () => {
    expect(evaluateButton({ ...base, borderColor: "rgba(0, 0, 0, 0)" }, { state: "default" })).toEqual([]);
    expect(evaluateButton({ ...base, borderWidth: 0, borderColor: "rgb(255, 255, 255)" }, { state: "default" })).toEqual([]);
  });
  it("foco: exige anel >= 2px e >= 3:1 contra o fundo ao redor", () => {
    expect(evaluateButton(base, { state: "focus-visible" }).some((p) => p.includes("anel de foco ausente"))).toBe(true);
    const thin = { ...base, outlineStyle: "solid", outlineWidth: 1, outlineColor: "rgb(0, 0, 0)" };
    expect(evaluateButton(thin, { state: "focus-visible" }).some((p) => p.includes("< 2px"))).toBe(true);
    const faint = { ...base, outlineStyle: "solid", outlineWidth: 2, outlineColor: "rgb(240, 240, 240)" };
    expect(evaluateButton(faint, { state: "focus-visible" }).some((p) => p.includes("anel de foco") && p.includes(":1"))).toBe(true);
    const good = { ...base, outlineStyle: "solid", outlineWidth: 2, outlineColor: "rgb(29, 78, 216)" };
    expect(evaluateButton(good, { state: "focus-visible" })).toEqual([]);
  });
  it("desabilitado focado: texto continua avaliado a 3:1, mas o anel de foco e exigido", () => {
    const grey = { ...base, ownBackgrounds: ["rgb(255, 255, 255)"], color: "rgb(140, 140, 140)", borderWidth: 0 };
    expect(evaluateButton(grey, { state: "focus-visible", disabled: true }).some((p) => p.includes("texto"))).toBe(false);
    expect(evaluateButton(grey, { state: "focus-visible", disabled: true }).some((p) => p.includes("anel de foco ausente"))).toBe(true);
  });
  it("terciario no hover precisa de sublinhado", () => {
    expect(evaluateButton(base, { state: "hover", expectUnderlineOnHover: true }).some((p) => p.includes("sublinhado"))).toBe(true);
    expect(evaluateButton({ ...base, textDecorationLine: "underline" }, { state: "hover", expectUnderlineOnHover: true })).toEqual([]);
  });
});

describe("incompleteVerdict (resolucao restrita dos 'incomplete' do axe)", () => {
  const ok: TextContrastResult = { ratio: 7, large: false, required: 4.5, ok: true, text: "Jan", opacity: 1, backgroundImage: false, covered: false, coveredByOverlay: false };
  it("resolve imgNode e elmPartiallyObscured/Obscuring quando o contraste passa e nada invalida o calculo", () => {
    for (const key of ["imgNode", "elmPartiallyObscured", "elmPartiallyObscuring"]) expect(incompleteVerdict(key, ok)).toBeNull();
  });
  it("messageKey desconhecido ou ausente nunca e resolvido", () => {
    for (const key of ["bgImage", "bgOverlap", "fgAlpha", "pseudoContent", undefined]) expect(incompleteVerdict(key, ok)).toMatch(/nao e resolvivel/);
  });
  it("opacidade efetiva < 1, background-image e sobreposicao real falham mesmo com razao alta", () => {
    expect(incompleteVerdict("imgNode", { ...ok, opacity: 0.6 })).toMatch(/opacidade/);
    expect(incompleteVerdict("imgNode", { ...ok, backgroundImage: true })).toMatch(/background-image/);
    expect(incompleteVerdict("elmPartiallyObscured", { ...ok, covered: true })).toMatch(/sobreposicao/);
  });
  it("bgOverlap so e aceito quando o no esta sob um overlay declarado pela tela", () => {
    expect(incompleteVerdict("bgOverlap", ok)).toMatch(/nao e resolvivel/);
    expect(incompleteVerdict("bgOverlap", { ...ok, coveredByOverlay: true })).toBeNull();
  });
  it("razao abaixo do limite falha com a razao no texto", () => {
    expect(incompleteVerdict("imgNode", { ...ok, ratio: 3.2, ok: false })).toBe("3.20:1 < 4.5:1");
  });
});
