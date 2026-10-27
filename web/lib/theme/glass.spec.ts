// @vitest-environment node
import { describe, expect, it } from "vitest";
import { composite, contrastRatio, parseColor, type Rgba } from "./contrast";
import { classifyChain, compositeChain, expandUnders, separationRatio, worstOverLayers, type ChainLayer } from "./glass";

/**
 * Funcoes puras do vidro fosco (ADR 0004 4.4, plano 9.1). Sem DOM: o e2e le o navegador e injeta os dados aqui.
 * O modulo `./glass` ainda NAO existe (fase red): estes testes falham ate a T7/T8 cria-lo.
 */
const rgba = (r: number, g: number, b: number, a = 1): Rgba => ({ r, g, b, a });
const layer = (background: string, extra: Partial<ChainLayer> = {}): ChainLayer => ({ background, image: false, position: "static", ...extra });

const CLEAR = "rgba(0, 0, 0, 0)";
const GLASS = "rgba(255, 255, 255, 0.7)";
const BAR = "rgba(255, 255, 255, 0.91)";
const OPAQUE = "rgb(255, 255, 255)";

describe("classifyChain", () => {
  it("cadeia vazia ou toda transparente (alfa 0): kind 'transparent' (comportamento do ADR 0003)", () => {
    expect(classifyChain([])).toEqual({ kind: "transparent" });
    expect(classifyChain([layer(CLEAR), layer(CLEAR), layer(CLEAR)])).toEqual({ kind: "transparent" });
  });

  it("so camadas translucidas (sem sticky/fixed): 'glass' com depth = tamanho da cadeia", () => {
    expect(classifyChain([layer(GLASS), layer(CLEAR)])).toEqual({ kind: "glass", depth: 2 });
    expect(classifyChain([layer(CLEAR), layer(GLASS), layer(CLEAR), layer(CLEAR)])).toEqual({ kind: "glass", depth: 4 });
  });

  it("qualquer camada com alfa 1: 'opaque' (o axe compoe corretamente)", () => {
    expect(classifyChain([layer(CLEAR), layer(OPAQUE)])).toEqual({ kind: "opaque" });
    expect(classifyChain([layer(GLASS), layer(OPAQUE)])).toEqual({ kind: "opaque" });
  });

  it("background-image na cadeia: 'image', que vence 'opaque' (so GradientRegion resolve)", () => {
    expect(classifyChain([layer(CLEAR, { image: true })])).toEqual({ kind: "image" });
    expect(classifyChain([layer(OPAQUE), layer(CLEAR, { image: true })])).toEqual({ kind: "image" });
  });

  it("barra translucida sticky/fixed: 'bar' com depth = indice da barra na cadeia", () => {
    expect(classifyChain([layer(BAR, { position: "sticky" })])).toEqual({ kind: "bar", depth: 0 });
    expect(classifyChain([layer(CLEAR), layer(BAR, { position: "fixed" }), layer(CLEAR)])).toEqual({ kind: "bar", depth: 1 });
  });

  it("a barra no meio da cadeia corta o depth no indice dela: o que fica abaixo (ex.: card que contem um th sticky) nao entra", () => {
    // texto -> th sticky (barra, indice 1) -> card de vidro (indice 2): so ate a barra fica na frente do conteudo sob a barra
    const chain = [layer(CLEAR), layer(BAR, { position: "sticky" }), layer(GLASS)];
    expect(classifyChain(chain)).toEqual({ kind: "bar", depth: 1 });
  });

  it("sticky/fixed com fundo transparente (alfa 0) nao e barra: segue transparent/glass", () => {
    expect(classifyChain([layer(CLEAR, { position: "sticky" })])).toEqual({ kind: "transparent" });
    expect(classifyChain([layer(CLEAR, { position: "sticky" }), layer(GLASS)])).toEqual({ kind: "glass", depth: 2 });
  });

  it("sticky/fixed com fundo opaco continua 'opaque'", () => {
    expect(classifyChain([layer(OPAQUE, { position: "sticky" })])).toEqual({ kind: "opaque" });
  });
});

describe("expandUnders", () => {
  const samples = [rgba(236, 238, 252), rgba(228, 240, 254), rgba(240, 236, 252)];

  it("cor opaca entra como esta (1 fundo por cor)", () => {
    const out = expandUnders({ "--surface": rgba(255, 255, 255), "--text": rgba(30, 41, 59) }, samples);
    expect(out).toHaveLength(2);
    expect(out).toContainEqual(rgba(255, 255, 255));
    expect(out).toContainEqual(rgba(30, 41, 59));
  });

  it("cor translucida e composta sobre CADA amostra (cardinalidade = numero de amostras)", () => {
    const glass = rgba(255, 255, 255, 0.7);
    const out = expandUnders({ "--glass-bg": glass }, samples);
    expect(out).toHaveLength(samples.length);
    for (const s of samples) {
      const expected = composite(glass, s);
      expect(out.some((o) => Math.abs(o.r - expected.r) < 1e-6 && Math.abs(o.g - expected.g) < 1e-6 && Math.abs(o.b - expected.b) < 1e-6), `sem composicao sobre ${s.r},${s.g},${s.b}`).toBe(true);
    }
  });

  it("mistura: opacas + translucidas somam 1 por opaca e N por translucida", () => {
    const out = expandUnders({ a: rgba(0, 0, 0), b: rgba(255, 255, 255, 0.5), c: rgba(10, 10, 10, 0.9) }, samples);
    expect(out).toHaveLength(1 + 2 * samples.length);
  });

  it("alfa 0 devolve as proprias amostras", () => {
    const out = expandUnders({ x: rgba(255, 0, 0, 0) }, samples);
    expect(out).toHaveLength(samples.length);
    for (const s of samples) expect(out.some((o) => o.r === s.r && o.g === s.g && o.b === s.b)).toBe(true);
  });

  it("falha fechada: lista de cores vazia, ou translucida sem amostras, lanca erro", () => {
    expect(() => expandUnders({}, samples)).toThrow();
    expect(() => expandUnders({ g: rgba(255, 255, 255, 0.7) }, [])).toThrow();
  });
});

