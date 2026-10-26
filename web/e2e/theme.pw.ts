import { expect, test, type Page } from "@playwright/test";
import { BG, ENTRIES_URL, audit, bodyBackground, htmlTheme, setScenario, setThemeCookie, themeToggle } from "./support";

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

test.describe("CA84 - alternancias repetidas", () => {
  test("botao de tema 5x (alternando): data-theme, aria-pressed, cookie e foco; axe no estado final de cada tema", async ({ context, page }) => {
    await page.emulateMedia({ colorScheme: "light" });
    await setThemeCookie(context, "light");
    await page.goto(ENTRIES_URL);
    const toggle = themeToggle(page);
    const audited = new Set<string>();
    let expected: "light" | "dark" = "light";
    for (let i = 0; i < 5; i++) {
      expected = expected === "light" ? "dark" : "light";
      await toggle.click();
      await expect(toggle).toHaveAttribute("aria-pressed", String(expected === "dark"));
      await expect(toggle).toHaveAttribute("aria-label", "Tema escuro");
      await expect(toggle).toBeFocused();
      expect(await htmlTheme(page)).toBe(expected);
      expect(await bodyBackground(page)).toBe(BG[expected]);
      const cookie = (await context.cookies()).find((c) => c.name === "theme");
      expect(cookie?.value, `cookie apos clique ${i + 1}`).toBe(expected);
      if (i >= 3) {
        audited.add(expected);
        await audit(page, `/entries apos alternar para ${expected} (clique ${i + 1})`);
      }
    }
    expect([...audited].sort()).toEqual(["dark", "light"]);
  });

  test("com o drawer aberto o botao de tema fica inerte sob o scrim (design 2.2); a troca so ocorre pelo sistema", async ({ page }) => {
    await page.emulateMedia({ colorScheme: "light" });
    await page.goto(ENTRIES_URL);
    await page.getByRole("button", { name: /Novo lançamento/ }).click();
    const dialog = page.getByRole("dialog");
    await expect(dialog).toBeVisible();
    const toggle = themeToggle(page);
    await expect(toggle).toHaveCount(1); // existe (nao foi desmontado); so esta inerte
    const before = await toggle.getAttribute("aria-pressed");
    // dialogo modal: o resto da pagina e inerte, o clique nao pode alcancar o botao
    await expect(toggle.click({ timeout: 1500 })).rejects.toThrow(/intercepts pointer events|not receive pointer events/);
    await expect(toggle).toHaveAttribute("aria-pressed", before ?? "false");
    // D7 (<dialog> nativo com showModal): o foco nunca vai para o fundo. Ao fim do ciclo o Tab pode sair para a UI do
    // navegador (activeElement = body; isso evita armadilha de teclado, WCAG 2.1.2) e depois volta ao dialogo; um focus
    // trap proprio contrariaria o comportamento nativo escolhido no design.
    for (let i = 0; i < 12; i++) {
      await page.keyboard.press("Tab");
      const where = await page.evaluate(() => {
        const el = document.activeElement;
        if (!el || el === document.body || el === document.documentElement) return "browser";
        return el.closest("dialog") !== null ? "dialog" : "background";
      });
      expect(where, `Tab #${i + 1}`).not.toBe("background");
    }
  });

  test("troca do sistema 5x com o drawer aberto (sem preferencia salva): estado, URL, aba, foco, texto e cores por tema; axe no estado final", async ({ page }) => {
    await page.emulateMedia({ colorScheme: "light", reducedMotion: "reduce" }); // sem cookie: o tema segue o sistema ao vivo (CA79)
    await page.goto(`${ENTRIES_URL}&d_status=PENDING`);
    await page.getByRole("button", { name: /Novo lançamento/ }).click();
    const drawer = page.getByRole("dialog");
    const description = drawer.getByLabel("Descrição");
    await description.fill("Texto digitado");
    await description.focus();
    const audited = new Set<string>();
    await flipSystemTheme(page, async (scheme, i) => {
      await expect(drawer).toBeVisible();
      await expect(description).toBeFocused();
      await expect(description).toHaveValue("Texto digitado");
      await expectDialogTokens(page, drawer, description, scheme);
      if (i >= 3) {
        audited.add(scheme);
        await settle(page);
        await audit(page, `drawer aberto, sistema ${scheme}`);
      }
    });
    expect([...audited].sort()).toEqual(["dark", "light"]);
    await expect(page).toHaveURL(/d_status=PENDING/);
    await expect(page.getByRole("tab", { name: "Despesas" })).toHaveAttribute("aria-selected", "true");
  });

  test("troca do sistema 5x com o painel '+ Novo cartao' aberto: campos preenchidos preservados", async ({ page }) => {
    await page.emulateMedia({ colorScheme: "light", reducedMotion: "reduce" });
    await page.goto(ENTRIES_URL);
    await page.getByRole("button", { name: /Novo lançamento/ }).click();
    const drawer = page.getByRole("dialog");
    await drawer.getByRole("radio", { name: "Cartão" }).check();
    await drawer.getByLabel("Descrição").fill("Compra teste");
    await drawer.getByRole("button", { name: "+ Novo cartão" }).click();
    await drawer.getByLabel("Nome do cartão").fill("Inter");
    await drawer.getByLabel("Dia de fechamento").fill("3");
    await drawer.getByLabel("Dia de vencimento").fill("10");
    const audited = new Set<string>();
    await flipSystemTheme(page, async (scheme, i) => {
      await expect(drawer).toBeVisible();
      await expect(drawer.getByLabel("Nome do cartão")).toHaveValue("Inter");
      await expect(drawer.getByLabel("Dia de fechamento")).toHaveValue("3");
      await expect(drawer.getByLabel("Dia de vencimento")).toHaveValue("10");
      await expect(drawer.getByLabel("Descrição")).toHaveValue("Compra teste");
      if (i >= 3) {
        audited.add(scheme);
        await settle(page);
        await audit(page, `painel de novo cartao aberto, sistema ${scheme}`);
      }
    });
    expect([...audited].sort()).toEqual(["dark", "light"]);
  });

  test("troca do sistema 5x com o modal de pagamento aberto e uma linha selecionada: modal aberto e selecao preservada", async ({ page }) => {
    await page.emulateMedia({ colorScheme: "light", reducedMotion: "reduce" });
    await page.goto(ENTRIES_URL);
    const checkbox = page.getByRole("checkbox", { name: /Internet/ });
    await checkbox.check();
    await page.getByRole("button", { name: "Marcar como pago" }).click();
    const modal = page.getByRole("alertdialog");
    await expect(modal).toBeVisible();
    const audited = new Set<string>();
    await flipSystemTheme(page, async (scheme, i) => {
      await expect(modal).toBeVisible();
      if (i >= 3) {
        audited.add(scheme);
        await settle(page);
        await audit(page, `modal de pagamento aberto, sistema ${scheme}`);
      }
    });
    expect([...audited].sort()).toEqual(["dark", "light"]);
    await modal.getByRole("button", { name: "Cancelar" }).click();
    await expect(modal).toHaveCount(0);
    await expect(checkbox).toBeChecked();
  });
});

