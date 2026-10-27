// @vitest-environment node
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { composite, contrastRatio, parseColor, relativeLuminance, type Rgba } from "./contrast";
import { CONTRAST_PAIRS, DECORATIVE_PAIRS, PAGE_BACKGROUND_TOKENS } from "./contrast-pairs";

/**
 * Verificacao de contraste em duas camadas (ADR 9.5, T16) - camada 1 (tokens).
 * O parser de tokens e a matriz de pares OBRIGATORIOS abaixo sao do TESTE (independentes da implementacao):
 * a implementacao (lib/theme/contrast.ts + contrast-pairs.ts) e tokens.css precisam satisfaze-los.
 */
const TOKENS_PATH = resolve(__dirname, "../../app/styles/tokens.css");
const css = readFileSync(TOKENS_PATH, "utf8");

type Theme = "light" | "dark";
const THEMES: Theme[] = ["light", "dark"];

function splitTopLevel(args: string): string[] {
  const parts: string[] = [];
  let depth = 0;
  let current = "";
  for (const ch of args) {
    if (ch === "(") depth++;
    if (ch === ")") depth--;
    if (ch === "," && depth === 0) {
      parts.push(current.trim());
      current = "";
    } else current += ch;
  }
  parts.push(current.trim());
  return parts;
}

function parseTokens(source: string): Record<string, { light: string; dark: string }> {
  const out: Record<string, { light: string; dark: string }> = {};
  for (const m of source.matchAll(/(--[a-z0-9-]+)\s*:\s*light-dark\(([^;]*)\)\s*;/gi)) {
    const [light, dark] = splitTopLevel(m[2]);
    if (out[m[1]]) throw new Error(`token ${m[1]} declarado mais de uma vez`);
    out[m[1]] = { light, dark };
  }
  return out;
}

const tokens = parseTokens(css);
const norm = (v: string) => v.replace(/\s+/g, " ").toLowerCase();
const color = (name: string, theme: Theme) => {
  const t = tokens[name];
  if (!t) throw new Error(`token ${name} ausente em tokens.css`);
  return parseColor(t[theme]);
};

