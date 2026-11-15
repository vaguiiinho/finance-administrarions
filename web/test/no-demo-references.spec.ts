import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { describe, expect, it } from "vitest";

// ADR 0013 11.5, RF02, RF03: a demonstracao publica sai do web inteira. Varre o codigo de producao (nao os testes) e a
// estrutura de rotas: nenhum link, rota, componente ou helper do modo demo.
const ROOT = join(__dirname, "..");
function walk(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    if (["node_modules", ".next", "test-results", "e2e"].includes(name)) continue;
    const full = join(dir, name);
    if (statSync(full).isDirectory()) walk(full, out);
    else out.push(full);
  }
  return out;
}
const all = ["app", "components", "features", "lib"].flatMap((d) => walk(join(ROOT, d)));
const source = all.filter((f) => /\.(ts|tsx)$/.test(f) && !/\.spec\.tsx?$/.test(f));
const rel = (f: string) => relative(ROOT, f);
const read = (f: string) => readFileSync(f, "utf8");

describe("sem demonstracao publica no web (RF02, RF03, CA09, CA10)", () => {
  it("nao existe nenhuma rota sob /demo (app/(public)/demo ou qualquer segmento `demo`)", () => {
    expect(all.filter((f) => /[\\/]app[\\/](.*[\\/])?demo[\\/]/.test(f)).map(rel)).toEqual([]);
  });

  it("nenhum codigo de producao referencia /demo (rotas, hrefs, redirects) nem /api/demo", () => {
    const hits = source.filter((f) => /["'`]\/demo(\/|["'`?#])|\/api\/demo|\(public\)\/demo/.test(read(f))).map(rel);
    expect(hits).toEqual([]);
  });

  it("nao ha texto 'Ver demonstração' nem faixa/selo de demonstracao em producao", () => {
    const hits = source.filter((f) => /Ver demonstração|Você está vendo dados de exemplo|DemoBanner|DemoChip/.test(read(f))).map(rel);
    expect(hits).toEqual([]);
  });

  it("os arquivos do modo demo foram removidos (T6): app-mode, read-only, demo-banner*, demo-chip, sign-in-button, sign-in-href", () => {
    const names = all.map((f) => relative(ROOT, f));
    for (const gone of [
      "lib/app-mode.ts",
      "components/app-mode.tsx",
      "components/read-only.tsx",
      "components/demo-banner.tsx",
      "components/demo-banner-action.tsx",
      "components/demo-chip.tsx",
      "components/sign-in-button.tsx",
      "lib/auth/sign-in-href.ts",
    ]) {
      expect(names, gone).not.toContain(gone);
    }
  });

  it("nenhum codigo de producao usa AppMode/DEMO_MODE/PROTECTED_MODE/WriteOnly/basePath de demonstracao", () => {
    const hits = source.filter((f) => /\b(AppMode|AppModeProvider|useAppMode|DEMO_MODE|PROTECTED_MODE|WriteOnly|SignInButton|signInHref)\b/.test(read(f))).map(rel);
    expect(hits).toEqual([]);
  });

  it("o leitor de dados nao tem mais a variante demo: createFinanceReader('demo') e buildDemo() nao existem", () => {
    const reader = read(join(ROOT, "lib/api/finance-reader.ts"));
    expect(reader).not.toMatch(/buildDemo|["']demo["']|\/demo\//);
  });

  it("o rodape (AppFooter) nao oferece mais 'Ver demonstração' (showDemoLink)", () => {
    expect(read(join(ROOT, "components/app-footer.tsx"))).not.toMatch(/showDemoLink|demonstra/i);
  });

  it("a tela de login usa isDemoHintEnabled() (so no servidor) e renderiza DemoAccountHint; sem Link para /demo", () => {
    const page = read(join(ROOT, "app/(auth)/login/page.tsx"));
    expect(page).toContain("isDemoHintEnabled");
    expect(page).toContain("DemoAccountHint");
    // o caminho da rota /demo, nao imports como "@/lib/auth/demo-hint" ou "./demo-account-hint"
    expect(page).not.toMatch(/["'`]\/demo(\/|["'`?#])/);
  });

  it("a variavel DEMO_ACCOUNT_HINT nunca e NEXT_PUBLIC_ (so servidor, lida por requisicao)", () => {
    const hits = [...source, join(ROOT, ".env.example")].filter((f) => /NEXT_PUBLIC_DEMO/.test(read(f))).map(rel);
    expect(hits).toEqual([]);
  });
});
