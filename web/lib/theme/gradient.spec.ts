// @vitest-environment node
/** Amostrador do fundo em gradiente (ADR 0003 4.4). */
import { describe, expect, it } from "vitest";
import { composite, contrastRatio, relativeLuminance, type Rgba } from "./contrast";
import { sampleGradient, samplesFromTokenColors, worstCaseRatio } from "./gradient";

const rgb = (r: number, g: number, b: number, a = 1): Rgba => ({ r, g, b, a });
const near = (x: Rgba, y: Rgba) => Math.abs(x.r - y.r) < 0.5 && Math.abs(x.g - y.g) < 0.5 && Math.abs(x.b - y.b) < 0.5;

describe("sampleGradient (ADR 0003 4.4)", () => {
  const a = rgb(0, 0, 0);
  const b = rgb(100, 200, 50);

  it("inclui as duas pontas, todas as amostras sao opacas e 2 paradas dao 17 pontos (steps = 16)", () => {
    const s = sampleGradient([a, b]);
    expect(s).toHaveLength(17);
    expect(s.some((x) => near(x, a))).toBe(true);
    expect(s.some((x) => near(x, b))).toBe(true);
    expect(s.every((x) => x.a === 1)).toBe(true);
  });

  it("interpolacao em t = 0,5 e a media sRGB das paradas", () => {
    expect(sampleGradient([a, b]).some((x) => near(x, rgb(50, 100, 25)))).toBe(true);
  });

  it("com 3 paradas inclui todas e a media de cada segmento", () => {
    const c = rgb(200, 100, 0);
    const s = sampleGradient([a, b, c]);
    for (const stop of [a, b, c]) expect(s.some((x) => near(x, stop))).toBe(true);
    expect(s.some((x) => near(x, rgb(150, 150, 25)))).toBe(true);
  });

  it("brilho: composto com alfa 0 devolve a amostra linear e com alfa 1 devolve o brilho; meio e a media", () => {
    const glow = rgb(200, 0, 100);
    const s = sampleGradient([a, b], [glow]);
    expect(s.some((x) => near(x, glow))).toBe(true);
    for (const stop of [a, b]) expect(s.some((x) => near(x, stop))).toBe(true);
    expect(s.some((x) => near(x, rgb(100, 0, 50)))).toBe(true); // 50% do brilho sobre a ponta preta
    expect(s.every((x) => x.a === 1)).toBe(true);
  });

  it("dois brilhos sobrepostos: o pior caso so aparece na composicao dupla (g2@j sobre g1@i sobre a amostra)", () => {
    const black = rgb(0, 0, 0);
    const g1 = rgb(200, 0, 0);
    const g2 = rgb(0, 200, 0);
    const fg = composite(rgb(0, 200, 0, 0.5), composite(rgb(200, 0, 0, 0.5), black)); // igual a g2@0,5 sobre g1@0,5
    const single = Math.min(worstCaseRatio(fg, sampleGradient([black], [g1])), worstCaseRatio(fg, sampleGradient([black], [g2])));
    const both = worstCaseRatio(fg, sampleGradient([black], [g1, g2]));
    expect(single).toBeGreaterThan(1.03);
    expect(both).toBeLessThan(1.01);
    expect(sampleGradient([black], [g1, g2]).every((x) => x.a === 1)).toBe(true);
  });

  it("mantem a luminancia minima interior: pode ficar abaixo das duas pontas (so as paradas nao bastam)", () => {
    const red = rgb(255, 0, 0); // L = 0,2126
    const green = rgb(0, 148, 0); // L ~ 0,2126
    const ends = Math.min(relativeLuminance(red), relativeLuminance(green));
    const interiorMin = Math.min(...sampleGradient([red, green]).map(relativeLuminance));
    expect(interiorMin).toBeLessThan(ends - 0.05);
  });
});

describe("worstCaseRatio", () => {
  it("e o minimo de contrastRatio(composite(fg, bg), bg) sobre os fundos", () => {
    const fg = rgb(0, 0, 0);
    const bgs = [rgb(255, 255, 255), rgb(128, 128, 128), rgb(60, 60, 60)];
    const expected = Math.min(...bgs.map((bg) => contrastRatio(composite(fg, bg), bg)));
    expect(worstCaseRatio(fg, bgs)).toBeCloseTo(expected, 10);
    expect(worstCaseRatio(fg, bgs)).toBeLessThan(contrastRatio(fg, bgs[0]));
  });

  it("compoe o alfa do primeiro plano sobre cada fundo", () => {
    const fg = rgb(0, 0, 0, 0.5);
    const bg = rgb(255, 255, 255);
    expect(worstCaseRatio(fg, [bg])).toBeCloseTo(contrastRatio(composite(fg, bg), bg), 10);
  });
});

describe("worstCaseRatio com lista vazia", () => {
  it("falha fechado: lanca erro em vez de aprovar tudo com Infinity", () => {
    expect(() => worstCaseRatio(rgb(0, 0, 0), [])).toThrow(/vazia/);
  });
});

describe("samplesFromTokenColors", () => {
  const colors = {
    "--bg": "rgb(10, 20, 30)",
    "--bg-stop-1": "rgb(0, 0, 0)",
    "--bg-stop-2": "rgb(100, 200, 50)",
    "--bg-glow-1": "rgb(200, 0, 0)",
  };

  it("--bg entra solto; paradas e brilhos viram o mesmo resultado de sampleGradient", () => {
    const s = samplesFromTokenColors(colors);
    const expected = [rgb(10, 20, 30), ...sampleGradient([rgb(0, 0, 0), rgb(100, 200, 50)], [rgb(200, 0, 0)])];
    expect(s).toHaveLength(expected.length);
    s.forEach((x, i) => expect(near(x, expected[i])).toBe(true));
  });

  it("ordena paradas e brilhos numericamente pelo sufixo, nao pela ordem das chaves (stop-10 depois de stop-2)", () => {
    const shuffled = {
      "--bg-glow-2": "rgb(0, 200, 0)",
      "--bg-stop-10": "rgb(200, 100, 0)",
      "--bg-stop-2": "rgb(100, 200, 50)",
      "--bg-glow-1": "rgb(200, 0, 0)",
      "--bg-stop-1": "rgb(0, 0, 0)",
    };
    const s = samplesFromTokenColors(shuffled);
    const expected = sampleGradient([rgb(0, 0, 0), rgb(100, 200, 50), rgb(200, 100, 0)], [rgb(200, 0, 0), rgb(0, 200, 0)]);
    expect(s).toHaveLength(expected.length);
    s.forEach((x, i) => expect(near(x, expected[i])).toBe(true));
  });

  it("sem paradas nem brilhos so restam as amostras soltas", () => {
    expect(samplesFromTokenColors({ "--bg": "rgb(1, 2, 3)" })).toEqual([rgb(1, 2, 3)]);
  });
});
