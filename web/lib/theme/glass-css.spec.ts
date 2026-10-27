// @vitest-environment node
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative, resolve } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * Vidro fosco: testes ESTATICOS do CSS e da marcacao (ADR 0004 5.1, 5.2, 5.7, 9.1; CA05, CA08-CA10, CA13; RF06-RF08, RF10, RNF06).
 * Le `app/styles/glass.css` (papeis + fallbacks), `app/globals.css` (camadas e classes de superficie) e a marcacao de `app/` e `components/`.
 * O parser e o conjunto de papeis sao do TESTE (independentes da implementacao).
 */
const ROOT = resolve(__dirname, "../..");
const read = (path: string) => (existsSync(join(ROOT, path)) ? readFileSync(join(ROOT, path), "utf8") : "");
const stripComments = (css: string) => css.replace(/\/\*[\s\S]*?\*\//g, "");

const glassRaw = read("app/styles/glass.css");
const glass = stripComments(glassRaw);
const globals = stripComments(read("app/globals.css"));

// ---------------------------------------------------------------------------
// parser minimo (blocos aninhados por contagem de chaves)
// ---------------------------------------------------------------------------
interface Block {
  header: string;
  body: string;
}
/** Itens de primeiro nivel de `css`: `header { body }` (corpo com chaves balanceadas). Statements `@x ...;` sem chaves sao ignorados. */
function blocks(css: string): Block[] {
  const out: Block[] = [];
  let i = 0;
  while (i < css.length) {
    const open = css.indexOf("{", i);
    if (open === -1) break;
    const semi = css.lastIndexOf(";", open);
    const headerStart = semi >= i ? semi + 1 : i;
    const header = css.slice(headerStart, open).trim().replace(/\s+/g, " ");
    let depth = 1;
    let j = open + 1;
    while (j < css.length && depth > 0) {
      if (css[j] === "{") depth++;
      else if (css[j] === "}") depth--;
      j++;
    }
    out.push({ header, body: css.slice(open + 1, j - 1) });
    i = j;
  }
  return out;
}

interface FlatRule {
  selector: string;
  body: string;
  layer: string | null;
}
/** Todas as regras de seletor, com a layer em que estao (`@media`/`@supports` herdam a layer do pai). Ignora @theme/@utility/@keyframes. */
function flatten(css: string, layer: string | null = null): FlatRule[] {
  return blocks(css).flatMap((b): FlatRule[] => {
    if (/^@layer\b/.test(b.header)) return flatten(b.body, b.header.replace(/^@layer\s+/, "").trim());
    if (/^@(media|supports|container)\b/.test(b.header)) return flatten(b.body, layer);
    if (b.header.startsWith("@")) return [];
    return [{ selector: b.header, body: b.body, layer }];
  });
}

function declarations(body: string): Record<string, string> {
  const out: Record<string, string> = {};
  for (const m of body.matchAll(/(--[a-z0-9-]+|[a-z-]+)\s*:\s*([^;]+);?/gi)) out[m[1]] = m[2].trim().replace(/\s+/g, " ");
  return out;
}

const normSel = (s: string) => s.replace(/'/g, '"').replace(/\s+/g, " ").trim();
const parts = (selector: string) => selector.split(",").map(normSel);

const rules = flatten(globals);
const rulesFor = (selector: string) => rules.filter((r) => parts(r.selector).includes(selector));
const prop = (selector: string, name: string): string[] => rulesFor(selector).map((r) => declarations(r.body)[name]).filter((v): v is string => v !== undefined);

// ---------------------------------------------------------------------------
// glass.css - papeis e fallback opaco (TQ4, G9)
// ---------------------------------------------------------------------------
const ROLES = ["--card-bg", "--card-bg-2", "--field-bg", "--bar-bg", "--card-border", "--card-shadow", "--glass-filter", "--item-filter", "--chart-sep"] as const;

const GLASS_VALUES: Record<(typeof ROLES)[number], string> = {
  "--card-bg": "var(--glass-bg)",
  "--card-bg-2": "var(--glass-bg-2)",
  "--field-bg": "var(--glass-input-bg)",
  "--bar-bg": "var(--glass-bar-bg)",
  "--card-border": "var(--glass-border)",
  "--card-shadow": "var(--glass-shadow)",
  "--glass-filter": "blur(var(--glass-blur))",
  "--item-filter": "none", // itens repetidos em vidro plano (TQ3, ADR 5.5); T10 pode trocar por var(--glass-filter)
  "--chart-sep": "var(--chart-separator)",
};

/** Valores opacos da rev. 6 (RF05, RNF03): o fallback e o contexto opaco voltam a eles. */
const OPAQUE_VALUES: Record<(typeof ROLES)[number], string> = {
  "--card-bg": "var(--surface)",
  "--card-bg-2": "var(--surface-2)",
  "--field-bg": "var(--input-bg)",
  "--bar-bg": "var(--surface)",
  "--card-border": "var(--border)",
  "--card-shadow": "var(--shadow-card)",
  "--glass-filter": "none",
  "--item-filter": "none",
  "--chart-sep": "var(--surface)",
};

const glassTop = blocks(glass);
const rootBlocks = glassTop.filter((b) => normSel(b.header) === ":root");
const supportsBlock = glassTop.find((b) => /^@supports\s+not\b/.test(b.header));
const mediaBlock = glassTop.find((b) => /^@media\b/.test(b.header) && /prefers-reduced-transparency/.test(b.header));
const resetRule = flatten(glass).find((r) => parts(r.selector).includes('[data-surface="opaque"]'));

const inner = (block: Block | undefined): Record<string, string> => {
  if (!block) return {};
  const root = blocks(block.body).find((b) => /:root/.test(b.header));
  return declarations(root ? root.body : block.body);
};

describe("glass.css - papeis de superficie (ADR 0004 5.1)", () => {
  it("o arquivo existe e e importado por globals.css logo depois de tokens.css", () => {
    expect(existsSync(join(ROOT, "app/styles/glass.css")), "app/styles/glass.css nao existe").toBe(true);
    const imports = [...read("app/globals.css").matchAll(/@import\s+["']([^"']+)["']/g)].map((m) => m[1]);
    const i = imports.indexOf("./styles/tokens.css");
    expect(i).toBeGreaterThanOrEqual(0);
    expect(imports[i + 1]).toBe("./styles/glass.css");
  });

  it(":root declara os 9 papeis (8 do ADR + --card-shadow do design) com os valores de vidro", () => {
    const decls = rootBlocks.map((b) => declarations(b.body)).reduce((acc, d) => ({ ...acc, ...d }), {});
    for (const role of ROLES) expect(decls[role], role).toBe(GLASS_VALUES[role]);
  });

  it("os papeis so apontam para tokens (var(--...)), blur(var(--glass-blur)) ou none: nenhuma cor literal (RF10)", () => {
    expect(glass).not.toMatch(/#[0-9a-f]{3,8}\b|rgba?\(|hsla?\(|oklch\(|\bwhite\b|\bblack\b/i);
  });
});

describe("glass.css - fallback opaco em um unico ponto (TQ4, G9, RF06-RF08)", () => {
  it("existe @supports not ((backdrop-filter: ...) or (-webkit-backdrop-filter: ...)) (com e sem prefixo, R10)", () => {
    expect(supportsBlock, "bloco @supports not ausente").toBeDefined();
    const header = supportsBlock!.header;
    expect(header).toMatch(/\bnot\b/);
    expect(header).toMatch(/\(\s*backdrop-filter\s*:\s*blur\(1px\)\s*\)/);
    expect(header).toMatch(/\(\s*-webkit-backdrop-filter\s*:\s*blur\(1px\)\s*\)/);
    expect(header).toMatch(/\bor\b/);
  });

  it("existe @media com prefers-reduced-transparency: reduce, prefers-contrast: more e forced-colors: active (lista com virgula, R9)", () => {
    expect(mediaBlock, "bloco @media de preferencias ausente").toBeDefined();
    const header = mediaBlock!.header;
    expect(header).toMatch(/\(\s*prefers-reduced-transparency\s*:\s*reduce\s*\)/);
    expect(header).toMatch(/\(\s*prefers-contrast\s*:\s*more\s*\)/);
    expect(header).toMatch(/\(\s*forced-colors\s*:\s*active\s*\)/);
    expect(header.split(",").length, "as tres condicoes precisam ser alternativas (virgula = ou)").toBeGreaterThanOrEqual(3);
  });

  it("o reset de contexto opaco cobre dialog, .drawer, .modal e [data-surface=\"opaque\"] (RF05, PA2)", () => {
    expect(resetRule, 'regra com [data-surface="opaque"] ausente').toBeDefined();
    const selectors = parts(resetRule!.selector);
    for (const s of ["dialog", ".drawer", ".modal", '[data-surface="opaque"]']) expect(selectors, s).toContain(s);
  });

  it("os tres blocos (@supports, @media, reset) declaram o MESMO conjunto, igual aos valores opacos da rev. 6, cobrindo todos os papeis", () => {
    const sets = { supports: inner(supportsBlock), media: inner(mediaBlock), reset: resetRule ? declarations(resetRule.body) : {} };
    for (const [name, decls] of Object.entries(sets)) {
      for (const role of ROLES) expect(decls[role], `${name}: ${role}`).toBe(OPAQUE_VALUES[role]);
    }
    const pick = (d: Record<string, string>) => ROLES.map((r) => d[r]);
    expect(pick(sets.supports)).toEqual(pick(sets.media));
    expect(pick(sets.media)).toEqual(pick(sets.reset));
  });

  it("os blocos de fallback vem DEPOIS do :root de vidro (mesma especificidade: quem vem depois vence)", () => {
    const order = glassTop.map((b) => b.header);
    const rootIdx = order.findIndex((h) => normSel(h) === ":root");
    expect(rootIdx).toBeGreaterThanOrEqual(0);
    expect(order.findIndex((h) => /^@supports\s+not\b/.test(h))).toBeGreaterThan(rootIdx);
    expect(order.findIndex((h) => /^@media\b/.test(h) && /prefers-reduced-transparency/.test(h))).toBeGreaterThan(rootIdx);
  });

  it("o fallback nao usa var(--bg) (o teste do gradiente continua valido)", () => {
    expect(glass).not.toMatch(/var\(--bg\)/);
  });

  it("sem animacao nem transicao no vidro (RNF06, G5)", () => {
    expect(glass).not.toMatch(/\btransition\b|\banimation\b|@keyframes/);
  });
});

// ---------------------------------------------------------------------------
// globals.css - camadas (R8, TQ6) e superficies
// ---------------------------------------------------------------------------
/** Classes de componente que precisam estar em `@layer components` para os utilitarios as poderem sobrescrever (ADR 5.7). */
const COMPONENT_CLASSES = ["btn", "field", "checkbox", "segmented", "tablist", "tab", "card", "glass", "glass-flat", "glass-bar", "chip", "skeleton", "progress", "row-selected", "row-highlight", "drawer", "drawer-right", "drawer-sheet", "modal"];
const classOf = (selector: string) => /^\.([a-z0-9-]+)/.exec(selector)?.[1];

describe("globals.css - cascata: classes de componente em @layer components (TQ6, R8)", () => {
  it("toda regra de classe de componente esta dentro de @layer components (sem layer ela vence os utilitarios e anula md:bg-transparent etc.)", () => {
    const offenders = rules
      .flatMap((r) => parts(r.selector).map((sel) => ({ sel, layer: r.layer })))
      .filter(({ sel }) => COMPONENT_CLASSES.includes(classOf(sel) ?? ""))
      .filter(({ layer }) => layer !== "components")
      .map(({ sel, layer }) => `${sel} (layer: ${layer ?? "nenhuma"})`);
    expect([...new Set(offenders)]).toEqual([]);
  });

  it("regras de elemento (input/select/textarea, option, ::placeholder, dialog) estao em @layer base ou components, nunca sem layer", () => {
    const offenders = rules
      .filter((r) => parts(r.selector).some((s) => /^(input|select|textarea|option|::placeholder|dialog)\b/.test(s)))
      .filter((r) => r.layer !== "base" && r.layer !== "components")
      .map((r) => r.selector);
    expect(offenders).toEqual([]);
  });

  it(":focus-visible global esta em @layer base: fora de layer ele vence `.checkbox:focus-visible { outline: none }` e duplica o anel do checkbox", () => {
    const found = rulesFor(":focus-visible");
    expect(found.length).toBeGreaterThan(0);
    for (const r of found) expect(r.layer).toBe("base");
    expect(prop(".checkbox:focus-visible", "outline")).toContain("none");
  });

  it("regras globais de tema continuam fora de layer: html, body, body::before, .page-bg-window", () => {
    for (const sel of ["html", "body", "body::before", ".page-bg-window"]) {
      const found = rulesFor(sel);
      expect(found.length, sel).toBeGreaterThan(0);
      for (const r of found) expect(r.layer, sel).toBeNull();
    }
  });
});

describe("globals.css - superficies de vidro", () => {
  const glassRules = [".card", ".glass", ".glass-flat", ".glass-bar"];

  it("existem as classes .glass, .glass-flat e .glass-bar", () => {
    for (const sel of [".glass", ".glass-flat", ".glass-bar"]) expect(rulesFor(sel).length, sel).toBeGreaterThan(0);
  });

  it(".card e .glass usam os papeis: fundo --card-bg, borda de 1px --card-border, sombra --card-shadow e desfoque --glass-filter (com -webkit-)", () => {
    for (const sel of [".card", ".glass"]) {
      expect(prop(sel, "background"), `${sel} background`).toContain("var(--card-bg)");
      expect(prop(sel, "border").join(" "), `${sel} border`).toMatch(/1px\s+solid\s+var\(--card-border\)/);
      expect(prop(sel, "box-shadow"), `${sel} box-shadow`).toContain("var(--card-shadow)");
      expect(prop(sel, "backdrop-filter"), `${sel} backdrop-filter`).toContain("var(--glass-filter)");
      expect(prop(sel, "-webkit-backdrop-filter"), `${sel} -webkit-backdrop-filter`).toContain("var(--glass-filter)");
    }
  });

  it("G10: toda superficie de vidro (card, .glass, .glass-flat) declara borda E sombra (a separacao nao depende de uma so)", () => {
    for (const sel of [".card", ".glass", ".glass-flat"]) {
      const all = rulesFor(sel).map((r) => r.body).join(";");
      expect(all, `${sel} sem border`).toMatch(/\bborder\b\s*:|\bborder-(?:width|color)\b/);
      expect(all, `${sel} sem box-shadow`).toMatch(/\bbox-shadow\s*:/);
    }
  });

  it(".glass-flat (itens repetidos) usa --item-filter e .glass-bar usa --bar-bg com --glass-filter", () => {
    expect(prop(".glass-flat", "backdrop-filter")).toContain("var(--item-filter)");
    expect(prop(".glass-flat", "background")).toContain("var(--card-bg)");
    expect(prop(".glass-bar", "background")).toContain("var(--bar-bg)");
    expect(prop(".glass-bar", "backdrop-filter")).toContain("var(--glass-filter)");
    expect(prop(".glass-bar", "-webkit-backdrop-filter")).toContain("var(--glass-filter)");
  });

  it(".field usa --field-bg com desfoque; desabilitado e somente leitura voltam a --surface-2 sem desfoque (PA3)", () => {
    expect(prop(".field", "background")).toContain("var(--field-bg)");
    expect(prop(".field", "backdrop-filter")).toContain("var(--glass-filter)");
    for (const sel of [".field:disabled", ".field[readonly]"]) {
      expect(prop(sel, "background"), sel).toContain("var(--surface-2)");
      expect(prop(sel, "backdrop-filter"), sel).toContain("none");
    }
  });

  it(".checkbox::before continua opaco com --input-bg (PA3)", () => {
    expect(prop(".checkbox::before", "background")).toContain("var(--input-bg)");
  });

  it(".row-selected e .row-highlight usam a variante 2 translucida (--card-bg-2), nao --surface-2 fixo", () => {
    for (const sel of [".row-selected", ".row-highlight"]) {
      expect(prop(sel, "background"), sel).toContain("var(--card-bg-2)");
    }
  });

  it("superficies opacas nao usam backdrop-filter: .drawer, .modal, .page-bg-window (CA13), .skeleton, .chip e dialog", () => {
    for (const sel of [".drawer", ".modal", ".page-bg-window", ".skeleton", ".chip", "dialog"]) {
      const all = rulesFor(sel).map((r) => r.body).join(";");
      expect(all, sel).not.toMatch(/backdrop-filter/);
    }
    // .drawer e .modal seguem com --surface (alfa 1) e .page-bg-window com o gradiente opaco
    expect(prop(".drawer", "background")).toContain("var(--surface)");
    expect(prop(".modal", "background")).toContain("var(--surface)");
  });

  it("option continua opaco: lista nativa do select desenhada pelo SO (CA04)", () => {
    expect(prop("option", "background")).toContain("var(--surface)");
  });

  it("nenhuma regra de vidro usa animation/transition (RNF06)", () => {
    for (const sel of glassRules) expect(rulesFor(sel).map((r) => r.body).join(";"), sel).not.toMatch(/\btransition\b|\banimation\b/);
  });

  it("--color-header saiu do @theme; entram card, card-2, field, bar e card-border; existe o utilitario backdrop-glass", () => {
    const raw = read("app/globals.css");
    expect(raw).not.toMatch(/--color-header|--header-bg|bg-header/);
    for (const [name, role] of [["--color-card", "--card-bg"], ["--color-card-2", "--card-bg-2"], ["--color-field", "--field-bg"], ["--color-bar", "--bar-bg"], ["--color-card-border", "--card-border"]]) {
      expect(raw, name).toMatch(new RegExp(`${name}\\s*:\\s*var\\(${role}\\)`));
    }
    expect(raw).toMatch(/@utility\s+backdrop-glass\s*\{[^}]*backdrop-filter\s*:\s*var\(--glass-filter\)/);
  });
});

// ---------------------------------------------------------------------------
// marcacao
// ---------------------------------------------------------------------------
function walk(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    if (name === "node_modules" || name === ".next") return [];
    const full = join(dir, name);
    if (statSync(full).isDirectory()) return walk(full);
    return /\.(tsx|ts)$/.test(name) && !/\.(spec|test|pw)\.[a-z]+$/.test(name) ? [full] : [];
  });
}
const sources = ["app", "components"].flatMap((d) => walk(join(ROOT, d)));
const src = (path: string) => readFileSync(join(ROOT, path), "utf8");
const lineWith = (path: string, needle: string | RegExp): string => {
  const line = src(path).split("\n").find((l) => (typeof needle === "string" ? l.includes(needle) : needle.test(l)));
  if (line === undefined) throw new Error(`${path}: linha com ${String(needle)} nao encontrada`);
  return line;
};
const GLASS_CLASS = /(?<![\w-])(?:glass|glass-flat|glass-bar|backdrop-glass|bg-card|bg-card-2|bg-field|bg-bar)(?![\w-])/;
const SURFACE_UTILITY = /(?<![\w-])(?:hover:|focus:)?bg-surface(?:-2|-active)?(?![\w-])/;

describe("marcacao - utilitarios e classes de componente (R8)", () => {
  it("nenhum arquivo usa bg-header nem backdrop-blur-md (a navbar usa glass-bar)", () => {
    const offenders = sources.filter((f) => /\bbg-header\b|\bbackdrop-blur/.test(readFileSync(f, "utf8"))).map((f) => relative(ROOT, f));
    expect(offenders).toEqual([]);
  });

  it("nenhuma classe de componente usada como variante de breakpoint (md:card, lg:field, sm:btn...), que nao gera nada", () => {
    const re = new RegExp(`(?<![\\w-])(?:sm|md|lg|xl|2xl):(?:${COMPONENT_CLASSES.join("|")})(?![\\w-])`);
    const offenders = sources.filter((f) => re.test(readFileSync(f, "utf8"))).map((f) => relative(ROOT, f));
    expect(offenders).toEqual([]);
  });

  it("nenhum elemento tenta anular .card com utilitarios (card + bg-/border-0/shadow-none no mesmo className)", () => {
    const offenders: string[] = [];
    for (const f of sources) {
      for (const m of readFileSync(f, "utf8").matchAll(/className=(?:"([^"]*)"|\{`([^`]*)`\})/g)) {
        const value = m[1] ?? m[2];
        if (/(?<![\w-])card(?![\w-])/.test(value) && /(?:^|\s)(?:\w+:)?(?:bg-transparent|border-0|shadow-none)(?![\w-])/.test(value)) offenders.push(`${relative(ROOT, f)}: ${value.slice(0, 80)}`);
      }
    }
    expect(offenders).toEqual([]);
  });
});

describe("marcacao - superficies opacas continuam opacas (RF05, CA05)", () => {
  const OPAQUE_FILES = ["components/ui/combobox.tsx", "components/month-picker.tsx", "components/ui/toast.tsx", "components/ui/drawer.tsx", "components/ui/bottom-sheet.tsx", "components/ui/modal-dialog.tsx"];
  it.each(OPAQUE_FILES)("%s nao usa glass/backdrop-glass/bg-card/bg-bar", (file) => {
    expect(GLASS_CLASS.test(src(file)), `${file} ganhou vidro`).toBe(false);
  });

  it("a lista do combobox, a grade do seletor de mes e o toast mantem bg-surface/bg-surface-2", () => {
    expect(lineWith("components/ui/combobox.tsx", 'role="listbox"') + lineWith("components/ui/combobox.tsx", "absolute inset-x-0 top-full")).toMatch(/bg-surface\b/);
    expect(lineWith("components/month-picker.tsx", "absolute left-0 top-full")).toMatch(/bg-surface\b/);
    expect(lineWith("components/ui/toast.tsx", "bg-surface-2")).toBeTruthy();
  });

  it("a pilula 'Sem lancamentos de...' do grafico e o link 'Pular para o conteudo' continuam opacos", () => {
    const pill = lineWith("app/(app)/dashboard/_components/monthly-chart.tsx", "pointer-events-none absolute inset-x-0 top-1/2");
    expect(pill).toMatch(/bg-surface\b/);
    expect(GLASS_CLASS.test(pill)).toBe(false);
    expect(lineWith("components/app-header.tsx", 'href="#conteudo"')).toMatch(/focus:bg-surface\b/);
  });
});

describe("marcacao - superficies de vidro (RF01-RF04, B1, B4)", () => {
  it("a navbar usa glass-bar (vidro de barra), sem bg-surface; a 2a linha mobile segue sem fundo", () => {
    const nav = lineWith("components/app-header.tsx", "data-navbar");
    expect(nav).toMatch(/(?<![\w-])glass-bar(?![\w-])/);
    expect(nav).not.toMatch(SURFACE_UTILITY);
    const second = src("components/app-header.tsx").split("\n").find((l) => l.includes("sm:hidden") && l.includes("border-b"));
    expect(second).toBeDefined();
    expect(second).not.toMatch(/\bbg-/);
  });

  it.each(["app/(app)/entries/_components/expenses-list.tsx", "app/(app)/entries/_components/income-panel.tsx"])("%s: thead em glass-bar, linhas sem fundo proprio, EntryItem em glass-flat, tabela em contêiner glass-flat", (file) => {
    const thead = lineWith(file, "<thead");
    expect(thead).toMatch(/(?<![\w-])glass-bar(?![\w-])/);
    expect(thead).not.toMatch(SURFACE_UTILITY);
    const row = lineWith(file, "<EntryRow");
    expect(row, "linha da tabela sem fundo proprio").not.toMatch(SURFACE_UTILITY);
    const item = lineWith(file, "<EntryItem");
    expect(item).toMatch(/(?<![\w-])glass-flat(?![\w-])/);
    expect(item).not.toMatch(SURFACE_UTILITY);
    expect(src(file)).toMatch(/glass-flat[^"`]*overflow-clip|overflow-clip[^"`]*glass-flat/);
  });

  it("expenses-list: toolbar de selecao em glass, barra de lote mobile em glass-bar, item selecionado com bg-card-2", () => {
    const file = "app/(app)/entries/_components/expenses-list.tsx";
    const toolbar = lineWith(file, "hidden min-h-12");
    expect(toolbar).toMatch(/(?<![\w-])glass(?![\w-])/);
    expect(toolbar).not.toMatch(SURFACE_UTILITY);
    const bulk = lineWith(file, "fixed inset-x-0 bottom-0");
    expect(bulk).toMatch(/(?<![\w-])glass-bar(?![\w-])/);
    expect(bulk).not.toMatch(SURFACE_UTILITY);
    expect(lineWith(file, "<EntryItem")).toMatch(/bg-card-2/);
  });

  it("invoice-block: bloco em glass com border-border-strong; totais do mobile sem fundo (sem vidro sobre vidro); alerta interno sem bg-surface", () => {
    const file = "app/(app)/entries/_components/invoice-block.tsx";
    const block = lineWith(file, 'role="group"');
    expect(block).toMatch(/(?<![\w-])glass(?![\w-])/);
    expect(block).toMatch(/border-border-strong/);
    expect(block).not.toMatch(SURFACE_UTILITY);
    expect(lineWith(file, "<dl ")).not.toMatch(SURFACE_UTILITY);
    expect(lineWith(file, 'role="alert"')).not.toMatch(SURFACE_UTILITY);
  });

  it("tab-subtotal: vidro da variante 2 (glass + bg-card-2), sem bg-surface-2", () => {
    const line = lineWith("app/(app)/entries/_components/tab-subtotal.tsx", 'data-testid="subtotal"');
    expect(line).toMatch(/(?<![\w-])glass(?![\w-])/);
    expect(line).toMatch(/bg-card-2/);
    expect(line).not.toMatch(SURFACE_UTILITY);
  });

  it("InlineAlert: glass (opaco so em contexto opaco, por heranca de papel), sem bg-surface/shadow-card no JSX", () => {
    const line = lineWith("components/ui/states.tsx", "border-l-[3px]");
    expect(line).toMatch(/(?<![\w-])glass(?![\w-])/);
    expect(line).not.toMatch(SURFACE_UTILITY);
  });
});

describe("marcacao - graficos (TQ8, R6)", () => {
  it.each(["app/(app)/dashboard/_components/monthly-chart.tsx", "app/(app)/dashboard/_components/category-donut.tsx"])("%s usa var(--chart-sep) e nenhum var(--surface) como separador", (file) => {
    const text = src(file);
    expect(text).not.toMatch(/var\(--surface\)/);
    expect(text).toContain("var(--chart-sep)");
  });

  it("monthly-chart: colunas sticky da tabela do grafico em bg-bar (sem desfoque), nao bg-surface", () => {
    const text = src("app/(app)/dashboard/_components/monthly-chart.tsx");
    const sticky = text.split("\n").filter((l) => l.includes("<th") && l.includes("sticky left-0"));
    expect(sticky.length).toBeGreaterThanOrEqual(2);
    for (const l of sticky) {
      expect(l).toMatch(/(?<![\w-])bg-bar(?![\w-])/);
      expect(l).not.toMatch(SURFACE_UTILITY);
      expect(l).not.toMatch(/backdrop/);
    }
  });
});
