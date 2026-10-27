import { composite, contrastRatio, parseColor, type Rgba } from "./contrast";

/**
 * Funcoes puras do vidro fosco (ADR 0004 4.4). Sem DOM, React ou Next: o e2e le o navegador e injeta os dados aqui.
 */

/** Uma camada da cadeia de ancestrais de um texto, do elemento para fora. */
export interface ChainLayer {
  /** background-color computado (rgb/rgba) */
  background: string;
  /** algum background-image */
  image: boolean;
  /** position computada: "sticky" | "fixed" identificam barras */
  position: string;
}

/** Classificacao da cadeia para decidir quem audita o contraste (axe, pior caso do gradiente ou pior caso de vidro). */
export type ChainClass =
  | { kind: "transparent" }
  | { kind: "glass"; depth: number }
  | { kind: "bar"; depth: number }
  | { kind: "opaque" }
  | { kind: "image" };

export function classifyChain(chain: readonly ChainLayer[]): ChainClass {
  if (chain.some((l) => l.image)) return { kind: "image" };
  const alphas = chain.map((l) => parseColor(l.background).a);
  if (alphas.some((a) => a >= 1)) return { kind: "opaque" };
  if (alphas.every((a) => a === 0)) return { kind: "transparent" };
  const bar = chain.findIndex((l, i) => alphas[i] > 0 && (l.position === "sticky" || l.position === "fixed"));
  if (bar !== -1) return { kind: "bar", depth: bar };
  return { kind: "glass", depth: chain.length };
}

/** Opaco entra como esta; translucido e composto sobre CADA amostra. Falha fechada com entradas vazias. */
export function expandUnders(colors: Readonly<Record<string, Rgba>>, pageSamples: readonly Rgba[]): Rgba[] {
  const entries = Object.values(colors);
  if (entries.length === 0) throw new Error("expandUnders: nenhuma cor (nada a verificar)");
  return entries.flatMap((c) => {
    if (c.a >= 1) return [c];
    if (pageSamples.length === 0) throw new Error("expandUnders: cor translucida sem amostras do fundo");
    return pageSamples.map((s) => composite(c, s));
  });
}

/** Compoe a cadeia de `background-color` (mais interna primeiro) sobre um fundo opaco `under`; o resultado e opaco. */
export function compositeChain(layersInnerFirst: readonly string[], under: Rgba): Rgba {
  let bg: Rgba = { ...under, a: 1 };
  for (let i = layersInnerFirst.length - 1; i >= 0; i--) bg = composite(parseColor(layersInnerFirst[i]), bg);
  return bg;
}

/** Pior razao de `fg` sobre as camadas (mais interna primeiro) compostas sobre cada fundo possivel. */
export function worstOverLayers(fg: Rgba, layersInnerFirst: readonly string[], unders: readonly Rgba[]): number {
  if (unders.length === 0) throw new Error("worstOverLayers: fundos (amostras) vazias, nada a verificar");
  let worst = Infinity;
  for (const under of unders) {
    const bg = compositeChain(layersInnerFirst, under);
    const ratio = contrastRatio(composite(fg, bg), bg);
    if (ratio < worst) worst = ratio;
  }
  return worst;
}

/** Menor razao entre o vidro composto e a propria amostra (G10). */
export function separationRatio(glass: Rgba, samples: readonly Rgba[]): number {
  if (samples.length === 0) throw new Error("separationRatio: amostras vazias (nada a verificar)");
  let worst = Infinity;
  for (const s of samples) {
    const ratio = contrastRatio(composite(glass, s), s);
    if (ratio < worst) worst = ratio;
  }
  return worst;
}