// ---------------------------------------------------------------------------
// Valores do design: rev. 5 (secao 1.2) + fundo em gradiente da rev. 6 (design rev. 6, docs/design/fundo-gradiente-temas.md): [token, claro, escuro]
// ---------------------------------------------------------------------------
const EXPECTED_VALUES: [string, string, string][] = [
  ["--bg", "#ECEEFC", "#181E2A"],
  ["--bg-stop-1", "#EEEEFE", "#141A24"],
  ["--bg-stop-2", "#E8F0FC", "#181E2A"],
  ["--bg-stop-3", "#F0ECFC", "#12182A"],
  ["--bg-glow-1", "#E4F0FE", "#0C3044"],
  ["--bg-glow-2", "#F4ECFE", "#20244D"],
  ["--surface", "#FFFFFF", "#1C2330"],
  ["--surface-2", "#F4F6F9", "#252D3C"],
  ["--surface-active", "#E4E8EE", "#303A4C"],
  ["--input-bg", "#FFFFFF", "#151B26"],
  ["--header-bg", "rgb(255 255 255 / 0.95)", "rgb(28 35 48 / 0.95)"],
  ["--border", "#D9DEE6", "#2E3747"],
  ["--border-strong", "#6F798C", "#7A8497"],
  ["--text", "#1E293B", "#E3E7EE"],
  ["--text-muted", "#4B5567", "#9BA5B7"],
  ["--text-disabled", "#6F798C", "#7A8497"],
  ["--skeleton", "#E4E8EE", "#303A4C"],
  ["--scrim", "rgb(15 23 42 / 0.45)", "rgb(8 11 17 / 0.72)"],
  ["--shadow-color", "rgb(15 23 42 / 0.06)", "rgb(0 0 0 / 0.3)"],
  ["--primary", "#6366F1", "#6366F1"],
  ["--primary-strong", "#4F46E5", "#4F46E5"],
  ["--primary-strong-hover", "#4338CA", "#4338CA"],
  ["--primary-strong-active", "#3730A3", "#3730A3"],
  ["--primary-border", "#4F46E5", "#818CF8"],
  ["--on-primary", "#FFFFFF", "#FFFFFF"],
  ["--accent", "#0E7490", "#5CC8DB"],
  ["--accent-active", "#0C6980", "#5CC8DB"],
  ["--focus-color", "#0E7490", "#5CC8DB"],
  ["--success", "#059669", "#34D399"],
  ["--success-text", "#047857", "#34D399"],
  ["--warning", "#B45309", "#FBBF24"],
  ["--warning-text", "#92400E", "#FBBF24"],
  ["--danger", "#DC2626", "#F87171"],
  ["--danger-text", "#B91C1C", "#F87171"],
  ["--income", "#1D4ED8", "#60A5FA"],
  ["--expense", "#BE123C", "#FB7185"],
  ["--chart-income", "#1D4ED8", "#60A5FA"],
  ["--chart-paid", "#059669", "#34D399"],
  ["--chart-pending", "#B45309", "#FBBF24"],
  ["--chart-balance-realized", "#6D28D9", "#A78BFA"],
  ["--chart-balance-projected", "#BE185D", "#F472B6"],
  ["--chart-axis", "#4B5567", "#9BA5B7"],
  ["--chart-grid", "#D9DEE6", "#343E51"],
  ["--chart-zero-line", "#4B5567", "#9BA5B7"],
  ["--chart-cursor", "#EEF1F5", "#252D3C"],
  ["--chart-1", "#0E7490", "#5CC8DB"],
  ["--chart-2", "#4F46E5", "#818CF8"],
  ["--chart-3", "#BE185D", "#F472B6"],
  ["--chart-4", "#4D7C0F", "#A3E635"],
  ["--chart-5", "#C2410C", "#FB923C"],
  ["--chart-6", "#64748B", "#9BA5B7"],
  ["--tooltip-bg", "#FFFFFF", "#252D3C"],
  ["--tooltip-border", "#6F798C", "#7A8497"],
  ["--scrollbar-thumb", "#6F798C", "#7A8497"],
  ["--scrollbar-track", "#F4F6F9", "#252D3C"],
];

const MIN: Record<string, number> = { text: 4.5, "large-text": 3, "non-text": 3, disabled: 3 };

interface Required {
  fg: string;
  bg: string;
  kind: "text" | "non-text" | "disabled";
  /** razoes minimas do design (arredondadas para baixo): [claro, escuro]; undefined = so o minimo da categoria */
  expected?: [number, number];
  over?: string[];
}

// Navbar translucida: o fundo efetivo e QUALQUER amostra do fundo da pagina (ratioOf expande "--bg"), --surface, --surface-2 ou --text.
const HEADER_UNDER = ["--bg", "--surface", "--surface-2", "--text"];
const P = (fg: string, bg: string, kind: Required["kind"], expected?: [number, number], over?: string[]): Required => ({ fg, bg, kind, expected, over });

