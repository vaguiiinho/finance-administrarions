// @vitest-environment node
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative, resolve } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * RF27 / ADR 9.5 / design 1.1: nenhum componente usa cor literal (#hex, rgb(, hsl(, cor nomeada,
 * paleta do Tailwind) fora de `app/styles/tokens.css`. Cores vem so de `var(--token)` / utilitarios dos tokens.
 */
const ROOT = resolve(__dirname, "..");
const SCAN_DIRS = ["app", "components"];
const EXTENSIONS = [".tsx", ".ts", ".css", ".mdx"];
const TOKENS_FILE = join("app", "styles", "tokens.css");

/** Arquivos autorizados a ter cor literal. So tokens.css (RF27, CA20): a feature do fundo em gradiente nao deixa excecao (ADR 0003 T11). */
export const ALLOWED_FILES: readonly { path: string; reason: string }[] = [
  { path: TOKENS_FILE, reason: "fonte unica de cores (RF27)" },
];

const NAMED = [
  "aliceblue", "antiquewhite", "aqua", "aquamarine", "azure", "beige", "bisque", "black", "blanchedalmond", "blue", "blueviolet", "brown",
  "burlywood", "cadetblue", "chartreuse", "chocolate", "coral", "cornflowerblue", "cornsilk", "crimson", "cyan", "darkblue", "darkcyan",
  "darkgoldenrod", "darkgray", "darkgrey", "darkgreen", "darkkhaki", "darkmagenta", "darkolivegreen", "darkorange", "darkorchid", "darkred",
  "darksalmon", "darkseagreen", "darkslateblue", "darkslategray", "darkturquoise", "darkviolet", "deeppink", "deepskyblue", "dimgray",
  "dodgerblue", "firebrick", "floralwhite", "forestgreen", "fuchsia", "gainsboro", "ghostwhite", "gold", "goldenrod", "gray", "grey", "green",
  "greenyellow", "honeydew", "hotpink", "indianred", "indigo", "ivory", "khaki", "lavender", "lavenderblush", "lawngreen", "lemonchiffon",
  "lightblue", "lightcoral", "lightcyan", "lightgray", "lightgrey", "lightgreen", "lightpink", "lightsalmon", "lightseagreen", "lightskyblue",
  "lightslategray", "lightsteelblue", "lightyellow", "lime", "limegreen", "linen", "magenta", "maroon", "mediumaquamarine", "mediumblue",
  "mediumorchid", "mediumpurple", "mediumseagreen", "mediumslateblue", "mediumspringgreen", "mediumturquoise", "mediumvioletred",
  "midnightblue", "mintcream", "mistyrose", "moccasin", "navajowhite", "navy", "oldlace", "olive", "olivedrab", "orange", "orangered", "orchid",
  "palegoldenrod", "palegreen", "paleturquoise", "palevioletred", "papayawhip", "peachpuff", "peru", "pink", "plum", "powderblue", "purple",
  "rebeccapurple", "red", "rosybrown", "royalblue", "saddlebrown", "salmon", "sandybrown", "seagreen", "seashell", "sienna", "silver",
  "skyblue", "slateblue", "slategray", "snow", "springgreen", "steelblue", "tan", "teal", "thistle", "tomato", "turquoise", "violet", "wheat",
  "white", "whitesmoke", "yellow", "yellowgreen",
];
const NAMED_RE = NAMED.join("|");
const TW_PALETTE = "slate|gray|zinc|neutral|stone|red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose";
const TW_PREFIX = "bg|text|border|border-[trblxy]|fill|stroke|ring|ring-offset|outline|divide|from|via|to|shadow|accent|caret|decoration|placeholder";

