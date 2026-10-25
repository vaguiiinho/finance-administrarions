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
// Valores do design rev. 3 (secao 1.2): [token, claro, escuro]
// ---------------------------------------------------------------------------
const EXPECTED_VALUES: [string, string, string][] = [
  ["--bg", "#F5F7FB", "#0B0F1A"],
  ["--surface", "#FFFFFF", "#121829"],
  ["--surface-2", "#EEF1F7", "#18203A"],
  ["--surface-active", "#E2E7F0", "#222B4A"],
  ["--input-bg", "#FFFFFF", "#0B0F1A"],
  ["--header-bg", "rgb(255 255 255 / 0.95)", "rgb(18 24 41 / 0.95)"],
  ["--border", "#DDE2EC", "#1F2940"],
  ["--border-strong", "#737D92", "#6E7891"],
  ["--text", "#0F172A", "#E6EAF5"],
  ["--text-muted", "#475569", "#8B95AD"],
  ["--text-disabled", "#737D92", "#6E7891"],
  ["--skeleton", "#E2E7F0", "#222B4A"],
  ["--scrim", "rgb(15 23 42 / 0.45)", "rgb(11 15 26 / 0.72)"],
  ["--primary", "#6366F1", "#6366F1"],
  ["--primary-strong", "#4F46E5", "#4F46E5"],
  ["--primary-strong-hover", "#4338CA", "#4338CA"],
  ["--primary-strong-active", "#3730A3", "#3730A3"],
  ["--primary-border", "#4F46E5", "#818CF8"],
  ["--on-primary", "#FFFFFF", "#FFFFFF"],
  ["--accent", "#0E7490", "#22D3EE"],
  ["--focus-color", "#0E7490", "#22D3EE"],
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
  ["--chart-axis", "#475569", "#8B95AD"],
  ["--chart-grid", "#DDE2EC", "#2A3552"],
  ["--chart-zero-line", "#475569", "#8B95AD"],
  ["--chart-cursor", "#EEF1F7", "#18203A"],
  ["--chart-1", "#0E7490", "#22D3EE"],
  ["--chart-2", "#4F46E5", "#818CF8"],
  ["--chart-3", "#BE185D", "#F472B6"],
  ["--chart-4", "#4D7C0F", "#A3E635"],
  ["--chart-5", "#C2410C", "#FB923C"],
  ["--chart-6", "#64748B", "#8B95AD"],
  ["--tooltip-bg", "#FFFFFF", "#18203A"],
  ["--tooltip-border", "#737D92", "#6E7891"],
  ["--scrollbar-thumb", "#737D92", "#6E7891"],
  ["--scrollbar-track", "#EEF1F7", "#18203A"],
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
  P("--text", "--bg", "text", [16.64, 15.9]),
  P("--text", "--surface", "text", [17.85, 14.68]),
  P("--text", "--surface-2", "text", [15.77, 13.35]),
  P("--text", "--surface-active", "text", [14.38, 11.53]),
  P("--text", "--input-bg", "text", [17.85, 15.9]),
  P("--text-muted", "--bg", "text", [7.06, 6.37]),
  P("--text-muted", "--surface", "text", [7.57, 5.89]),
  P("--text-muted", "--surface-2", "text", [6.69, 5.35]),
  P("--text-muted", "--surface-active", "text", [6.1, 4.62]),
  P("--text-muted", "--input-bg", "text", [7.57, 6.37]),
  P("--accent", "--surface", "text", [5.35, 9.77]),
  P("--accent", "--bg", "text", [4.99, 10.58]),
  P("--accent", "--surface-2", "text", [4.73, 8.89]),
  P("--on-primary", "--primary-strong", "text", [6.28, 6.28]),
  P("--on-primary", "--primary-strong-hover", "text", [7.9, 7.9]),
  P("--on-primary", "--primary-strong-active", "text", [9.93, 9.93]),
  P("--success-text", "--surface", "text", [5.48, 9.19]),
  P("--success-text", "--surface-2", "text", [4.84, 8.36]),
  P("--warning-text", "--surface", "text", [7.08, 10.58]),
  P("--warning-text", "--surface-2", "text", [6.26, 9.62]),
  P("--danger-text", "--surface", "text", [6.47, 6.38]),
  P("--danger-text", "--surface-2", "text", [5.71, 5.81]),
  P("--danger-text", "--bg", "text", [6.03, 6.91]),
  P("--income", "--surface", "text", [6.7, 6.95]),
  P("--income", "--surface-2", "text", [5.92, 6.32]),
  P("--expense", "--surface", "text", [6.28, 6.56]),
  P("--expense", "--surface-2", "text", [5.55, 5.97]),
  P("--text", "--tooltip-bg", "text", [17.85, 13.35]),
  P("--text-muted", "--tooltip-bg", "text", [7.57, 5.35]),
  P("--chart-axis", "--surface", "text", [7.57, 5.89]),
  // navbar com fundo translucido: contraste no PIOR caso composto
  P("--text", "--header-bg", "text", [16.13, 13.08], HEADER_UNDER),
  P("--text-muted", "--header-bg", "text", [6.84, 5.24], HEADER_UNDER),
  P("--accent", "--header-bg", "text", [4.84, 8.71], HEADER_UNDER),
  P("--focus-color", "--header-bg", "non-text", undefined, HEADER_UNDER),
  // desabilitado
  P("--text-disabled", "--surface-2", "disabled", [3.65, 3.64]),
  P("--text-disabled", "--surface", "disabled", [4.13, 4.0]),
  P("--text-disabled", "--bg", "disabled", [3.85, 4.33]),
  // bordas de controles, foco, estado
  P("--border-strong", "--surface", "non-text", [4.13, 4.0]),
  P("--border-strong", "--bg", "non-text", [3.85, 4.33]),
  P("--border-strong", "--surface-2", "non-text", [3.65, 3.64]),
  P("--border-strong", "--surface-active", "non-text", [3.33, 3.14]),
  P("--border-strong", "--input-bg", "non-text"),
  P("--primary-border", "--surface", "non-text", [6.28, 5.92]),
  P("--primary-border", "--bg", "non-text", [5.86, 6.41]),
  P("--primary-border", "--surface-2", "non-text", [5.55, 5.38]),
  P("--focus-color", "--surface", "non-text", [5.35, 9.77]),
  P("--focus-color", "--bg", "non-text", [4.99, 10.58]),
  P("--focus-color", "--surface-2", "non-text", [4.73, 8.89]),
  P("--focus-color", "--input-bg", "non-text"),
  P("--danger", "--input-bg", "non-text", [4.82, 6.91]),
  P("--danger", "--surface", "non-text", [4.82, 6.38]),
  P("--danger", "--surface-2", "non-text", [4.26, 5.81]),
  P("--success", "--surface", "non-text", [3.76, 9.19]),
  P("--success", "--surface-2", "non-text", [3.33, 8.36]),
  P("--warning", "--surface", "non-text", [5.02, 10.58]),
  P("--warning", "--surface-2", "non-text", [4.43, 9.62]),
  P("--tooltip-border", "--surface", "non-text", [4.13, 4.0]),
  P("--scrollbar-thumb", "--scrollbar-track", "non-text", [3.65, 3.64]),
  // graficos
  P("--chart-income", "--surface", "non-text", [6.7, 6.95]),
  P("--chart-paid", "--surface", "non-text", [3.76, 9.19]),
  P("--chart-pending", "--surface", "non-text", [5.02, 10.58]),
  P("--chart-balance-realized", "--surface", "non-text", [7.1, 6.49]),
  P("--chart-balance-projected", "--surface", "non-text", [6.03, 6.67]),
  P("--chart-zero-line", "--surface", "non-text", [7.57, 5.89]),
  ...[1, 2, 3, 4, 5, 6].map((n, i) =>
    P(`--chart-${n}`, "--surface", "non-text", [[5.35, 6.28, 6.03, 4.99, 5.17, 4.75][i], [9.77, 5.92, 6.67, 11.71, 7.8, 5.89][i]]),
  ),
  P("--chart-income", "--tooltip-bg", "non-text", [6.7, 6.32]),
  P("--chart-paid", "--tooltip-bg", "non-text", [3.76, 8.36]),
  P("--chart-pending", "--tooltip-bg", "non-text", [5.02, 9.62]),
  P("--chart-balance-realized", "--tooltip-bg", "non-text", [7.1, 5.9]),
  P("--chart-balance-projected", "--tooltip-bg", "non-text", [6.03, 6.06]),
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

  it("alfa de --header-bg <= 0.95 nos dois temas (invariante)", () => {
    for (const theme of THEMES) {
      const a = color("--header-bg", theme).a;
      expect(a).toBeGreaterThan(0.5);
      expect(a).toBeLessThanOrEqual(0.95);
    }
  });

  it("--header-bg e --scrim sao os unicos tokens de superficie com alfa", () => {
    const withAlpha = Object.keys(tokens).filter((t) => THEMES.some((th) => color(t, th).a < 1));
    expect(withAlpha.sort()).toEqual(["--header-bg", "--scrim"]);
  });
});

describe.each(EXPECTED_VALUES)("valor do design: %s", (name, light, dark) => {
  it("claro e escuro iguais ao design rev. 3", () => {
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
    const ALLOWLIST = new Set(["--skeleton", "--scrim", "--border", "--primary", "--chart-grid", "--chart-cursor"]);
    const used = new Set([...CONTRAST_PAIRS, ...DECORATIVE_PAIRS].flatMap((p) => [p.fg, p.bg]));
    const uncovered = Object.keys(tokens).filter((t) => !used.has(t) && !ALLOWLIST.has(t));
    expect(uncovered).toEqual([]);
  });
});