// Pares obrigatorios: ADR 9.5 (tokens novos) + design 1.9 (texto, desabilitado, componentes, graficos).
const REQUIRED: Required[] = [
  P("--text", "--bg", "text", [12.61, 11.12]),
  P("--text", "--surface", "text", [14.62, 12.7]),
  P("--text", "--surface-2", "text", [13.51, 11.14]),
  P("--text", "--surface-active", "text", [11.89, 9.22]),
  P("--text", "--input-bg", "text", [14.62, 13.91]),
  P("--text-muted", "--bg", "text", [6.48, 5.55]),
  P("--text-muted", "--surface", "text", [7.51, 6.34]),
  P("--text-muted", "--surface-2", "text", [6.94, 5.56]),
  P("--text-muted", "--surface-active", "text", [6.11, 4.6]),
  P("--text-muted", "--input-bg", "text", [7.51, 6.95]),
  P("--accent", "--surface", "text", [5.35, 8.05]),
  P("--accent", "--bg", "text", [4.62, 7.05]),
  P("--accent", "--surface-2", "text", [4.94, 7.06]),
  P("--accent-active", "--surface-active", "text", [5.1, 5.85]),
  P("--on-primary", "--primary-strong", "text", [6.28, 6.28]),
  P("--on-primary", "--primary-strong-hover", "text", [7.9, 7.9]),
  P("--on-primary", "--primary-strong-active", "text", [9.93, 9.93]),
  P("--success-text", "--surface", "text", [5.48, 8.19]),
  P("--success-text", "--surface-2", "text", [5.06, 7.19]),
  P("--warning-text", "--surface", "text", [7.09, 9.44]),
  P("--warning-text", "--surface-2", "text", [6.54, 8.28]),
  P("--danger-text", "--surface", "text", [6.47, 5.69]),
  P("--danger-text", "--surface-2", "text", [5.97, 4.99]),
  P("--danger-text", "--bg", "text", [5.57, 4.98]),
  P("--income", "--surface", "text", [6.7, 6.19]),
  P("--income", "--surface-2", "text", [6.19, 5.43]),
  P("--expense", "--surface", "text", [6.28, 5.85]),
  P("--expense", "--surface-2", "text", [5.8, 5.13]),
  P("--text", "--tooltip-bg", "text", [14.62, 11.14]),
  P("--text-muted", "--tooltip-bg", "text", [7.51, 5.56]),
  P("--chart-axis", "--surface", "text", [7.51, 6.34]),
  // navbar com fundo translucido: contraste no PIOR caso composto
  P("--text", "--header-bg", "text", [13.32, 11.17], HEADER_UNDER),
  P("--text-muted", "--header-bg", "text", [6.84, 5.58], HEADER_UNDER),
  P("--accent", "--header-bg", "text", [4.88, 7.09], HEADER_UNDER),
  P("--focus-color", "--header-bg", "non-text", undefined, HEADER_UNDER),
  // desabilitado
  P("--text-disabled", "--surface-2", "disabled", [4.04, 3.66]),
  P("--text-disabled", "--surface", "disabled", [4.38, 4.18]),
  P("--text-disabled", "--bg", "disabled", [3.78, 3.66]),
  // bordas de controles, foco, estado
  P("--border-strong", "--surface", "non-text", [4.38, 4.18]),
  P("--border-strong", "--bg", "non-text", [3.78, 3.66]),
  P("--border-strong", "--surface-2", "non-text", [4.04, 3.66]),
  P("--border-strong", "--surface-active", "non-text", [3.56, 3.03]),
  P("--border-strong", "--input-bg", "non-text"),
  P("--primary-border", "--surface", "non-text", [6.28, 5.28]),
  P("--primary-border", "--bg", "non-text", [5.42, 4.62]),
  P("--primary-border", "--surface-2", "non-text", [5.8, 4.63]),
  P("--focus-color", "--surface", "non-text", [5.35, 8.05]),
  P("--focus-color", "--bg", "non-text", [4.62, 7.05]),
  P("--focus-color", "--surface-2", "non-text", [4.94, 7.06]),
  P("--focus-color", "--input-bg", "non-text"),
  P("--danger", "--input-bg", "non-text", [4.82, 6.23]),
  P("--danger", "--surface", "non-text", [4.82, 5.69]),
  P("--danger", "--surface-2", "non-text", [4.46, 4.99]),
  P("--success", "--surface", "non-text", [3.76, 8.19]),
  P("--success", "--surface-2", "non-text", [3.48, 7.19]),
  P("--warning", "--surface", "non-text", [5.02, 9.44]),
  P("--warning", "--surface-2", "non-text", [4.63, 8.28]),
  P("--tooltip-border", "--surface", "non-text", [4.38, 4.18]),
  P("--scrollbar-thumb", "--scrollbar-track", "non-text", [4.04, 3.66]),
  // graficos
  P("--chart-income", "--surface", "non-text", [6.7, 6.19]),
  P("--chart-paid", "--surface", "non-text", [3.76, 8.19]),
  P("--chart-pending", "--surface", "non-text", [5.02, 9.44]),
  P("--chart-balance-realized", "--surface", "non-text", [7.1, 5.79]),
  P("--chart-balance-projected", "--surface", "non-text", [6.03, 5.95]),
  P("--chart-zero-line", "--surface", "non-text", [7.51, 6.34]),
  ...[1, 2, 3, 4, 5, 6].map((n, i) =>
    P(`--chart-${n}`, "--surface", "non-text", [[5.35, 6.28, 6.03, 4.99, 5.17, 4.75][i], [8.05, 5.28, 5.95, 10.45, 6.96, 6.34][i]]),
  ),
  P("--chart-income", "--tooltip-bg", "non-text", [6.7, 5.43]),
  P("--chart-paid", "--tooltip-bg", "non-text", [3.76, 7.19]),
  P("--chart-pending", "--tooltip-bg", "non-text", [5.02, 8.28]),
  P("--chart-balance-realized", "--tooltip-bg", "non-text", [7.1, 5.07]),
  P("--chart-balance-projected", "--tooltip-bg", "non-text", [6.03, 5.21]),
];