const PATTERNS: { name: string; re: RegExp }[] = [
  { name: "hexadecimal (#rgb/#rrggbb/#rrggbbaa)", re: /#(?:[0-9a-f]{8}|[0-9a-f]{6}|[0-9a-f]{4}|[0-9a-f]{3})\b/gi },
  { name: "funcao de cor (rgb/rgba/hsl/hsla/hwb/lab/lch/oklab/oklch/color)", re: /\b(?:rgba?|hsla?|hwb|lab|lch|oklab|oklch|color)\(/gi },
  { name: "utilitario de cor do Tailwind fora dos tokens (bg-white, text-black, bg-red-500...)", re: new RegExp(`(?<![\\w-])(?:${TW_PREFIX})-(?:white|black|(?:${TW_PALETTE})-\\d{2,3})(?![\\w-])`, "g") },
  { name: "valor arbitrario de cor no Tailwind (bg-[#fff], text-[rgb(...)])", re: /(?<![\w-])[a-z-]+-\[(?:#|rgba?\(|hsla?\()/gi },
  { name: "cor nomeada em declaracao CSS", re: new RegExp(`(?:^|[;{\\s])(?:color|background(?:-color)?|border(?:-[a-z]+)*(?:-color)?|outline(?:-color)?|fill|stroke|caret-color|accent-color|text-decoration-color|box-shadow|text-shadow)\\s*:\\s*[^;}{]*\\b(?:${NAMED_RE})\\b`, "gi") },
  { name: "cor nomeada em objeto de estilo/atributo (color: 'red', fill=\"white\", stroke='black')", re: new RegExp(`\\b(?:color|backgroundColor|borderColor|fill|stroke|outlineColor)\\s*[:=]\\s*\\{?\\s*["'](?:${NAMED_RE})["']`, "gi") },
];

export function stripComments(source: string, isCss: boolean): string {
  let out = source.replace(/\/\*[\s\S]*?\*\//g, " ");
  if (!isCss) out = out.replace(/(^|[^:"'`\\])\/\/[^\n]*/g, "$1");
  return out;
}

export function findColorLiterals(source: string, isCss = false): string[] {
  const clean = stripComments(source, isCss);
  const hits: string[] = [];
  for (const { name, re } of PATTERNS) {
    for (const m of clean.matchAll(re)) hits.push(`${name}: ${m[0].trim()}`);
  }
  return hits;
}

function walk(dir: string): string[] {
  let entries: string[] = [];
  try {
    entries = readdirSync(dir);
  } catch {
    return [];
  }
  return entries.flatMap((name) => {
    if (name === "node_modules" || name === ".next") return [];
    const full = join(dir, name);
    if (statSync(full).isDirectory()) return walk(full);
    return EXTENSIONS.some((e) => name.endsWith(e)) && !/\.(spec|test|pw)\.[a-z]+$/.test(name) ? [full] : [];
  });
}

describe("detector de cores literais (auto-teste do scanner)", () => {
  it.each([
    ["color: #fff;", true],
    ["background: #0B0F1A", true],
    ["border: 1px solid #12345678;", true],
    ["color: rgb(0 0 0 / .5)", true],
    ["x = rgba(1,2,3,.4)", true],
    ["color: hsl(10 20% 30%)", true],
    ["background-color: white;", true],
    ["border: 1px solid red", true],
    ["box-shadow: 0 0 4px black", true],
    ['<path fill="white" />', true],
    ["style={{ color: 'red' }}", true],
    ['className="bg-white text-black"', true],
    ['className="bg-red-500"', true],
    ['className="text-slate-900"', true],
    ['className="bg-[#ff0000]"', true],
    ['className="bg-[rgb(1,2,3)]"', true],
    ["color: var(--text);", false],
    ["background: var(--surface);", false],
    ['className="bg-surface text-text border-border-strong"', false],
    ["background: transparent;", false],
    ["color: currentColor;", false],
    ["box-shadow: 0 1px 2px var(--scrim)", false],
    ["// #fff em comentario", false],
    ["/* rgb(0 0 0) */ color: var(--text)", false],
    ['const href = "https://example.com/#top"', false],
    ["const id = '#section'", false],
    ["border: 1px solid var(--border-strong)", false],
    ["const redirectTo = '/entries'", false],
    ["// ok\nconst tan = 1", false],
  ])("%j -> %s", (source, expected) => {
    expect(findColorLiterals(source).length > 0).toBe(expected);
  });
});

describe("RF27: nenhuma cor literal fora de tokens.css", () => {
  const files = SCAN_DIRS.flatMap((d) => walk(join(ROOT, d))).filter((f) => !ALLOWED_FILES.some((a) => a.path === relative(ROOT, f)));

  it("ha arquivos de UI para verificar", () => {
    expect(files.length).toBeGreaterThan(0);
  });

  it("tokens.css existe (unico lugar permitido para cores literais)", () => {
    expect(statSync(join(ROOT, TOKENS_FILE)).isFile()).toBe(true);
  });

  it("app/ e components/ nao contem #hex, rgb(), hsl(), cor nomeada nem paleta do Tailwind", () => {
    const offenders = files.flatMap((file) => {
      const hits = findColorLiterals(readFileSync(file, "utf8"), file.endsWith(".css"));
      return hits.map((h) => `${relative(ROOT, file)} -> ${h}`);
    });
    expect(offenders).toEqual([]);
  });

  it("toda entrada de ALLOWED_FILES aponta para um arquivo existente (apagar a rota sem apagar a entrada deixa o teste vermelho)", () => {
    const missing = ALLOWED_FILES.filter((a) => !existsSync(join(ROOT, a.path))).map((a) => a.path);
    expect(missing).toEqual([]);
  });

  it("toda entrada diferente de tokens.css tem motivo nao vazio", () => {
    const noReason = ALLOWED_FILES.filter((a) => a.path !== TOKENS_FILE && a.reason.trim() === "").map((a) => a.path);
    expect(noReason).toEqual([]);
  });

  it("tokens.css esta em ALLOWED_FILES (entrada permanente)", () => {
    expect(ALLOWED_FILES.map((a) => a.path)).toContain(TOKENS_FILE);
  });

  it("CA20: tokens.css e a UNICA entrada (nenhuma excecao ligada ao fundo em gradiente / pre-visualizacao)", () => {
    expect(ALLOWED_FILES.map((a) => a.path)).toEqual([TOKENS_FILE]);
  });

  it("caminhos sao relativos e unicos", () => {
    const paths = ALLOWED_FILES.map((a) => a.path);
    expect(new Set(paths).size).toBe(paths.length);
    for (const p of paths) expect(p.startsWith("/")).toBe(false);
  });
});
