import { type Page } from "@playwright/test";
import { expect, test } from "./auth-support";
import { signInAsAna } from "./legacy-auth";
import { BG, ENTRIES_URL, MONTH, PAGE_BG_REGION, PAGE_BG_TOKENS, audit, gotoReady, releaseMutations, setScenario, setThemeCookie, showChartTooltip } from "./support";
import { luminanceOf, resolveTokens } from "./tokens";

// ADR 0005 D10: o stub nao aceita requisicao sem Bearer; as telas protegidas pedem sessao (usuaria comum "ana").
test.beforeEach(async ({ page }) => {
  await signInAsAna(page);
});

/**
 * CA85 / CAF08: tema escuro sem "tons lavados". (1) estado "atualizando" sem opacidade nem scrim e acima de AA (stub
 * com `holdQueries`, que segura os GETs ate o fim do teste); (2) superficies, inputs, tooltips, toasts, menus, skeletons, abas e blocos de fatura usam tokens do
 * tema escuro (nada claro herdado).
 */
test.beforeEach(async ({ context }) => {
  await setScenario("default");
  await setThemeCookie(context, "dark");
});

/** Opacidade efetiva (produto dos ancestrais) de cada elemento com texto dentro da regiao. */
async function effectiveOpacities(page: Page, selector: string) {
  return page.evaluate((sel) => {
    const out: { text: string; opacity: number }[] = [];
    for (const region of document.querySelectorAll(sel)) {
      const walker = document.createTreeWalker(region, NodeFilter.SHOW_TEXT);
      for (let node = walker.nextNode(); node; node = walker.nextNode()) {
        if (!node.textContent?.trim() || !node.parentElement) continue;
        let opacity = 1;
        for (let el: Element | null = node.parentElement; el; el = el.parentElement) opacity *= Number(getComputedStyle(el).opacity);
        if (getComputedStyle(node.parentElement).visibility === "hidden") continue;
        out.push({ text: node.textContent.trim().slice(0, 30), opacity });
      }
    }
    return out;
  }, selector);
}

test.describe("estado 'atualizando' no escuro", () => {
  for (const [name, url, selector] of [
    ["lancamentos (troca de mes)", ENTRIES_URL, '[aria-busy="true"]'],
    ["dashboard (troca de mes)", `/dashboard?month=${MONTH}`, '[aria-busy="true"]'],
  ] as const) {
    test(`${name}: sem opacidade, sem scrim, 'Atualizando…' legivel, axe sem violacoes`, async ({ page }) => {
      await gotoReady(page, url);
      await page.waitForLoadState("networkidle");
      try {
        await setScenario("default", { holdQueries: true });
        await page.getByRole("button", { name: "Próximo mês" }).click();
        await page.getByText("Atualizando…").first().waitFor();
        await expect(page.locator(selector).first()).toBeVisible();

        const faded = (await effectiveOpacities(page, selector)).filter((t) => t.opacity < 1);
        expect(faded, "texto com opacidade < 1 na regiao atualizando").toEqual([]);
        const scrimmed = await page.evaluate(() =>
          [...document.querySelectorAll('[aria-busy="true"], [aria-busy="true"] *')].filter((el) => {
            const after = getComputedStyle(el, "::after");
            const before = getComputedStyle(el, "::before");
            const cover = (s: CSSStyleDeclaration) => s.content !== "none" && s.position === "absolute" && s.inset === "0px" && s.backgroundColor !== "rgba(0, 0, 0, 0)" && Number(s.opacity) < 1;
            return cover(after) || cover(before);
          }).length,
        );
        expect(scrimmed, "sobreposicao translucida sobre a regiao").toBe(0);
        await expect(page.locator('[aria-busy="true"]').first()).toBeVisible();
        await audit(page, `${name} atualizando [dark]`, { gradients: [PAGE_BG_REGION] });
        await expect(page.getByText("Atualizando…").first(), "o estado atualizando deve durar ate o fim do audit").toBeVisible();
      } finally {
        await releaseMutations().catch(() => undefined);
      }
    });
  }
});

test.describe("fundo em gradiente no escuro (CA10, CA15, RNF04)", () => {
  test("body: cor base escura (design rev. 6) e luminancia < 0.25; camada ::before pinta um gradiente", async ({ page }) => {
    await gotoReady(page, ENTRIES_URL);
    const body = await page.evaluate(() => getComputedStyle(document.body).backgroundColor);
    expect(body).toBe(BG.dark);
    expect(luminanceOf(body)).toBeLessThan(0.25);
    const image = await page.evaluate(() => getComputedStyle(document.body, "::before").backgroundImage);
    expect(image).toContain("gradient");
  });

  test("toda cor do conjunto do fundo tem luminancia em [0,005; 0,25): escuro, mas nao preto", async ({ page }) => {
    await gotoReady(page, ENTRIES_URL);
    const colors = await resolveTokens(page, [...PAGE_BG_TOKENS]);
    expect(Object.keys(colors)).toHaveLength(PAGE_BG_TOKENS.length);
    for (const [token, rgb] of Object.entries(colors)) {
      const l = luminanceOf(rgb);
      expect(l, `${token} (${rgb}) preto`).toBeGreaterThanOrEqual(0.005);
      expect(l, `${token} (${rgb}) claro demais`).toBeLessThan(0.25);
    }
  });
});

