import { execSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

// CA47 / RF45 / ADR 9.9: `NEXT_PUBLIC_API_URL` some do codigo, do Dockerfile e do workflow.
const WEB = join(__dirname, "..");
const REPO = join(WEB, "..");
const grep = (cwd: string, args: string) => {
  try {
    return execSync(`grep -rIl ${args}`, { cwd, encoding: "utf8" }).trim().split("\n").filter(Boolean);
  } catch {
    return [];
  }
};

describe("API nao exposta: NEXT_PUBLIC_API_URL removida (CA47)", () => {
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
