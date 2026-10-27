// @vitest-environment node
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative, resolve } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * Remocao da pre-visualizacao do fundo (CA21, CA22, RNF10, ADR 0003 T11). Os nomes procurados sao montados em tempo de
 * execucao para que ESTE arquivo nao seja um residuo do que ele proprio procura.
 */
const ROOT = resolve(__dirname, "..");
const ROUTE = ["background", "preview"].join("-");
const ENV_VAR = ["BACKGROUND", "PREVIEW"].join("_");
// ids de preset (CA22/RNF10), montados em tempo de execucao: `package-lock.json` fica fora (a dependencia decimal.js-light casa com o padrao)
const PRESET_ID = new RegExp(String.raw`\b(${["light", "dark"].join("|")})-[1-6]\b`);
const SKIP = new Set(["node_modules", ".next", "coverage", "playwright-report", "test-results", "package-lock.json"]);

function walk(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    if (SKIP.has(name)) return [];
    const full = join(dir, name);
    if (statSync(full).isDirectory()) return walk(full);
    return /\.(tsx?|css|mjs|js|json)$/.test(name) ? [full] : [];
  });
}

describe("CA21/CA22 - pre-visualizacao removida", () => {
  it("a rota (app)/<preview>/ nao existe mais", () => {
    expect(existsSync(join(ROOT, "app", "(app)", ROUTE))).toBe(false);
  });

  it("o e2e proprio da pre-visualizacao nao existe mais", () => {
    expect(existsSync(join(ROOT, "e2e", `${ROUTE}.pw.ts`))).toBe(false);
  });

  it("playwright.config.ts nao habilita a rota (sem a variavel de ambiente temporaria)", () => {
    expect(readFileSync(join(ROOT, "playwright.config.ts"), "utf8")).not.toContain(ENV_VAR);
  });

  it("no-literal-colors.spec.ts nao tem excecao para os presets", () => {
    const src = readFileSync(join(ROOT, "test", "no-literal-colors.spec.ts"), "utf8");
    expect(src).not.toContain("presets.ts");
    expect(src).not.toContain("_preview");
    expect(src).not.toContain(ROUTE);
  });

  it("nenhum arquivo de web/ (codigo, testes, configuracao) cita a rota ou a variavel de ambiente e nenhum id de preset", () => {
    const offenders = walk(ROOT).flatMap((file) => {
      const src = readFileSync(file, "utf8");
      const hits = [src.includes(ROUTE) && "rota", src.includes(ENV_VAR) && "variavel", PRESET_ID.test(src) && "id de preset"].filter(Boolean);
      return hits.length ? [`${relative(ROOT, file)}: ${hits.join(", ")}`] : [];
    });
    expect(offenders).toEqual([]);
  });
});