/** Alterna o tema do sistema 5x (light -> dark -> ...), esperando o fundo do body e chamando `check` a cada troca. */
async function flipSystemTheme(page: Page, check: (scheme: "light" | "dark", index: number) => Promise<void>) {
  let scheme: "light" | "dark" = "light";
  for (let i = 0; i < 5; i++) {
    scheme = scheme === "light" ? "dark" : "light";
    await page.emulateMedia({ colorScheme: scheme, reducedMotion: "reduce" });
    await expect.poll(() => bodyBackground(page)).toBe(BG[scheme]);
    await check(scheme, i);
  }
}

/** Evita flakiness do axe: espera nao haver animacoes/transicoes em curso. */
async function settle(page: Page) {
  await expect.poll(() => page.evaluate(() => document.getAnimations().length)).toBe(0);
}

/** Prova que nenhuma cor ficou herdada do tema anterior: superficie do dialogo e do campo = tokens do tema atual. */
async function expectDialogTokens(page: Page, dialog: import("@playwright/test").Locator, field: import("@playwright/test").Locator, scheme: "light" | "dark") {
  const expected = await page.evaluate(() => {
    const probe = document.createElement("div");
    document.body.append(probe);
    const resolve = (token: string) => {
      probe.style.backgroundColor = `var(${token})`;
      return getComputedStyle(probe).backgroundColor;
    };
    const out = { surface: resolve("--surface"), input: resolve("--input-bg") };
    probe.remove();
    return out;
  });
  const bg = (l: import("@playwright/test").Locator) => l.evaluate((el) => getComputedStyle(el).backgroundColor);
  expect(await bg(dialog), `superficie do drawer [${scheme}]`).toBe(expected.surface);
  expect(await bg(field), `campo [${scheme}]`).toBe(expected.input);
}