test.describe("superficies do escuro usam tokens do escuro", () => {
  const DARK_MAX_LUMINANCE = 0.25; // fundos de superficie escuros: --bg 0.005, --surface-2 e --surface-active ficam bem abaixo

  async function backgrounds(page: Page, selector: string): Promise<string[]> {
    return page.locator(selector).evaluateAll((els) =>
      els.filter((el) => el === document.body || (el as HTMLElement).offsetParent !== null || getComputedStyle(el).position === "fixed").map((el) => getComputedStyle(el).backgroundColor),
    );
  }
  // Superficies de vidro (rev. 7) tem alfa < 1: a luminancia que importa e a da COMPOSICAO sobre o fundo escuro (BG.dark), nao so a dos canais RGB.
  const flatten = (color: string): string => {
    const m = /rgba\(\s*([\d.]+),\s*([\d.]+),\s*([\d.]+),\s*([\d.]+)\s*\)/.exec(color);
    if (!m) return color;
    const a = Number(m[4]);
    const base = (BG.dark.match(/\d+/g) ?? []).map(Number);
    const out = [m[1], m[2], m[3]].map((v, i) => Math.round(Number(v) * a + base[i] * (1 - a)));
    return `rgb(${out.join(", ")})`;
  };
  const expectDark = (label: string, colors: string[]) => {
    expect(colors.length, `${label}: nenhum elemento encontrado`).toBeGreaterThan(0);
    for (const color of colors) {
      const transparent = /rgba\(.*,\s*0\)$/.test(color);
      if (!transparent) expect(luminanceOf(flatten(color)), `${label}: ${color} claro demais para o tema escuro`).toBeLessThan(DARK_MAX_LUMINANCE);
    }
  };

  test("lancamentos: cards, abas, campos, bloco de fatura e skeleton", async ({ page }) => {
    await gotoReady(page, ENTRIES_URL);
    expectDark("body", await backgrounds(page, "body"));
    expectDark("card", await backgrounds(page, ".card"));
    expectDark("aba", await backgrounds(page, ".tab"));
    await gotoReady(page, `${ENTRIES_URL}&tab=invoices`);
    expectDark("bloco de fatura", await backgrounds(page, '[role="group"]:has-text("Nubank")'));
  });

  test("drawer: superficie, inputs, combobox aberto e painel de novo cartao", async ({ page }) => {
    await gotoReady(page, ENTRIES_URL);
    await page.getByRole("button", { name: /Novo lançamento/ }).click();
    const dialog = page.getByRole("dialog");
    expectDark("drawer", await backgrounds(page, "dialog[open]"));
    expectDark("input", await backgrounds(page, "dialog[open] .field"));
    await dialog.getByRole("combobox", { name: /Categoria/ }).focus();
    await page.keyboard.press("ArrowDown");
    await dialog.getByRole("listbox").waitFor();
    expectDark("listbox", await backgrounds(page, '[role="listbox"]'));
    await dialog.getByRole("radio", { name: "Cartão" }).click();
    await dialog.getByRole("button", { name: "+ Novo cartão" }).click();
    const panel = dialog.getByLabel("Nome do cartão").locator("xpath=ancestor::*[contains(@class,'bg-surface-2')][1]");
    expect(await panel.count(), "painel de novo cartao com fundo --surface-2").toBeGreaterThan(0);
    expectDark("painel novo cartao", [await panel.evaluate((el) => getComputedStyle(el).backgroundColor)]);
  });

  test("menu do seletor de mes, toast e tooltip do grafico", async ({ page }) => {
    await gotoReady(page, ENTRIES_URL);
    await page.getByRole("button", { name: /Escolher mês|novembro de 2026/i }).first().click();
    expectDark("menu de mes", await backgrounds(page, '[role="group"][aria-label="Escolher mês"]'));
    await page.keyboard.press("Escape");
    await page.getByRole("checkbox", { name: /Internet/ }).check();
    await page.getByRole("button", { name: /^Marcar como pago( \(\d+\))?$/ }).click();
    await page.getByRole("alertdialog").getByRole("button", { name: /Marcar como pago/ }).click();
    await page.getByRole("status").filter({ hasText: /pag/i }).first().waitFor();
    expectDark("toast", await backgrounds(page, '[role="status"]:has-text("pag")'));

    await gotoReady(page, `/dashboard?month=${MONTH}`);
    await showChartTooltip(page);
    const tooltip = await resolveTokens(page, ["--tooltip-bg"]);
    const bgs = await backgrounds(page, ".recharts-tooltip-wrapper > div");
    expect(bgs.length).toBeGreaterThan(0);
    for (const bg of bgs) expect(bg, "tooltip nunca branco no escuro").toBe(tooltip["--tooltip-bg"]);
  });

  test("skeleton de carregamento usa tokens do escuro", async ({ page }) => {
    await setScenario("default", { delayMs: 2500 });
    await page.goto(ENTRIES_URL, { waitUntil: "commit" });
    await page.locator('[aria-busy="true"]').first().waitFor();
    const blocks = await backgrounds(page, '[aria-busy="true"] [class*="skeleton"], [aria-busy="true"] .skeleton');
    expect(blocks.length, "skeleton presente durante o carregamento").toBeGreaterThan(0);
    expectDark("skeleton", blocks);
  });
});
