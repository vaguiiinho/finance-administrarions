import { expect, test } from "@playwright/test";
import { BG, ENTRIES_URL, bodyBackground, htmlTheme, setScenario, setThemeCookie, themeToggle } from "./support";

test.beforeEach(async () => {
  await setScenario("default");
});

test.describe("CA78 - alternar tema", () => {
  test("clique alterna sem recarregar, muda aria-pressed, mantem aria-label e o foco", async ({ context, page }) => {
    await setThemeCookie(context, "dark");
    await page.goto(ENTRIES_URL);
    const toggle = themeToggle(page);
    await expect(toggle).toHaveAttribute("aria-pressed", "true");
    await page.evaluate(() => ((window as unknown as { __marker: number }).__marker = 1));
    await toggle.click();
    await expect(toggle).toHaveAttribute("aria-pressed", "false");
    await expect(toggle).toHaveAttribute("aria-label", "Tema escuro");
    await expect(toggle).toBeFocused();
    expect(await page.evaluate(() => (window as unknown as { __marker?: number }).__marker)).toBe(1); // sem reload
    expect(await htmlTheme(page)).toBe("light");
    expect(await bodyBackground(page)).toBe(BG.light);
  });

  for (const key of ["Enter", "Space"]) {
    test(`teclado (${key}) alterna e o foco permanece`, async ({ context, page }) => {
      await setThemeCookie(context, "dark");
      await page.goto(ENTRIES_URL);
      const toggle = themeToggle(page);
      await toggle.focus();
      await page.keyboard.press(key);
      await expect(toggle).toHaveAttribute("aria-pressed", "false");
      await expect(toggle).toBeFocused();
    });
  }

  test("alvo do botao >= 44x44", async ({ page }) => {
    await page.goto(ENTRIES_URL);
    const box = await themeToggle(page).boundingBox();
    expect(box!.width).toBeGreaterThanOrEqual(44);
    expect(box!.height).toBeGreaterThanOrEqual(44);
  });
});

test.describe("CA79 - sem preferencia segue o sistema, ao vivo", () => {
  for (const scheme of ["light", "dark"] as const) {
    test(`sistema ${scheme}`, async ({ page }) => {
      await page.emulateMedia({ colorScheme: scheme });
      await page.goto(ENTRIES_URL);
      expect(await bodyBackground(page)).toBe(BG[scheme]);
    });
  }

  test("muda com a pagina aberta", async ({ page }) => {
    await page.emulateMedia({ colorScheme: "light" });
    await page.goto(ENTRIES_URL);
    expect(await bodyBackground(page)).toBe(BG.light);
    await page.emulateMedia({ colorScheme: "dark" });
    await expect.poll(() => bodyBackground(page)).toBe(BG.dark);
  });
});

test.describe("CA80 - preferencia persistida", () => {
  test("claro salvo + sistema escuro: recarregar, outra rota e novo contexto mantem o claro", async ({ browser }) => {
    const context = await browser.newContext({ colorScheme: "dark" });
    await setThemeCookie(context, "light");
    const page = await context.newPage();
    await page.goto(ENTRIES_URL);
    expect(await bodyBackground(page)).toBe(BG.light);
    await page.reload();
    expect(await bodyBackground(page)).toBe(BG.light);
    await page.goto("/cards");
    expect(await bodyBackground(page)).toBe(BG.light);
    await page.emulateMedia({ colorScheme: "light" });
    await page.emulateMedia({ colorScheme: "dark" }); // mudanca do sistema nao sobrepoe
    expect(await bodyBackground(page)).toBe(BG.light);
    const cookies = await context.cookies();
    const fresh = await browser.newContext({ colorScheme: "dark", storageState: { cookies, origins: [] } });
    const page2 = await fresh.newPage();
    await page2.goto(ENTRIES_URL);
    expect(await bodyBackground(page2)).toBe(BG.light);
    await context.close();
    await fresh.close();
  });

  test("alternar grava o cookie 'theme' e a escolha sobrevive ao reload", async ({ context, page }) => {
    await page.emulateMedia({ colorScheme: "dark" });
    await page.goto(ENTRIES_URL);
    await themeToggle(page).click();
    const cookie = (await context.cookies()).find((c) => c.name === "theme");
    expect(cookie?.value).toBe("light");
    await page.reload();
    expect(await bodyBackground(page)).toBe(BG.light);
  });
});