// ---------------------------------------------------------------------------
// Fundo em gradiente (ADR 0003 5.5): amostrador PROPRIO do teste (independente de lib/theme/gradient.ts).
// ---------------------------------------------------------------------------
const STEPS = 16;
const stopNames = Object.keys(tokens).filter((t) => /^--bg-stop-\d+$/.test(t)).sort();
const glowNames = Object.keys(tokens).filter((t) => /^--bg-glow-\d+$/.test(t)).sort();
const PAGE_SET = new Set(["--bg", ...stopNames, ...glowNames]);

/** Paradas, interpolacoes sRGB (17 pontos por segmento) e cada brilho composto em 17 opacidades sobre cada amostra linear; mais a cor base. */
function pageSamples(theme: Theme): Rgba[] {
  const stops = stopNames.map((n) => color(n, theme));
  const glows = glowNames.map((n) => color(n, theme));
  const linear: Rgba[] = [];
  for (let i = 0; i < stops.length - 1; i++) {
    const [a, b] = [stops[i], stops[i + 1]];
    for (let k = i === 0 ? 0 : 1; k <= STEPS; k++) {
      const t = k / STEPS;
      linear.push({ r: a.r + (b.r - a.r) * t, g: a.g + (b.g - a.g) * t, b: a.b + (b.b - a.b) * t, a: 1 });
    }
  }
  const out: Rgba[] = [color("--bg", theme), ...linear];
  for (const glow of glows) for (const base of linear) for (let k = 0; k <= STEPS; k++) out.push(composite({ ...glow, a: k / STEPS }, base));
  // os brilhos se sobrepoem na viewport: cada par (o de indice maior por cima) composto sobre a mesma amostra
  for (let x = 0; x < glows.length; x++) {
    for (let y = x + 1; y < glows.length; y++) {
      for (const base of linear) {
        for (let i = 0; i <= STEPS; i++) {
          const under = composite({ ...glows[x], a: i / STEPS }, base);
          for (let j = 0; j <= STEPS; j++) out.push(composite({ ...glows[y], a: j / STEPS }, under));
        }
      }
    }
  }
  return out;
}

/** Fundos possiveis para um token de fundo: os do conjunto do fundo da pagina viram TODAS as amostras do gradiente. */
const backgroundsOf = (name: string, theme: Theme): Rgba[] => (PAGE_SET.has(name) ? pageSamples(theme) : [color(name, theme)]);

/**
 * Calcula a razao de um par no tema. `bg: "--bg"` (e `over` com tokens do fundo) vale como PIOR caso sobre as amostras do
 * gradiente; fundos translucidos (com `over`) usam o pior caso composto.
 */
function ratioOf(fg: string, bg: string, theme: Theme, over?: readonly string[]): number {
  const fgColor = color(fg, theme);
  const bgColor = color(bg, theme);
  if (bgColor.a >= 1 && fgColor.a >= 1) return Math.min(...backgroundsOf(bg, theme).map((b) => contrastRatio(fgColor, b)));
  const unders = (over && over.length ? over : ["--bg"]).flatMap((u) => backgroundsOf(u, theme));
  return Math.min(
    ...unders.map((under) => {
      const effectiveBg = bgColor.a < 1 ? composite(bgColor, under) : bgColor;
      const effectiveFg = fgColor.a < 1 ? composite(fgColor, effectiveBg) : fgColor;
      return contrastRatio(effectiveFg, effectiveBg);
    }),
  );
}

