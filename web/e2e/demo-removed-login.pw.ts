import AxeBuilder from "@axe-core/playwright";
import { STUB_USERS, banner, expect, openLogin, setScenario, setThemeCookie, signIn, test } from "./auth-support";

/**
 * Fim da demonstracao publica e entrada sempre pelo login (spec remover-demo-publica-login, ADR 0013 11.5).
 * CA06, CA07, CA08, CA09, CA10, CA12, CA13, CA14, CA16. Roda contra o stub (alias `demo` no login, sem /api/demo/*) com
 * DEMO_ACCOUNT_HINT=on no web (playwright.config.ts).
 */
test.use({ actionTimeout: 5_000 });
test.beforeEach(async () => {
  await setScenario("default");
});
const { ana } = STUB_USERS;
const DEMO_PATHS = ["/demo", "/demo/entries", "/demo/dashboard", "/demo/cards", "/demo/entries?month=2026-11", "/demo/qualquer"];

test.describe("CA06/CA07: raiz", () => {
  test("CA06: / sem sessao -> /login, sem passar por /demo/*", async ({ page }) => {
    const visited: string[] = [];
    page.on("framenavigated", (f) => void (f === page.mainFrame() && visited.push(new URL(f.url()).pathname)));
    await page.goto("/");
    await expect(page).toHaveURL(/\/login$/);
    expect(visited.some((p) => p.startsWith("/demo"))).toBe(false);
    await expect(page.getByRole("heading", { level: 1, name: "Entrar" })).toBeVisible();
  });

  test("CA07: / com sessao -> /entries", async ({ page }) => {
    await signIn(page, "ana");
    await page.goto("/");
    expect(new URL(page.url()).pathname).toBe("/entries");
  });
});

test.describe("CA08: rota protegida sem sessao", () => {
  test("/dashboard?month=2026-11 -> /login?next=... e, depois de entrar, volta ao dashboard com o mes", async ({ page }) => {
    await page.goto("/dashboard?month=2026-11");
    await expect(page).toHaveURL(/\/login\?next=%2Fdashboard%3Fmonth%3D2026-11/);
    await page.waitForLoadState("networkidle");
    await page.getByLabel("E-mail").fill(ana.email);
    await page.getByLabel("Senha", { exact: true }).fill(ana.password);
    await page.getByRole("button", { name: "Entrar", exact: true }).click();
    await page.waitForURL(/\/dashboard\?month=2026-11/);
  });
});

test.describe("CA09: telas de demonstracao nao existem", () => {
  for (const path of DEMO_PATHS) {
    test(`${path}: sem sessao -> pagina 404 do web, sem dados de exemplo`, async ({ page }) => {
      const response = await page.goto(path);
      expect(response?.status()).toBe(404);
      expect(new URL(page.url()).pathname.startsWith("/demo")).toBe(true); // nao redireciona para o login (P04)
      await expect(page.getByText("Cartão Demo")).toHaveCount(0);
      await expect(page.getByText("Você está vendo dados de exemplo.")).toHaveCount(0);
    });
  }

  test("com sessao tambem 404 e nenhum selo 'Demonstração' nem botao 'Entrar' no cabecalho", async ({ authenticatedPage }) => {
    const page = await authenticatedPage("ana");
    const response = await page.goto("/demo/entries");
    expect(response?.status()).toBe(404);
    await expect(banner(page).getByText("Demonstração")).toHaveCount(0);
    await expect(banner(page).getByRole("link", { name: "Entrar" })).toHaveCount(0);
  });
});

test.describe("CA10/CA16: tela de login com a dica", () => {
  test("rotulo 'E-mail ou usuario', dica, orientacao e nenhum link para /demo", async ({ page }) => {
    await openLogin(page);
    await expect(page.getByLabel("E-mail ou usuário")).toBeVisible();
    await expect(page.getByLabel("Senha", { exact: true })).toBeVisible();
    await expect(page.getByRole("button", { name: "Entrar", exact: true })).toBeVisible();
    await expect(page.getByText("Não tem acesso ou esqueceu a senha? Fale com um administrador.")).toBeVisible();
    const note = page.getByRole("note", { name: "Conta de demonstração" });
    await expect(note).toBeVisible();
    await expect(note).toContainText("Para testar, use o usuário demo e a senha demo.");
    await expect(page.getByText("Ver demonstração")).toHaveCount(0);
    await expect(page.locator("a[href^='/demo']")).toHaveCount(0);
  });

  test("a dica vem depois do botao 'Entrar' e nao entra na ordem de tabulacao", async ({ page }) => {
    await openLogin(page);
    const note = page.getByRole("note", { name: "Conta de demonstração" });
    const submitBox = (await page.getByRole("button", { name: "Entrar", exact: true }).boundingBox())!;
    const noteBox = (await note.boundingBox())!;
    expect(noteBox.y).toBeGreaterThan(submitBox.y);
    const focusables = await note.locator("a, button, input, [tabindex]").count();
    expect(focusables).toBe(0);
    await page.keyboard.press("Tab");
    expect(await page.evaluate(() => document.activeElement?.closest("[role='note']") === null)).toBe(true);
  });

  for (const theme of ["light", "dark"] as const) {
    test(`CA16: sem violacoes de acessibilidade/contraste (axe) no tema ${theme}`, async ({ page }) => {
      await setThemeCookie(page.context(), theme);
      await openLogin(page);
      await expect(page.getByRole("note", { name: "Conta de demonstração" })).toBeVisible();
      const results = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"]).analyze();
      expect(results.violations.map((v) => `${v.id}: ${v.nodes.length}`)).toEqual([]);
    });
  }
});

test.describe("CA12/CA13/CA14: login com a credencial da dica", () => {
  const fill = async (page: import("@playwright/test").Page, id: string, password: string) => {
    await page.getByLabel("E-mail ou usuário").fill(id);
    await page.getByLabel("Senha", { exact: true }).fill(password);
    await page.getByRole("button", { name: "Entrar", exact: true }).click();
  };

  for (const id of ["demo", "Demo", " demo "]) {
    test(`CA12: ${JSON.stringify(id)} + demo entra e chega a /entries como 'Conta de demonstração'`, async ({ page }) => {
      await openLogin(page);
      await page.waitForLoadState("networkidle");
      await fill(page, id, "demo");
      await page.waitForURL(/\/entries/);
      await expect(page.getByRole("button", { name: "Conta de Conta de demonstração" })).toBeVisible();
    });
  }

  test("CA12: com `next`, entra e volta ao destino", async ({ page }) => {
    await openLogin(page, "?next=/cards");
    await page.waitForLoadState("networkidle");
    await fill(page, "demo", "demo");
    await page.waitForURL(/\/cards/);
  });

  test("CA13: o e-mail canonico + demo continua entrando", async ({ page }) => {
    await openLogin(page);
    await page.waitForLoadState("networkidle");
    await fill(page, "demo@showcase.invalid", "demo");
    await page.waitForURL(/\/entries/);
  });

  for (const id of ["admin", "ana", "demo2"]) {
    test(`CA14: ${id} + qualquer senha -> banner 'E-mail ou senha inválidos.', continua no login e a dica segue visivel`, async ({ page }) => {
      await openLogin(page);
      await page.waitForLoadState("networkidle");
      await fill(page, id, "demo");
      await expect(page.getByRole("alert")).toHaveText("E-mail ou senha inválidos.");
      await expect(page).toHaveURL(/\/login/);
      await expect(page.getByRole("note", { name: "Conta de demonstração" })).toBeVisible();
    });
  }
});
