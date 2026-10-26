// @vitest-environment node
import { spawnSync } from "node:child_process";
import { chmodSync, existsSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * T1 (ADR 0002): `web/scripts/pw-deps.sh` prepara o Chromium do Playwright sem root. Aqui so se verifica o que e
 * deterministico e sem rede/root: contrato dos subcomandos, montagem do LD_LIBRARY_PATH em `run`, diretorio padrao,
 * propagacao do codigo de saida e a promessa de nao escrever em ~/.bashrc. `install` e `check` dependem do ambiente.
 */
const script = resolve(__dirname, "pw-deps.sh");
const sh = (args: string[], env: Record<string, string | undefined> = {}) =>
  spawnSync("bash", [script, ...args], { encoding: "utf8", env: { PATH: process.env.PATH, ...env } as unknown as NodeJS.ProcessEnv });

describe("web/scripts/pw-deps.sh", () => {
  it("existe e tem sintaxe bash valida", () => {
    expect(existsSync(script)).toBe(true);
    expect(spawnSync("bash", ["-n", script]).status).toBe(0);
  });

  it("usa `set -euo pipefail` e nunca escreve em ~/.bashrc", () => {
    const text = readFileSync(script, "utf8");
    expect(text).toMatch(/set -euo pipefail/);
    expect(text).not.toMatch(/>>\s*["']?(~|\$HOME)\/\.bashrc/);
  });

  it("extracao robusta (ADR T1): falha no download aborta, so .deb reais, marcador so no sucesso, tmp sempre limpo", () => {
    const text = readFileSync(script, "utf8");
    expect(text).toMatch(/apt-get download "\$pkg" \|\| exit 1/);
    expect(text).toMatch(/shopt -s nullglob/);
    expect(text).toMatch(/\$\{#debs\[@\]\}" -gt 0/);
    expect(text).toMatch(/trap 'rm -rf "\$tmp"' EXIT/);
    expect(text.indexOf("dpkg -x")).toBeLessThan(text.indexOf('>"$PW_DEPS_DIR/.pkgs/$pkg"'));
    expect(text).toMatch(/local -a options/);
  });

  it("mapeia lib -> pacote e so extrai o que o ldd acusou (sem lista fixa de pacotes)", () => {
    const text = readFileSync(script, "utf8");
    expect(text).toContain('["libnss3.so"]="libnss3"');
    expect(text).toContain('["libnspr4.so"]="libnspr4"');
    expect(text).toContain('["libasound.so.2"]="libasound2t64|libasound2"');
    expect(text).not.toMatch(/BASE_PACKAGES/);
  });

  it("sem subcomando (ou desconhecido) falha com uso que lista install, check e run", () => {
    for (const args of [[], ["bogus"]]) {
      const result = sh(args);
      expect(result.status).not.toBe(0);
      const out = `${result.stdout}${result.stderr}`;
      for (const word of ["install", "check", "run"]) expect(out).toContain(word);
    }
  });

  it("`run` exporta LD_LIBRARY_PATH com as duas pastas do PW_DEPS_DIR na frente do valor anterior", () => {
    const dir = mkdtempSync(join(tmpdir(), "pwdeps-"));
    const result = sh(["run", "sh", "-c", "printf %s \"$LD_LIBRARY_PATH\""], { PW_DEPS_DIR: dir, LD_LIBRARY_PATH: "/previo" });
    expect(result.status).toBe(0);
    expect(result.stdout).toBe(`${dir}/usr/lib/x86_64-linux-gnu:${dir}/lib/x86_64-linux-gnu:/previo`);
  });

  it("`run` sem LD_LIBRARY_PATH anterior nao deixa ':' sobrando no fim", () => {
    const dir = mkdtempSync(join(tmpdir(), "pwdeps-"));
    const result = sh(["run", "sh", "-c", "printf %s \"$LD_LIBRARY_PATH\""], { PW_DEPS_DIR: dir });
    expect(result.stdout).toBe(`${dir}/usr/lib/x86_64-linux-gnu:${dir}/lib/x86_64-linux-gnu`);
  });

  it("diretorio padrao: ${XDG_CACHE_HOME}/finance-pw-deps, fora do repositorio", () => {
    const cache = mkdtempSync(join(tmpdir(), "xdg-"));
    const result = sh(["run", "sh", "-c", "printf %s \"$LD_LIBRARY_PATH\""], { XDG_CACHE_HOME: cache, HOME: cache });
    expect(result.stdout.startsWith(`${cache}/finance-pw-deps/usr/lib/x86_64-linux-gnu`)).toBe(true);
  });

  it("`run` propaga o codigo de saida do comando e nao escreve ~/.bashrc", () => {
    const home = mkdtempSync(join(tmpdir(), "home-"));
    const result = sh(["run", "sh", "-c", "exit 7"], { HOME: home, PW_DEPS_DIR: join(home, "deps") });
    expect(result.status).toBe(7);
    expect(existsSync(join(home, ".bashrc"))).toBe(false);
  });

  it("install: se `dpkg -x` falha, o marcador .pkgs/<pkg> NAO e gravado", () => {
    const root = mkdtempSync(join(tmpdir(), "pwdeps-fail-"));
    const bin = join(root, "bin");
    const deps = join(root, "deps");
    const browsers = join(root, "browsers");
    const chrome = join(browsers, "chromium-1", "chrome-linux64");
    mkdirSync(bin);
    mkdirSync(chrome, { recursive: true });
    const fake = (dir: string, name: string, body: string) => {
      writeFileSync(join(dir, name), `#!/bin/sh\n${body}\n`);
      chmodSync(join(dir, name), 0o755);
    };
    fake(chrome, "chrome", "exit 0");
    fake(bin, "npx", "exit 0");
    fake(bin, "ldd", "echo '\tlibnss3.so => not found'");
    fake(bin, "apt-cache", "exit 0");
    fake(bin, "apt-get", ': >"fake_1_amd64.deb"');
    fake(bin, "dpkg", "echo 'dpkg falhou' >&2; exit 1");
    const result = sh(["install"], {
      PATH: `${bin}:${process.env.PATH}`,
      PW_DEPS_DIR: deps,
      PLAYWRIGHT_BROWSERS_PATH: browsers,
      HOME: root,
    });
    expect(`${result.stdout}${result.stderr}`).toContain("falha ao extrair libnss3");
    expect(existsSync(join(deps, ".pkgs", "libnss3"))).toBe(false);
  });

  it("package.json expoe pw:deps e test:e2e:local; test:e2e continua puro", () => {
    const pkg = JSON.parse(readFileSync(resolve(__dirname, "../package.json"), "utf8")) as { scripts: Record<string, string> };
    expect(pkg.scripts["pw:deps"]).toBe("bash scripts/pw-deps.sh install && bash scripts/pw-deps.sh check");
    expect(pkg.scripts["test:e2e:local"]).toBe("bash scripts/pw-deps.sh run playwright test");
    expect(pkg.scripts["test:e2e"]).toBe("playwright test");
  });
});