test.describe("CA81 - sem flash de tema errado", () => {
  test("sem JavaScript: <html data-theme> e fundo ja vem corretos do servidor", async ({ browser }) => {
    const context = await browser.newContext({ javaScriptEnabled: false, colorScheme: "light" });
    await setThemeCookie(context, "dark");
    const page = await context.newPage();
    await page.goto(ENTRIES_URL);
    expect(await htmlTheme(page)).toBe("dark");
    expect(await bodyBackground(page)).toBe(BG.dark);
    await context.close();
  });

  test("tela de loading (rede lenta): cor do body no primeiro DOMContentLoaded ja e a final", async ({ browser }) => {
    const context = await browser.newContext({ colorScheme: "light" });
    await setThemeCookie(context, "dark");
    const page = await context.newPage();
    const first: string[] = [];
    await page.addInitScript(() => {
      document.addEventListener("DOMContentLoaded", () => {
        (window as unknown as { __firstBg: string }).__firstBg = getComputedStyle(document.body).backgroundColor;
      });
    });
    await page.goto(ENTRIES_URL, { waitUntil: "domcontentloaded" });
    first.push(await page.evaluate(() => (window as unknown as { __firstBg: string }).__firstBg));
    expect(first[0]).toBe(BG.dark);
    await page.waitForLoadState("networkidle");
    expect(await bodyBackground(page)).toBe(BG.dark);
    await context.close();
  });

  test("pagina de erro (API 500) ja nasce no tema da preferencia", async ({ browser }) => {
    await setScenario("error500");
    const context = await browser.newContext({ colorScheme: "light" });
    await setThemeCookie(context, "dark");
    const page = await context.newPage();
    await page.goto(ENTRIES_URL);
    expect(await htmlTheme(page)).toBe("dark");
    expect(await bodyBackground(page)).toBe(BG.dark);
    await context.close();
  });

  test("sem aviso de hydration mismatch no console", async ({ context, page }) => {
    await setThemeCookie(context, "dark");
    await page.emulateMedia({ colorScheme: "light" });
    const messages: string[] = [];
    page.on("console", (m) => messages.push(m.text()));
    page.on("pageerror", (e) => messages.push(e.message));
    await page.goto(ENTRIES_URL);
    await page.waitForLoadState("networkidle");
    expect(messages.filter((m) => /hydrat/i.test(m))).toEqual([]);
  });
});

test.describe("CA87 - movimento reduzido", () => {
  test("alternar tema e instantaneo (sem animacoes nem transicoes)", async ({ context, page }) => {
    await page.emulateMedia({ reducedMotion: "reduce" });
    await setThemeCookie(context, "dark");
    await page.goto(ENTRIES_URL);
    await themeToggle(page).click();
    const state = await page.evaluate(() => ({
      animations: document.getAnimations().length,
      duration: getComputedStyle(document.body).transitionDuration,
    }));
    expect(state.animations).toBe(0);
    expect(state.duration.split(",").every((d) => d.trim() === "0s")).toBe(true);
  });

  test("troca de tema nunca anima cores, mesmo sem reduced-motion (CA84/CA87)", async ({ context, page }) => {
    await setThemeCookie(context, "dark");
    await page.goto(ENTRIES_URL);
    await themeToggle(page).click();
    expect(await page.evaluate(() => document.getAnimations().filter((a) => (a as CSSTransition).transitionProperty?.includes("color")).length)).toBe(0);
  });
});
