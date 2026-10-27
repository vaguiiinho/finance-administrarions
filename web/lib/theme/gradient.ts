import { composite, contrastRatio, parseColor, type Rgba } from "./contrast";

const opaque = (c: Rgba): Rgba => ({ r: c.r, g: c.g, b: c.b, a: 1 });

/**
 * Amostras do fundo em gradiente (ADR 0003 4.4): interpolacao sRGB entre paradas lineares (`steps` pontos por segmento,
 * pontas incluidas) e, para cada brilho, ele composto com alfa 0..1 sobre cada amostra linear. Todas opacas.
 *
 * Alem de cada brilho sozinho, todo par de brilhos (o de indice maior por cima) e composto sobre a mesma amostra: os
 * dois sao `circle farthest-corner` com o mesmo raio e na geometria atual (tokens.css) as areas se sobrepoem (cerca
 * de 12% da viewport 1280x800 recebe os dois), com alfa combinado de ate ~0,17.
 */
export function sampleGradient(stops: readonly Rgba[], glows: readonly Rgba[] = [], steps = 16): Rgba[] {
  const linear: Rgba[] = [];
  for (let i = 0; i < stops.length - 1; i++) {
    const [a, b] = [stops[i], stops[i + 1]];
    for (let k = i === 0 ? 0 : 1; k <= steps; k++) {
      const t = k / steps;
      linear.push({ r: a.r + (b.r - a.r) * t, g: a.g + (b.g - a.g) * t, b: a.b + (b.b - a.b) * t, a: 1 });
    }
  }
  if (stops.length === 1) linear.push(opaque(stops[0]));
  const out = [...linear];
  for (const glow of glows) {
    for (const base of linear) {
      for (let k = 0; k <= steps; k++) out.push(composite({ ...glow, a: k / steps }, base));
    }
  }
  for (let x = 0; x < glows.length; x++) {
    for (let y = x + 1; y < glows.length; y++) {
      for (const base of linear) {
        for (let i = 0; i <= steps; i++) {
          const under = composite({ ...glows[x], a: i / steps }, base);
          for (let j = 0; j <= steps; j++) out.push(composite({ ...glows[y], a: j / steps }, under));
        }
      }
    }
  }
  return out;
}

/** Menor razao de contraste de `fg` (com alfa composto sobre cada fundo) contra todos os fundos. */
export function worstCaseRatio(fg: Rgba, backgrounds: readonly Rgba[]): number {
  if (backgrounds.length === 0) throw new Error("worstCaseRatio: lista de fundos vazia (nada a verificar)");
  return Math.min(...backgrounds.map((bg) => contrastRatio(composite(fg, bg), bg)));
}

/**
 * Amostras a partir das cores computadas dos tokens do fundo: nomes com "stop" sao as paradas, "glow" os brilhos e os
 * demais (ex.: `--bg`) entram como amostras soltas.
 */
export function samplesFromTokenColors(colors: Readonly<Record<string, string>>): Rgba[] {
  const names = Object.keys(colors);
  const index = (n: string) => Number(/(\d+)\s*$/.exec(n)?.[1] ?? Number.NaN);
  const pick = (re: RegExp) =>
    names
      .filter((n) => re.test(n))
      .sort((x, y) => index(x) - index(y))
      .map((n) => parseColor(colors[n]));
  const loose = names.filter((n) => !/stop|glow/.test(n)).map((n) => parseColor(colors[n]));
  return [...loose, ...sampleGradient(pick(/stop/), pick(/glow/))];
}
