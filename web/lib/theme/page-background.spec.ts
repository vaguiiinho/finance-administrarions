// @vitest-environment node
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative, resolve } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * Fundo em gradiente (ADR 0003 5.3, 5.6, 9.2; CA10-CA19): testes ESTATICOS do CSS e da marcacao.
 * Camada fixa `body::before`, `body` isolado, janela de fundo da faixa sticky, `.segmented`/`.tablist` transparentes
 * e nenhum `bg-bg` restante em app/ e components/.
 */
const ROOT = resolve(__dirname, "../..");
const globals = readFileSync(join(ROOT, "app/globals.css"), "utf8").replace(/\/\*[\s\S]*?\*\//g, "");

interface Rule {
  selector: string;
  body: string;
}
/** Regras de primeiro nivel e aninhadas em @media/@layer (suficiente para este CSS: sem seletores com `{` em strings). */
const rules: Rule[] = [...globals.matchAll(/([^{}]+)\{([^{}]*)\}/g)].map((m) => ({ selector: m[1].trim().replace(/\s+/g, " "), body: m[2] }));
const rulesFor = (selector: string) => rules.filter((r) => r.selector.split(",").map((s) => s.trim()).includes(selector));
const decl = (rule: Rule, prop: string): string | undefined => new RegExp(`(?:^|[;\\s])${prop}\\s*:\\s*([^;]+)`, "i").exec(rule.body)?.[1].trim();
const merged = (selector: string, prop: string): string[] => rulesFor(selector).map((r) => decl(r, prop)).filter((v): v is string => v !== undefined);

describe("body::before - camada fixa do gradiente (TQ3)", () => {
  it("existe exatamente uma regra body::before", () => {
    expect(rulesFor("body::before")).toHaveLength(1);
  });

  it("e fixa na viewport, atras do conteudo, sem capturar eventos", () => {
    const rule = rulesFor("body::before")[0];
    expect(decl(rule, "content")).toMatch(/^(""|'')$/);
    expect(decl(rule, "position")).toBe("fixed");
    expect(decl(rule, "inset")).toBe("0");
    expect(decl(rule, "z-index")).toBe("-1");
    expect(decl(rule, "pointer-events")).toBe("none");
  });

  it("pinta a cor base e a receita --bg-gradient", () => {
    const rule = rulesFor("body::before")[0];
    expect(decl(rule, "background-color")).toBe("var(--bg)");
    expect(decl(rule, "background-image")).toBe("var(--bg-gradient)");
  });

  it("e estatica: sem animation nem transition (B5, CA19)", () => {
    const rule = rulesFor("body::before")[0];
    expect(rule.body).not.toMatch(/\banimation\b|\btransition\b/);
    expect(globals).not.toMatch(/@keyframes[^{]*\b(bg|background|gradient)/i);
  });

  it("nao usa background-attachment: fixed no body/html (iOS e repaint)", () => {
    for (const sel of ["body", "html"]) for (const r of rulesFor(sel)) expect(r.body).not.toMatch(/background-attachment/);
  });
});

describe("body e html - cor base e contexto de empilhamento", () => {
  it("body: isolation isolate e background-color var(--bg) (a cor que os testes leem)", () => {
    const bodies = rulesFor("body");
    expect(bodies.length).toBeGreaterThan(0);
    expect(bodies.map((r) => decl(r, "isolation"))).toContain("isolate");
    const bg = bodies.map((r) => decl(r, "background-color") ?? decl(r, "background"));
    expect(bg).toContain("var(--bg)");
  });

  it("html continua pintando var(--bg) (canvas e overscroll)", () => {
    expect(rulesFor("html").map((r) => decl(r, "background-color") ?? decl(r, "background"))).toContain("var(--bg)");
  });
});

describe(".page-bg-window - janela de fundo da faixa sticky (5.6)", () => {
  it("pinta o MESMO gradiente com background-attachment: fixed sobre a cor base", () => {
    const rule = rulesFor(".page-bg-window");
    expect(rule, ".page-bg-window nao definida em globals.css").toHaveLength(1);
    expect(decl(rule[0], "background-attachment")).toBe("fixed");
    expect(decl(rule[0], "background-image")).toBe("var(--bg-gradient)");
    expect(decl(rule[0], "background-color")).toBe("var(--bg)");
  });

  it("e opaca: nao usa vidro (backdrop-filter) nem opacidade", () => {
    const rule = rulesFor(".page-bg-window")[0];
    expect(rule?.body ?? "").not.toMatch(/backdrop-filter|opacity/);
  });
});

describe(".segmented e .tablist - sem fundo chapado (R4)", () => {
  it.each([".segmented", ".tablist"])("%s tem background transparent e nunca var(--bg)", (selector) => {
    const backgrounds = merged(selector, "background");
    expect(backgrounds.length, `${selector} sem declaracao de background`).toBeGreaterThan(0);
    for (const value of backgrounds) expect(value).toBe("transparent");
    expect(merged(selector, "background-color").filter((v) => v !== "transparent")).toEqual([]);
  });

  it("var(--bg) so aparece em html, body, body::before, .page-bg-window (e no mapeamento @theme)", () => {
    const allowed = new Set(["html", "body", "body::before", ".page-bg-window"]);
    const offenders = rules
      .filter((r) => /var\(--bg\)/.test(r.body) && !r.selector.startsWith("@theme"))
      .filter((r) => !r.selector.split(",").every((s) => allowed.has(s.trim())))
      .map((r) => r.selector);
    expect(offenders).toEqual([]);
  });
});

function walk(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    if (name === "node_modules" || name === ".next") return [];
    const full = join(dir, name);
    if (statSync(full).isDirectory()) return walk(full);
    return /\.(tsx|ts|css)$/.test(name) && !/\.(spec|test|pw)\.[a-z]+$/.test(name) ? [full] : [];
  });
}
const productionFiles = ["app", "components"].flatMap((d) => walk(join(ROOT, d)));
const BG_UTILITY = new RegExp(["bg", "bg"].join("-") + "(?![\\w-])"); // o proprio spec nao pode conter a string procurada