describe("tokens.css - estrutura", () => {
  it("existe e declara os dois temas com light-dark() e color-scheme", () => {
    expect(Object.keys(tokens).length).toBeGreaterThan(40);
    expect(css).toMatch(/:root\s*\{[^}]*color-scheme:\s*light dark/s);
    expect(css).toMatch(/:root\[data-theme="light"\]\s*\{[^}]*color-scheme:\s*light/s);
    expect(css).toMatch(/:root\[data-theme="dark"\]\s*\{[^}]*color-scheme:\s*dark/s);
  });

  it("--focus-ring e a FORMA do foco e referencia --focus-color (contorno 2px, afastamento 2px)", () => {
    const m = /--focus-ring\s*:\s*([^;]+);/.exec(css);
    expect(m).not.toBeNull();
    expect(m![1]).toContain("var(--focus-color)");
    expect(m![1]).toMatch(/2px/);
  });

  it("os 8 tokens novos do ui-designer estao declarados", () => {
    for (const t of ["--surface-active", "--input-bg", "--header-bg", "--primary-strong-hover", "--primary-strong-active", "--primary-border", "--focus-color", "--tooltip-border"]) {
      expect(tokens[t], t).toBeDefined();
    }
  });

  it("--shadow-card e declarado UMA vez, fora de light-dark(), e referencia --shadow-color (design 1.2)", () => {
    const decl = [...css.matchAll(/--shadow-card\s*:\s*([^;]+);/g)];
    expect(decl).toHaveLength(1);
    expect(decl[0][1]).toContain("var(--shadow-color)");
    expect(decl[0][1]).not.toContain("light-dark(");
    expect(tokens["--shadow-card"]).toBeUndefined();
  });

  it("alfa de --header-bg <= 0.95 nos dois temas (invariante)", () => {
    for (const theme of THEMES) {
      const a = color("--header-bg", theme).a;
      expect(a).toBeGreaterThan(0.5);
      expect(a).toBeLessThanOrEqual(0.95);
    }
  });

  it("--header-bg, --scrim e --shadow-color sao os unicos tokens com alfa", () => {
    const withAlpha = Object.keys(tokens).filter((t) => THEMES.some((th) => color(t, th).a < 1));
    expect(withAlpha.sort()).toEqual(["--header-bg", "--scrim", "--shadow-color"]);
  });
});

describe.each(EXPECTED_VALUES)("valor do design: %s", (name, light, dark) => {
  it("claro e escuro iguais ao design (rev. 5 + fundo rev. 6)", () => {
    expect(tokens[name], `${name} ausente`).toBeDefined();
    expect(norm(tokens[name].light)).toBe(norm(light));
    expect(norm(tokens[name].dark)).toBe(norm(dark));
  });
});

describe("todos os tokens de cor tem valor do design (nenhum token extra sem justificativa)", () => {
  it("tokens.css nao declara cor fora da lista do design", () => {
    const known = new Set(EXPECTED_VALUES.map(([n]) => n));
    expect(Object.keys(tokens).filter((t) => !known.has(t))).toEqual([]);
  });
});

describe.each(THEMES)("contraste dos pares obrigatorios - tema %s", (theme) => {
  const idx = theme === "light" ? 0 : 1;
  it.each(REQUIRED.map((p) => [`${p.fg} sobre ${p.bg} (${p.kind})`, p] as const))("%s", (_label, pair) => {
    const ratio = ratioOf(pair.fg, pair.bg, theme, pair.over);
    expect(ratio).toBeGreaterThanOrEqual(MIN[pair.kind]);
    if (pair.expected) expect(ratio).toBeGreaterThanOrEqual(pair.expected[idx] - 0.011); // design arredonda para baixo
  });
});

