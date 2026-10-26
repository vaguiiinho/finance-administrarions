import { expect, test, type Page } from "@playwright/test";
import { MONTH, setScenario, setThemeCookie, gotoReady } from "./support";

/**
 * F3 e F5 (design 13.2) no navegador: scroll-snap por mes no grafico estreito, uma unica parada de Tab por grafico e
 * navegacao por setas que mantem o mes ativo visivel na area rolavel.
 */
test.beforeEach(async ({ context }) => {
  await setScenario("default");
  await setThemeCookie(context, "light");
});

const MONTH_WIDTH = 56;
const narrowScroll = (page: Page) => page.getByTestId("scroll-area");

async function openNarrow(page: Page) {
  await page.setViewportSize({ width: 360, height: 800 });
  await gotoReady(page, `/dashboard?month=${MONTH}`);
  await page.waitForLoadState("networkidle");
  await expect(narrowScroll(page)).toBeVisible();
}

test("F3: area rolavel do grafico estreito tem scroll-snap-type x proximity", async ({ page }) => {
  await openNarrow(page);
  const snap = await narrowScroll(page).evaluate((el) => getComputedStyle(el).scrollSnapType);
  // `proximity` e a estrictness inicial: o Chrome serializa o valor computado de `x proximity` como "x"
  expect(snap).toMatch(/^x(\s+proximity)?$/);
});

test("F3: os alvos de snap existem por mes (alinhamento) e a abertura continua centralizada no mes selecionado", async ({ page }) => {
  await openNarrow(page);
  const info = await narrowScroll(page).evaluate((el) => {
    const aligned = [...el.querySelectorAll("*")].filter((n) => getComputedStyle(n).scrollSnapAlign !== "none").length;
    return { aligned, scrollLeft: el.scrollLeft, max: el.scrollWidth - el.clientWidth };
  });
  expect(info.aligned).toBeGreaterThanOrEqual(1);
  expect(info.scrollLeft).toBeGreaterThan(info.max - 2 * MONTH_WIDTH); // mes selecionado = ultimo: abre no fim
});

test("F5a: Tab entra no grafico de barras em UMA parada e a seguinte sai dele (largo)", async ({ page }) => {
  await gotoReady(page, `/dashboard?month=${MONTH}`);
  await page.waitForLoadState("networkidle");
  const figure = page.locator("figure").filter({ has: page.getByRole("heading", { name: "Evolução mensal" }) });
  const toggleTable = figure.getByRole("button", { name: "Tabela" });
  await toggleTable.focus();
  const stops: boolean[] = [];
  for (let i = 0; i < 3; i++) {
    await page.keyboard.press("Tab");
    stops.push(await page.evaluate(() => !!document.activeElement?.closest(".recharts-wrapper, [aria-label^='Gráfico de evolução mensal']")));
  }
  // exatamente uma parada dentro do grafico; as demais fora
  expect(stops.filter(Boolean)).toHaveLength(1);
});

test("F5a: no grafico estreito tambem existe uma unica parada de Tab (area rolavel)", async ({ page }) => {
  await openNarrow(page);
  const figure = page.locator("figure").filter({ has: page.getByRole("heading", { name: "Evolução mensal" }) });
  await figure.getByRole("button", { name: "Tabela" }).focus();
  const inside: boolean[] = [];
  for (let i = 0; i < 4; i++) {
    await page.keyboard.press("Tab");
    inside.push(await page.evaluate(() => !!document.activeElement?.closest("[data-testid='scroll-area'], .recharts-wrapper")));
  }
  expect(inside.filter(Boolean)).toHaveLength(1);
});

test("F5b: setas a partir da unica parada de Tab mostram o mes ativo e a area rolavel o mantem visivel (ate o primeiro mes)", async ({ page }) => {
  await openNarrow(page);
  const scroll = narrowScroll(page);
  const figure = page.locator("figure").filter({ has: page.getByRole("heading", { name: "Evolução mensal" }) });
  await figure.getByRole("button", { name: "Tabela" }).focus();
  await page.keyboard.press("Tab"); // entra no grafico (a unica parada, F5a)
  const visibleTickLabelsOfActiveMonth = async () => {
    const tooltip = page.locator(".recharts-tooltip-wrapper").filter({ hasText: "Receitas" }).first();
    await tooltip.waitFor({ timeout: 5000 });
    const heading = (await tooltip.locator("p").first().innerText()).trim(); // ex.: "novembro de 2026"
    const [monthName, , year] = heading.split(" ");
    const label = `${monthName.slice(0, 3).toLowerCase()}/${year.slice(2)}`;
    const tick = scroll.locator("text", { hasText: label }).first();
    const [t, s] = [await tick.boundingBox(), await scroll.boundingBox()];
    return { label, inside: !!t && !!s && t.x >= s.x - 1 && t.x + t.width <= s.x + s.width + 1 };
  };
  const seen: string[] = [];
  for (let i = 0; i < 13; i++) {
    await page.keyboard.press("ArrowLeft");
    const { label, inside } = await visibleTickLabelsOfActiveMonth();
    seen.push(label);
    expect(inside, `mes ativo ${label} (passo ${i + 1}) precisa estar visivel na area rolavel`).toBe(true);
  }
  expect(new Set(seen).size, "cada seta muda o mes ativo").toBeGreaterThan(8);
});

test("CAF04: o eixo Y fixo do grafico estreito mostra os rotulos de escala (R$ 0 e ao menos 3 ticks) e continua visivel apos rolar", async ({ page }) => {
  await openNarrow(page);
  const axis = page.getByTestId("fixed-axis");
  const ticks = axis.locator("text");
  await expect(ticks.first()).toBeVisible();
  expect(await ticks.count()).toBeGreaterThanOrEqual(3);
  await expect(axis.locator("text", { hasText: /^R\$ 0$/ })).toHaveCount(1);
  await narrowScroll(page).evaluate((el) => (el.scrollLeft = 0));
  await expect(ticks.first()).toBeVisible();
});
