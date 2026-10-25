import { describe, expect, it } from "vitest";
import { composite, contrastRatio, parseColor, relativeLuminance } from "./contrast";

/**
 * CONTRATO PROPOSTO: parseColor(css) -> {r,g,b,a}; relativeLuminance(rgba); contrastRatio(fg, bg) (ambos opacos);
 * composite(fg, bg) -> cor opaca do fg (com alfa) sobre bg opaco.
 */
const c = (s: string) => parseColor(s);

describe("parseColor", () => {
  it("hex #RRGGBB e #RGB", () => {
    expect(c("#0F172A")).toEqual({ r: 15, g: 23, b: 42, a: 1 });
    expect(c("#fff")).toEqual({ r: 255, g: 255, b: 255, a: 1 });
  });
  it("rgb() com alfa separado por barra (sintaxe moderna usada nos tokens)", () => {
    expect(c("rgb(255 255 255 / 0.95)")).toEqual({ r: 255, g: 255, b: 255, a: 0.95 });
    expect(c("rgb(15 23 42 / 0.45)")).toEqual({ r: 15, g: 23, b: 42, a: 0.45 });
  });
  it("rgb() sem alfa", () => {
    expect(c("rgb(18 24 41)")).toEqual({ r: 18, g: 24, b: 41, a: 1 });
  });
  it("cor invalida lanca", () => {
    expect(() => c("azul")).toThrow();
    expect(() => c("#12")).toThrow();
  });
});

describe("relativeLuminance / contrastRatio (WCAG 2.x)", () => {
  it("preto 0, branco 1", () => {
    expect(relativeLuminance(c("#000000"))).toBeCloseTo(0, 6);
    expect(relativeLuminance(c("#ffffff"))).toBeCloseTo(1, 6);
  });
  it("preto sobre branco = 21:1; igual = 1:1; simetrico", () => {
    expect(contrastRatio(c("#000000"), c("#ffffff"))).toBeCloseTo(21, 4);
    expect(contrastRatio(c("#336699"), c("#336699"))).toBeCloseTo(1, 6);
    expect(contrastRatio(c("#0F172A"), c("#F5F7FB"))).toBeCloseTo(contrastRatio(c("#F5F7FB"), c("#0F172A")), 8);
  });
  it("valores de referencia conhecidos", () => {
    expect(contrastRatio(c("#767676"), c("#ffffff"))).toBeCloseTo(4.54, 2); // limiar classico de AA
    expect(contrastRatio(c("#777777"), c("#ffffff"))).toBeCloseTo(4.48, 2);
  });
  it("valores do design (tabela 1.9)", () => {
    expect(contrastRatio(c("#0F172A"), c("#F5F7FB"))).toBeCloseTo(16.65, 1);
    expect(contrastRatio(c("#E6EAF5"), c("#0B0F1A"))).toBeCloseTo(15.9, 1);
    expect(contrastRatio(c("#FFFFFF"), c("#4F46E5"))).toBeCloseTo(6.29, 1);
    expect(contrastRatio(c("#4F46E5"), c("#121829"))).toBeCloseTo(2.81, 1);
  });
});

describe("composite (composicao alfa)", () => {
  it("alfa 1 mantem a cor; alfa 0 devolve o fundo", () => {
    expect(composite(c("#336699"), c("#ffffff"))).toEqual({ r: 51, g: 102, b: 153, a: 1 });
    expect(composite({ r: 10, g: 20, b: 30, a: 0 }, c("#ffffff"))).toEqual({ r: 255, g: 255, b: 255, a: 1 });
  });
  it("branco 95% sobre preto = ~#F2F2F2", () => {
    const out = composite(c("rgb(255 255 255 / 0.95)"), c("#000000"));
    for (const channel of [out.r, out.g, out.b]) expect(channel).toBeCloseTo(242, 0);
    expect(out.a).toBe(1);
  });
  it("resultado e sempre opaco", () => {
    expect(composite(c("rgb(15 23 42 / 0.45)"), c("#F5F7FB")).a).toBe(1);
  });
});
