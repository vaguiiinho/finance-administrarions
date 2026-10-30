import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { describe, expect, it } from "vitest";

// RF06 / CA07: nao existe cadastro publico no web. Varre o codigo-fonte (nao os testes) por rota, componente e texto.
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
const files = [...walk(join(ROOT, "app")), ...walk(join(ROOT, "components")), ...walk(join(ROOT, "features")), ...walk(join(ROOT, "lib"))];
const source = files.filter((f) => /\.(ts|tsx)$/.test(f) && !/\.spec\.tsx?$/.test(f));

describe("sem cadastro publico (RF06, CA07)", () => {
  it("nao existe diretorio de rota `register`", () => {
    expect(files.filter((f) => /[\\/]register[\\/]/.test(relative(ROOT, f)))).toEqual([]);
  });
  it("nenhuma tela mostra 'Criar conta' e nao ha registerAction/RegisterForm/DemoInvite", () => {
    const hits = source.filter((f) => /Criar conta|registerAction|RegisterForm|DemoInvite|WriteAction/.test(readFileSync(f, "utf8"))).map((f) => relative(ROOT, f));
    expect(hits).toEqual([]);
  });
});
