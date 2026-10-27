import { expect, test, type Page } from "@playwright/test";
import { BG, ENTRIES_URL, MONTH, audit, bodyBackground, gotoReady, htmlTheme, setScenario, setThemeCookie, showChartTooltip, themeToggle } from "./support";
import { resolveTokens } from "./tokens";

/**
 * CA86 / CAF09 (design 13.3): graficos e controles nativos apos alternar o tema.
 *  - dashboard aberto (largo e 360px com eixo fixo), tooltip visivel: eixos, grade, linha do zero, legenda, tooltip,
 *    cursor e series assumem os tokens do novo tema SEM recarregar, e nenhum fill/stroke usa cor literal;
 *  - `color-scheme` efetivo do <html> e dos controles nativos (data, mes, select, combobox) acompanha o tema;
 *  - scrollbars tematizadas (`scrollbar-color` = tokens).
 */
const CHART_TOKENS = [
  "--chart-axis", "--chart-grid", "--chart-zero-line", "--chart-cursor", "--chart-income", "--chart-paid", "--chart-pending",
  "--chart-balance-realized", "--chart-balance-projected", "--tooltip-bg", "--tooltip-border", "--scrollbar-thumb", "--scrollbar-track", "--text", "--chart-sep", "--surface",
];

test.beforeEach(async () => {
  await setScenario("default");
});