describe("worstOverLayers", () => {
  const dark = parseColor("rgb(30, 41, 59)");
  const unders = [rgba(236, 238, 252), rgba(255, 255, 255), rgba(0, 0, 0)];

  it("com uma camada opaca coincide com a razao simples (os fundos nao importam)", () => {
    const layerColor = "rgb(255, 255, 255)";
    expect(worstOverLayers(dark, [layerColor], unders)).toBeCloseTo(contrastRatio(dark, rgba(255, 255, 255)), 6);
  });

  it("sem camadas, e o pior caso do texto contra os proprios fundos", () => {
    const expected = Math.min(...unders.map((u) => contrastRatio(dark, u)));
    expect(worstOverLayers(dark, [], unders)).toBeCloseTo(expected, 6);
  });

  it("camada translucida: compoe sobre cada fundo e devolve o MENOR razao", () => {
    const glass = "rgba(255, 255, 255, 0.7)";
    const expected = Math.min(...unders.map((u) => contrastRatio(dark, composite(parseColor(glass), u))));
    expect(worstOverLayers(dark, [glass], unders)).toBeCloseTo(expected, 6);
  });

  it("texto com alfa e composto sobre o fundo efetivo antes da razao", () => {
    const fg = rgba(30, 41, 59, 0.5);
    const bg = rgba(255, 255, 255);
    const expected = contrastRatio(composite(fg, bg), bg);
    expect(worstOverLayers(fg, ["rgb(255, 255, 255)"], [rgba(0, 0, 0)])).toBeCloseTo(expected, 6);
  });

  it("compor so ate a barra e MAIS pessimista que compor a cadeia inteira (prova de que o corte de depth e necessario)", () => {
    const barOnly = ["rgba(255, 255, 255, 0.91)"];
    const wholeChain = ["rgba(255, 255, 255, 0.91)", "rgba(255, 255, 255, 0.7)"]; // barra por cima de um card de vidro
    const under = [rgba(30, 41, 59)]; // conteudo escuro rolando por baixo
    expect(worstOverLayers(dark, barOnly, under)).toBeLessThan(worstOverLayers(dark, wholeChain, under));
  });

  it("falha fechada: lista de fundos vazia lanca erro", () => {
    expect(() => worstOverLayers(dark, [GLASS], [])).toThrow();
  });
});

describe("separationRatio", () => {
  const samples = [rgba(236, 238, 252), rgba(240, 236, 252), rgba(228, 240, 254)];

  it("vidro com alfa 0 nao separa: razao 1", () => {
    expect(separationRatio(rgba(255, 255, 255, 0), samples)).toBeCloseTo(1, 6);
  });

  it("vidro com alfa 1 e a razao simples contra a amostra mais proxima", () => {
    const white = rgba(255, 255, 255);
    expect(separationRatio(white, samples)).toBeCloseTo(Math.min(...samples.map((s) => contrastRatio(white, s))), 6);
  });

  it("alfa intermediario: menor razao entre a composicao e a amostra", () => {
    const glass = rgba(255, 255, 255, 0.7);
    const expected = Math.min(...samples.map((s) => contrastRatio(composite(glass, s), s)));
    expect(separationRatio(glass, samples)).toBeCloseTo(expected, 6);
    expect(separationRatio(glass, samples)).toBeGreaterThan(1);
  });

  it("falha fechada: sem amostras lanca erro", () => {
    expect(() => separationRatio(rgba(255, 255, 255, 0.7), [])).toThrow();
  });
});

describe("compositeChain", () => {
  it("cadeia vazia devolve o fundo opaco", () => {
    expect(compositeChain([], rgba(10, 20, 30))).toEqual(rgba(10, 20, 30));
  });

  it("compoe de fora para dentro: a camada mais interna fica por cima", () => {
    const under = rgba(0, 0, 0);
    const outer = "rgba(255, 255, 255, 0.5)";
    const inner = "rgba(255, 0, 0, 0.5)";
    const expected = composite(parseColor(inner), composite(parseColor(outer), under));
    expect(compositeChain([inner, outer], under)).toEqual(expected);
  });

  it("camada opaca esconde o fundo", () => {
    expect(compositeChain(["rgb(1, 2, 3)"], rgba(200, 200, 200))).toEqual(rgba(1, 2, 3));
  });
});
