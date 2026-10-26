// @vitest-environment node
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { composite, contrastRatio, parseColor } from "./contrast";
import { CONTRAST_PAIRS, DECORATIVE_PAIRS } from "./contrast-pairs";

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
// Valores do design rev. 5 (secao 1.2): [token, claro, escuro]
// ---------------------------------------------------------------------------
const EXPECTED_VALUES: [string, string, string][] = [
  ["--bg", "#EEF1F5", "#151B26"],
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

const HEADER_UNDER = ["--bg", "--surface", "--surface-2", "--text"];
const P = (fg: string, bg: string, kind: Required["kind"], expected?: [number, number], over?: string[]): Required => ({ fg, bg, kind, expected, over });

// Pares obrigatorios: ADR 9.5 (tokens novos) + design 1.9 (texto, desabilitado, componentes, graficos).
const REQUIRED: Required[] = [
  P("--text", "--bg", "text", [12.91, 13.91]),
  P("--text", "--surface", "text", [14.62, 12.7]),
  P("--text", "--surface-2", "text", [13.51, 11.14]),
  P("--text", "--surface-active", "text", [11.89, 9.22]),
  P("--text", "--input-bg", "text", [14.62, 13.91]),
  P("--text-muted", "--bg", "text", [6.63, 6.95]),
  P("--text-muted", "--surface", "text", [7.51, 6.34]),
  P("--text-muted", "--surface-2", "text", [6.94, 5.56]),
  P("--text-muted", "--surface-active", "text", [6.11, 4.6]),
  P("--text-muted", "--input-bg", "text", [7.51, 6.95]),
  P("--accent", "--surface", "text", [5.35, 8.05]),
  P("--accent", "--bg", "text", [4.72, 8.82]),
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
  P("--danger-text", "--bg", "text", [5.71, 6.23]),
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
  P("--text-disabled", "--bg", "disabled", [3.87, 4.58]),
  // bordas de controles, foco, estado
  P("--border-strong", "--surface", "non-text", [4.38, 4.18]),
  P("--border-strong", "--bg", "non-text", [3.87, 4.58]),
  P("--border-strong", "--surface-2", "non-text", [4.04, 3.66]),
  P("--border-strong", "--surface-active", "non-text", [3.56, 3.03]),
  P("--border-strong", "--input-bg", "non-text"),
  P("--primary-border", "--surface", "non-text", [6.28, 5.28]),
  P("--primary-border", "--bg", "non-text", [5.54, 5.78]),
  P("--primary-border", "--surface-2", "non-text", [5.8, 4.63]),
  P("--focus-color", "--surface", "non-text", [5.35, 8.05]),
  P("--focus-color", "--bg", "non-text", [4.72, 8.82]),
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

/** Calcula a razao de um par no tema; fundos translucidos (com `over`) usam o PIOR caso composto. */
function ratioOf(fg: string, bg: string, theme: Theme, over?: readonly string[]): number {
  const fgColor = color(fg, theme);
  const bgColor = color(bg, theme);
  if (bgColor.a >= 1 && fgColor.a >= 1) return contrastRatio(fgColor, bgColor);
  const unders = over && over.length ? over : ["--bg"];
  return Math.min(
    ...unders.map((u) => {
      const under = color(u, theme);
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
  it("claro e escuro iguais ao design rev. 5", () => {
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
    const uncovered = Object.keys(tokens).filter((t) => !used.has(t) && !ALLOWLIST.has(t));
    expect(uncovered).toEqual([]);
  });
});