describe("matriz de producao (contrast-pairs.ts)", () => {
  const has = (list: readonly { fg: string; bg: string }[], fg: string, bg: string) => list.some((p) => p.fg === fg && p.bg === bg);

  it("contem todos os pares obrigatorios", () => {
    const missing = REQUIRED.filter((p) => !has(CONTRAST_PAIRS, p.fg, p.bg)).map((p) => `${p.fg} x ${p.bg}`);
    expect(missing).toEqual([]);
  });

  it.each(THEMES)("todos os pares da matriz passam no tema %s (limite da categoria)", (theme) => {
    const failures = CONTRAST_PAIRS.map((p) => ({ p, ratio: ratioOf(p.fg, p.bg, theme, p.over) }))
      .filter(({ p, ratio }) => ratio < MIN[p.kind])
      .map(({ p, ratio }) => `${p.where}: ${p.fg} x ${p.bg} = ${ratio.toFixed(2)} (< ${MIN[p.kind]})`);
    expect(failures).toEqual([]);
  });

  it("cada par tem descricao do componente/estado (mensagem de falha util)", () => {
    for (const p of CONTRAST_PAIRS) expect(p.where.length, `${p.fg} x ${p.bg}`).toBeGreaterThan(3);
  });

  it("fundos translucidos declaram os fundos efetivos (over)", () => {
    for (const p of CONTRAST_PAIRS.filter((x) => x.bg === "--header-bg")) {
      expect(p.over && p.over.length, `${p.fg} x ${p.bg}`).toBeGreaterThan(0);
    }
  });

  it("DECORATIVE_PAIRS: --primary-strong x --surface esta coberto por --primary-border x --surface, que existe na matriz e passa", () => {
    const deco = DECORATIVE_PAIRS.find((p) => p.fg === "--primary-strong" && p.bg === "--surface");
    expect(deco).toBeDefined();
    expect(deco!.coveredBy.fg).toBe("--primary-border");
    expect(deco!.coveredBy.bg).toBe("--surface");
    expect(has(CONTRAST_PAIRS, "--primary-border", "--surface")).toBe(true);
    for (const theme of THEMES) expect(ratioOf("--primary-border", "--surface", theme)).toBeGreaterThanOrEqual(3);
    // no escuro o preenchimento sozinho NAO passa (por isso a cobertura e obrigatoria)
    expect(ratioOf("--primary-strong", "--surface", "dark")).toBeLessThan(3);
  });

  it("todo par decorativo tem cobertura que passa em ambos os temas", () => {
    for (const d of DECORATIVE_PAIRS) {
      for (const theme of THEMES) {
        expect(ratioOf(d.coveredBy.fg, d.coveredBy.bg, theme, d.coveredBy.over), `${d.fg} x ${d.bg}`).toBeGreaterThanOrEqual(MIN[d.coveredBy.kind]);
      }
    }
  });

  it("todo token de cor aparece em pelo menos um par (fg ou bg) ou na allowlist justificada", () => {
    // decorativos ou nao textuais por definicao (design 1.9: D = decorativo)
    const ALLOWLIST = new Set(["--skeleton", "--scrim", "--border", "--primary", "--chart-grid", "--chart-cursor", "--shadow-color"]);
    const used = new Set([...CONTRAST_PAIRS, ...DECORATIVE_PAIRS].flatMap((p) => [p.fg, p.bg]));
    // paradas e brilhos contam como cobertos pelos pares de --bg (que valem contra as amostras do gradiente, ADR 0003 5.5)
    if (used.has("--bg")) for (const t of PAGE_SET) used.add(t);
    const uncovered = Object.keys(tokens).filter((t) => !used.has(t) && !ALLOWLIST.has(t));
    expect(uncovered).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// Fundo em gradiente (design rev. 6, ADR 0003 5.2 / 5.5 / 4.1)
// ---------------------------------------------------------------------------
describe("fundo em gradiente - tokens (TQ2)", () => {
  it("declara exatamente 3 paradas (--bg-stop-1..3) e 2 brilhos (--bg-glow-1..2) com light-dark()", () => {
    expect(stopNames).toEqual(["--bg-stop-1", "--bg-stop-2", "--bg-stop-3"]);
    expect(glowNames).toEqual(["--bg-glow-1", "--bg-glow-2"]);
  });

  it("paradas e brilhos sao opacos nos dois temas (a lista de tokens com alfa nao cresce)", () => {
    for (const name of [...stopNames, ...glowNames]) for (const theme of THEMES) expect(color(name, theme).a, `${name} ${theme}`).toBe(1);
  });

  it("--bg-gradient e declarado UMA vez, fora de light-dark(): 2 radiais + linear 160deg, so var(--bg-stop-*|--bg-glow-*) e transparent", () => {
    const decl = [...css.matchAll(/--bg-gradient\s*:\s*([^;]+);/g)];
    expect(decl).toHaveLength(1);
    const value = decl[0][1];
    expect(value).not.toContain("light-dark(");
    expect(tokens["--bg-gradient"]).toBeUndefined();
    expect(value.match(/radial-gradient\(/g) ?? []).toHaveLength(2);
    expect(value.match(/linear-gradient\(/g) ?? []).toHaveLength(1);
    expect(value).toMatch(/linear-gradient\(\s*160deg/);
    expect(value).toContain("transparent");
    // nenhuma cor literal: todo o resto e var() do conjunto do fundo
    const withoutVars = value.replace(/var\(--bg-(?:stop|glow)-\d+\)/g, "").replace(/transparent/g, "");
    expect(withoutVars).not.toMatch(/#[0-9a-f]{3,8}\b|rgba?\(|hsla?\(|oklch\(|var\(/i);
    // referencia TODOS os tokens de parada e brilho declarados
    for (const name of [...stopNames, ...glowNames]) expect(value, name).toContain(`var(${name})`);
    // e so eles
    const referenced = [...value.matchAll(/var\((--[a-z0-9-]+)\)/g)].map((m) => m[1]);
    for (const name of referenced) expect(PAGE_SET.has(name), `${name} fora do conjunto do fundo`).toBe(true);
  });

  it("brilhos ficam acima das paradas na receita: camadas radiais primeiro, linear por ultimo (ordem do design, secao 1)", () => {
    const value = /--bg-gradient\s*:\s*([^;]+);/.exec(css)![1];
    expect(value.indexOf("radial-gradient(")).toBeGreaterThanOrEqual(0);
    expect(value.lastIndexOf("radial-gradient(")).toBeLessThan(value.indexOf("linear-gradient("));
  });
});

describe("contrast-pairs.ts - conjunto do fundo (ADR 0003 5.5)", () => {
  it("PAGE_BACKGROUND_TOKENS e exatamente --bg + as paradas + os brilhos declarados em tokens.css", () => {
    expect(PAGE_BACKGROUND_TOKENS, "PAGE_BACKGROUND_TOKENS nao exportado").toBeDefined();
    expect([...PAGE_BACKGROUND_TOKENS].sort()).toEqual([...PAGE_SET].sort());
    expect(PAGE_BACKGROUND_TOKENS[0]).toBe("--bg");
  });

  it("HEADER_UNDER derivado: pares de navbar compoem sobre TODO o conjunto do fundo + --surface, --surface-2 e --text", () => {
    const headerPairs = CONTRAST_PAIRS.filter((p) => p.bg === "--header-bg");
    expect(headerPairs.length).toBeGreaterThan(0);
    for (const p of headerPairs) {
      for (const t of [...(PAGE_BACKGROUND_TOKENS ?? []), "--surface", "--surface-2", "--text"]) expect(p.over, `${p.fg} x ${p.bg} sem ${t}`).toContain(t);
    }
  });

  it("descricao (where) dos pares com --bg menciona o pior caso do gradiente", () => {
    for (const p of CONTRAST_PAIRS.filter((x) => x.bg === "--bg")) expect(p.where.toLowerCase(), `${p.fg} x ${p.bg}`).toMatch(/gradiente/);
  });
});

describe.each(THEMES)("fundo em gradiente - regras de cor (RNF04, RNF05, I5-I7) - tema %s", (theme) => {
  const names = [...PAGE_SET];

  it("amostragem cobre o gradiente inteiro (paradas, interpolacoes e brilhos compostos)", () => {
    expect(pageSamples(theme).length).toBeGreaterThan(stopNames.length * 10 + glowNames.length * 17 * 17 + 17 * 17 * 17);
  });

  if (theme === "dark") {
    it("escuro: toda cor do conjunto e toda amostra tem luminancia em [0,005; 0,25): nao e preto e continua escuro", () => {
      for (const n of names) {
        const l = relativeLuminance(color(n, "dark"));
        expect(l, `${n} muito escuro (preto)`).toBeGreaterThanOrEqual(0.005);
        expect(l, `${n} claro demais para o tema escuro`).toBeLessThan(0.25);
      }
      for (const sample of pageSamples("dark")) {
        const l = relativeLuminance(sample);
        expect(l).toBeGreaterThanOrEqual(0.005);
        expect(l).toBeLessThan(0.25);
      }
    });
  } else {
    it("claro: nenhuma cor do conjunto e branca pura e todas tem luminancia abaixo da de --surface", () => {
      const surface = relativeLuminance(color("--surface", "light"));
      for (const n of names) {
        const c = color(n, "light");
        expect([c.r, c.g, c.b], `${n} e branco puro`).not.toEqual([255, 255, 255]);
        expect(relativeLuminance(c), `${n} se confunde com --surface`).toBeLessThan(surface);
      }
    });

    it("claro: toda cor do conjunto tem matiz perceptivel (croma max-min dos canais >= 12, design G7)", () => {
      for (const n of names) {
        const c = color(n, "light");
        const chroma = Math.max(c.r, c.g, c.b) - Math.min(c.r, c.g, c.b);
        expect(chroma, `${n} sem matiz (cinza/branco)`).toBeGreaterThanOrEqual(12);
      }
    });
  }

  it("a cor base --bg fica dentro da faixa de luminancia das amostras do gradiente (I7)", () => {
    const ls = pageSamples(theme).map(relativeLuminance);
    const base = relativeLuminance(color("--bg", theme));
    expect(base).toBeGreaterThanOrEqual(Math.min(...ls));
    expect(base).toBeLessThanOrEqual(Math.max(...ls));
  });

  it("a cor base --bg esta dentro da faixa das PARADAS declaradas (nao so das amostras com brilho)", () => {
    const ls = stopNames.map((n) => relativeLuminance(color(n, theme)));
    const base = relativeLuminance(color("--bg", theme));
    expect(base).toBeGreaterThanOrEqual(Math.min(...ls));
    expect(base).toBeLessThanOrEqual(Math.max(...ls));
  });

  it("par de pior caso: nenhum primeiro plano que usa --bg cai abaixo do minimo em QUALQUER amostra", () => {
    const failures = REQUIRED.filter((p) => p.bg === "--bg").flatMap((p) =>
      pageSamples(theme)
        .map((s) => ({ p, ratio: contrastRatio(color(p.fg, theme), s) }))
        .filter(({ ratio }) => ratio < MIN[p.kind])
        .slice(0, 1)
        .map(({ p: pair, ratio }) => `${pair.fg} x --bg = ${ratio.toFixed(2)} (< ${MIN[pair.kind]})`),
    );
    expect(failures).toEqual([]);
  });

  it("navbar (--header-bg 0,95) composta sobre cada amostra do fundo passa nos tres pares", () => {
    const header = color("--header-bg", theme);
    for (const [fg, kind] of [["--text", "text"], ["--text-muted", "text"], ["--accent", "text"], ["--focus-color", "non-text"]] as const) {
      const worst = Math.min(...pageSamples(theme).map((s) => contrastRatio(color(fg, theme), composite(header, s))));
      expect(worst, `${fg} sobre navbar sobre o fundo`).toBeGreaterThanOrEqual(MIN[kind]);
    }
  });

  it("--chart-cursor (claro) e --input-bg (escuro) mantem os valores da rev. 5 (P3), deixando de ser 'iguais ao fundo'", () => {
    if (theme === "light") expect(norm(tokens["--chart-cursor"].light)).toBe("#eef1f5");
    else expect(norm(tokens["--input-bg"].dark)).toBe("#151b26");
  });
});