/** Cores computadas dos elementos do grafico de barras (primeiro SVG com area de plotagem). */
async function chartColors(page: Page) {
  return page.evaluate(() => {
    // no modo estreito o eixo Y e as barras estao em SVGs diferentes: consulta o conjunto de graficos
    const svg = document.querySelector<SVGElement>(".relative:has(.recharts-wrapper)")!;
    const css = (el: Element | null, prop: "fill" | "stroke" | "color" | "backgroundColor" | "borderTopColor") => (el ? getComputedStyle(el)[prop] : null);
    const wrapper = document.querySelector(".recharts-tooltip-wrapper > div");
    return {
      tick: css([...svg.querySelectorAll(".recharts-wrapper svg text")].find((t) => /^[a-zç]{3}\/\d{2}$/.test(t.textContent ?? "") && t.getAttribute("font-weight") !== "700") ?? null, "fill"),
      yTick: css([...svg.querySelectorAll(".recharts-wrapper svg text")].find((t) => /^-?R\$/.test(t.textContent ?? "")) ?? null, "fill"),
      grid: css(svg.querySelector(".recharts-cartesian-grid line"), "stroke"),
      zero: css(svg.querySelector("line[stroke='var(--chart-zero-line)']"), "stroke"),
      income: css(svg.querySelector(".recharts-bar:nth-of-type(1) path, .recharts-bar-rectangle path"), "fill"),
      realized: css(svg.querySelector("path.recharts-line-curve[stroke='var(--chart-balance-realized)']"), "stroke"),
      projected: css(svg.querySelector("path.recharts-line-curve[stroke='var(--chart-balance-projected)']"), "stroke"),
      tooltipBg: css(wrapper, "backgroundColor"),
      tooltipBorder: css(wrapper, "borderTopColor"),
      // separadores (TQ8, R6): contorno das barras empilhadas, dos pontos e das fatias do donut = papel --chart-sep, nunca --surface
      separators: [...new Set([...document.querySelectorAll(".recharts-wrapper .recharts-bar-rectangle path, .recharts-wrapper .recharts-dot, .recharts-wrapper .recharts-pie-sector path")].map((el) => getComputedStyle(el).stroke))].filter((v) => v !== "none"),
      literals: [...document.querySelectorAll(".recharts-wrapper *")]
        .flatMap((el) => ["fill", "stroke"].map((a) => el.getAttribute(a)))
        .filter((v): v is string => !!v && /^(#|rgb|hsl)/i.test(v)),
    };
  });
}

for (const [label, size] of [["largo", { width: 1280, height: 900 }], ["360px (eixo Y fixo)", { width: 360, height: 800 }]] as const) {
  test.describe(`dashboard ${label}: alternar tema pelo botao`, () => {
    for (const [from, to] of [["light", "dark"], ["dark", "light"]] as const) {
      test(`${from} -> ${to}: eixos, grade, zero, series, tooltip e cursor assumem o novo tema sem recarregar`, async ({ context, page }) => {
        await page.setViewportSize(size);
        await setThemeCookie(context, from);
        await gotoReady(page, `/dashboard?month=${MONTH}`);
        await page.waitForLoadState("networkidle");
        await showChartTooltip(page);
        await page.evaluate(() => ((window as unknown as { __marker: number }).__marker = 7));
        await themeToggle(page).click();
        await expect.poll(() => htmlTheme(page)).toBe(to);
        await expect.poll(() => bodyBackground(page)).toBe(BG[to]);
        expect(await page.evaluate(() => (window as unknown as { __marker?: number }).__marker), "sem reload").toBe(7);
        await showChartTooltip(page);

        const t = await resolveTokens(page, CHART_TOKENS);
        const c = await chartColors(page);
        expect(c.tick, "rotulos do eixo X").toBe(t["--chart-axis"]);
        expect(c.yTick, "rotulos do eixo Y").toBe(t["--chart-axis"]);
        expect(c.grid, "grade").toBe(t["--chart-grid"]);
        expect(c.zero, "linha do zero").toBe(t["--chart-zero-line"]);
        expect(c.income, "serie Receitas").toBe(t["--chart-income"]);
        expect(c.realized, "saldo realizado").toBe(t["--chart-balance-realized"]);
        expect(c.projected, "saldo previsto").toBe(t["--chart-balance-projected"]);
        expect(c.tooltipBg, "tooltip").toBe(t["--tooltip-bg"]);
        expect(c.tooltipBorder, "borda do tooltip").toBe(t["--tooltip-border"]);
        expect(c.separators.length, "o grafico tem separadores").toBeGreaterThan(0);
        expect(c.separators, "separadores de barras, pontos e fatias").toContain(t["--chart-sep"]);
        expect(c.separators, "nenhum separador com --surface").not.toContain(t["--surface"]);
        expect(c.literals, "fill/stroke com cor literal").toEqual([]);
        await audit(page, `dashboard ${label} apos ${from}->${to}`);
      });
    }
  });
}

test("legenda do donut e das barras assume o novo tema (swatches por token)", async ({ context, page }) => {
  await setThemeCookie(context, "light");
  await gotoReady(page, `/dashboard?month=${MONTH}`);
  await page.waitForLoadState("networkidle");
  await themeToggle(page).click();
  await expect.poll(() => htmlTheme(page)).toBe("dark");
  const t = await resolveTokens(page, ["--chart-income", "--chart-paid", "--chart-1"]);
  const swatches = await page.evaluate(() => [...document.querySelectorAll("figure li [aria-hidden='true']")].map((el) => getComputedStyle(el).backgroundColor));
  expect(swatches).toContain(t["--chart-income"]);
  expect(swatches).toContain(t["--chart-paid"]);
  expect(swatches).toContain(t["--chart-1"]);
});

test.describe("controles nativos: color-scheme efetivo acompanha o tema", () => {
  const schemeOf = (page: Page, selector: string) => page.locator(selector).first().evaluate((el) => getComputedStyle(el).colorScheme);

  for (const theme of ["light", "dark"] as const) {
    test(`/entries e /dashboard sem dialogo, tema ${theme}: html, data, mes, select e scrollbars`, async ({ context, page }) => {
      await setThemeCookie(context, theme);
      await gotoReady(page, ENTRIES_URL);
      expect(await schemeOf(page, "html")).toBe(theme);
      const sb = await resolveTokens(page, ["--scrollbar-thumb", "--scrollbar-track"]);
      const scrollbar = await page.locator("html").evaluate((el) => getComputedStyle(el).scrollbarColor);
      expect(scrollbar).toBe(`${sb["--scrollbar-thumb"]} ${sb["--scrollbar-track"]}`);
      const tabs = await page.locator('[role="tablist"]').first().evaluate((el) => getComputedStyle(el).scrollbarColor);
      expect(tabs, "scrollbar da faixa de abas").toBe(`${sb["--scrollbar-thumb"]} ${sb["--scrollbar-track"]}`);
      for (const selector of ["select", 'input[type="date"], input[type="month"]']) {
        if ((await page.locator(selector).count()) > 0) expect(await schemeOf(page, selector), selector).toBe(theme);
      }
      await gotoReady(page, `/dashboard?month=${MONTH}`);
      expect(await schemeOf(page, "html")).toBe(theme);
    });

    test(`drawer aberto, tema ${theme}: data, select e combobox em color-scheme ${theme}`, async ({ context, page }) => {
      await setThemeCookie(context, theme);
      await gotoReady(page, ENTRIES_URL);
      await page.getByRole("button", { name: /Novo lançamento/ }).click();
      const dialog = page.getByRole("dialog");
      await dialog.getByRole("radio", { name: "Cartão" }).click();
      for (const locator of [dialog.getByLabel("Data"), dialog.getByRole("combobox", { name: /Categoria/ }), dialog.locator("select").first()]) {
        expect(await locator.evaluate((el) => getComputedStyle(el).colorScheme)).toBe(theme);
      }
      expect(await dialog.evaluate((el) => getComputedStyle(el).scrollbarColor)).toContain("rgb");
    });
  }

  test("troca do sistema com o drawer aberto e texto digitado (sem preferencia salva): color-scheme dos controles acompanha", async ({ page }) => {
    await page.emulateMedia({ colorScheme: "light", reducedMotion: "reduce" });
    await gotoReady(page, ENTRIES_URL);
    await page.getByRole("button", { name: /Novo lançamento/ }).click();
    const dialog = page.getByRole("dialog");
    await dialog.getByLabel("Descrição").fill("Texto digitado");
    await dialog.getByRole("radio", { name: "Cartão" }).click();
    await dialog.getByRole("button", { name: "+ Novo cartão" }).click();
    for (const scheme of ["dark", "light", "dark"] as const) {
      await page.emulateMedia({ colorScheme: scheme, reducedMotion: "reduce" });
      await expect.poll(() => bodyBackground(page)).toBe(BG[scheme]);
      await expect(dialog.getByLabel("Descrição")).toHaveValue("Texto digitado");
      for (const locator of [dialog.getByLabel("Data"), dialog.getByRole("combobox", { name: /Categoria/ }), dialog.getByLabel("Dia de fechamento")]) {
        // sem preferencia salva o <html> declara "light dark" e o navegador escolhe pelo sistema (ao vivo): vale o proprio esquema ou "light dark"
        expect([scheme, "light dark"], `color-scheme em ${scheme}`).toContain(await locator.evaluate((el) => getComputedStyle(el).colorScheme));
      }
    }
  });
});