describe("marcacao - faixas opacas (RF14, CA16)", () => {
  it("nenhum arquivo em app/ e components/ usa o utilitario de fundo opaco --bg", () => {
    const offenders = productionFiles.filter((f) => BG_UTILITY.test(readFileSync(f, "utf8"))).map((f) => relative(ROOT, f));
    expect(offenders).toEqual([]);
  });

  it("faixa de abas de /entries usa .page-bg-window (e e sticky abaixo da navbar)", () => {
    const src = readFileSync(join(ROOT, "app/(app)/entries/_components/entries-tabs-bar.tsx"), "utf8");
    expect(src).toMatch(/className="[^"]*\bpage-bg-window\b/);
    expect(src).toMatch(/\bsticky\b/);
    expect(src).toMatch(/border-b border-border/);
  });

  it("2a linha da navbar no mobile fica sem fundo e mantem a borda inferior", () => {
    const src = readFileSync(join(ROOT, "components/app-header.tsx"), "utf8");
    const line = src.split("\n").find((l) => l.includes("sm:hidden") && l.includes("border-b"));
    expect(line, "linha mobile da navbar nao encontrada").toBeDefined();
    expect(line).toContain("border-border");
    expect(line).not.toMatch(/\bbg-/);
  });
});

describe("cobertura de todas as rotas (CA18)", () => {
  it("global-error.tsx importa globals.css, que define body::before (mesmo gradiente em erro global)", () => {
    expect(readFileSync(join(ROOT, "app/global-error.tsx"), "utf8")).toMatch(/import\s+["']\.\/globals\.css["']/);
  });

  it("layout raiz importa globals.css (cobre loading.tsx e error.tsx)", () => {
    expect(readFileSync(join(ROOT, "app/layout.tsx"), "utf8")).toMatch(/import\s+["']\.\/globals\.css["']/);
  });
});
