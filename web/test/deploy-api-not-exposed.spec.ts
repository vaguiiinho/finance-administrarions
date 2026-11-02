import { execSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

// ADR 0011 6.1 (revisa CA47/RF45/ADR 0005 9.9): a API passa a ser publicada pelo nginx (para o app), entao "a API nao e
// exposta" deixou de valer. O que continua valendo: o NAVEGADOR nunca chama a API (so o BFF, no servidor) e
// `NEXT_PUBLIC_API_URL` nao existe. Novo: o BFF usa o listener INTERNO do nginx (N3) via `API_URL`, e `/api/admin/*` e
// `/api/demo/*` so sao bloqueados no host publico (N4), nunca no listener interno que o web usa. O nginx fica fora do repo.
const WEB = join(__dirname, "..");
const REPO = join(WEB, "..");
const grep = (cwd: string, args: string) => {
  try {
    return execSync(`grep -rIl ${args}`, { cwd, encoding: "utf8" }).trim().split("\n").filter(Boolean);
  } catch {
    return [];
  }
};

describe("API chamada so pelo servidor do web: NEXT_PUBLIC_API_URL ausente (ADR 0011 6.1)", () => {
  it("web/Dockerfile nao tem ARG/ENV NEXT_PUBLIC_API_URL", () => {
    expect(readFileSync(join(WEB, "Dockerfile"), "utf8")).not.toContain("NEXT_PUBLIC_API_URL");
  });
  it("o workflow de deploy nao passa NEXT_PUBLIC_API_URL como build-arg", () => {
    expect(readFileSync(join(REPO, ".github/workflows/deploy.yml"), "utf8")).not.toContain("NEXT_PUBLIC_API_URL");
  });
  it("nenhum codigo-fonte do web usa NEXT_PUBLIC_API_URL (testes e .env.example incluidos)", () => {
    const hits = grep(WEB, `--exclude-dir=node_modules --exclude-dir=.next --exclude-dir=test-results --exclude=deploy-api-not-exposed.spec.ts --exclude=README.md NEXT_PUBLIC_API_URL .`);
    expect(hits).toEqual([]);
  });
  it("o bundle do cliente (.next/static) nao contem a variavel, quando existe build", () => {
    expect(grep(WEB, "NEXT_PUBLIC_API_URL .next/static")).toEqual([]);
  });
  it("API_URL e lida so no servidor: nenhum 'use client' importa lib/api/http", () => {
    const clientFiles = grep(WEB, `--include=*.tsx --include=*.ts --exclude-dir=node_modules --exclude-dir=.next -e '"use client"' app components features lib`);
    const offenders = clientFiles.filter((f) => /lib\/api\/(http|endpoints|identity-client|finance-reader)/.test(readFileSync(join(WEB, f), "utf8")));
    expect(offenders).toEqual([]);
  });
});

describe("Web chama a API pelo listener interno do nginx (ADR 0011 6.1 N3, N4)", () => {
  const envExample = readFileSync(join(WEB, ".env.example"), "utf8");
  it(".env.example documenta que API_URL aponta para o listener interno do nginx em producao", () => {
    expect(envExample).toMatch(/^API_URL=/m);
    expect(envExample).toMatch(/listener interno/i);
    expect(envExample).toMatch(/nginx/i);
  });
  it(".env.example avisa que o host publico bloqueia /api/admin/* e /api/demo/*, usados pelo web so pelo listener interno", () => {
    expect(envExample).toContain("/api/admin/");
    expect(envExample).toContain("/api/demo/");
  });
  it("a URL base da API vem so de API_URL (lib/api/api-url.ts); nenhum host de producao esta fixo no codigo do web", () => {
    expect(readFileSync(join(WEB, "lib/api/api-url.ts"), "utf8")).toContain("process.env.API_URL");
    const hardcoded = grep(WEB, `--include=*.ts --include=*.tsx --exclude-dir=node_modules --exclude-dir=.next --exclude-dir=e2e --exclude=*.spec.ts --exclude=*.spec.tsx --exclude=playwright.config.ts -E "https?://(api|[a-z0-9-]+\\.[a-z]{2,})/" app components features lib`);
    expect(hardcoded).toEqual([]);
  });
});
