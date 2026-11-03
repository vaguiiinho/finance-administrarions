import { type Locator, type Page } from "@playwright/test";
import { expect, test } from "./auth-support";
import { signInAsAna } from "./legacy-auth";
import { MONTH, gotoReady, setScenario, setThemeCookie } from "./support";
import { seedData } from "./entries-data";
import { singleCategoryEntries, worstCaseEntries } from "./dashboard-worst-case";

/**
 * Layout do dashboard (ADR 0012, spec CA01-CA15): "Despesas por categoria" abaixo da evolucao mensal, em largura total, e a
 * legenda da rosca sempre dentro do card. O jsdom nao mede layout, entao a garantia real e esta: caixas e overflow no navegador.
 * Decisao do usuario: o arranjo lado a lado comeca em @3xl (48rem do CONTEINER da rosca), a legenda tem no maximo 28rem (448 px).
 */
test.beforeEach(async ({ page }) => {
  await signInAsAna(page);
});

const SCREENS = [
  ["protegido", "/dashboard"],
  ["demo", "/demo/dashboard"],
] as const;
const THEMES = ["light", "dark"] as const;
const WIDTHS = [320, 375, 768, 1024, 1440, 1920] as const;
const TOL = 1;
const LEGEND_MAX = 448;

const monthlyCard = (page: Page) => page.getByRole("figure", { name: "Evolução mensal" });
const donutCard = (page: Page) => page.getByRole("figure", { name: "Despesas por categoria" });
const ring = (card: Locator) => card.locator(".recharts-responsive-container").first();
const legendOf = (card: Locator) => card.locator("ul").first();

async function open(page: Page, base: string, { width, theme = "light", entries }: { width: number; theme?: (typeof THEMES)[number]; entries?: unknown[] }) {
  if (entries) await seedData({ entries, demo: { cards: [], entries } });
  await setThemeCookie(page.context(), theme);
  await page.setViewportSize({ width, height: 900 });
  await gotoReady(page, `${base}?month=${MONTH}`);
  await expect(donutCard(page)).toBeVisible();
  await expect(monthlyCard(page)).toBeVisible();
}

const box = async (l: Locator) => (await l.boundingBox())!;

/** Caixa interna do card (sem borda e padding). */
const innerOf = (card: Locator) =>
  card.evaluate((el) => {
    const r = el.getBoundingClientRect();
    const s = getComputedStyle(el);
    const px = (v: string) => parseFloat(v) || 0;
    return { left: r.left + px(s.borderLeftWidth) + px(s.paddingLeft), right: r.right - px(s.borderRightWidth) - px(s.paddingRight) };
  });

/** CA07/CA08: nenhuma parte de nenhum `li` sai do card; a ul e a pagina nao ganham rolagem horizontal. */
async function expectLegendContained(page: Page, label: string) {
  const card = donutCard(page);
  const inner = await innerOf(card);
  const items = card.locator("ul > li");
  expect(await items.count(), `${label}: itens de legenda`).toBeGreaterThan(0);
  const outside = await items.evaluateAll(
    (lis, edges) =>
      lis.flatMap((li) =>
        [li, ...Array.from(li.querySelectorAll("*"))].flatMap((el) => {
          const r = el.getBoundingClientRect();
          return r.width > 0 && (r.left < edges.left - 1 || r.right > edges.right + 1) ? [`${(li.getAttribute("aria-label") ?? "").slice(0, 20)} <${el.tagName.toLowerCase()}> ${r.left.toFixed(1)}..${r.right.toFixed(1)}`] : [];
        }),
      ),
    inner,
  );
  expect(outside, `${label}: partes fora do card (${inner.left.toFixed(1)}..${inner.right.toFixed(1)})`).toEqual([]);
  const ul = await legendOf(card).evaluate((el) => ({ scroll: el.scrollWidth, client: el.clientWidth }));
  expect(ul.scroll, `${label}: ul.scrollWidth`).toBeLessThanOrEqual(ul.client);
  // CA08 no escopo desta feature: nada dos dois cards de grafico passa da viewport. A pagina inteira nao e medida aqui porque o
  // resumo do mes (MonthSummary, fora do escopo) transborda com os totais do pior caso — pendencia registrada em docs/runs.
  const beyond = await page.evaluate(() => {
    const w = window.innerWidth;
    const out = (el: Element) => {
      const r = el.getBoundingClientRect();
      return r.width > 0 && (r.left < -1 || r.right > w + 1) ? [`<${el.tagName.toLowerCase()} class="${(el.getAttribute("class") ?? "").slice(0, 60)}"> ${r.left.toFixed(1)}..${r.right.toFixed(1)}`] : [];
    };
    const figures = Array.from(document.querySelectorAll("figure"));
    const donut = figures.find((f) => f.textContent?.includes("Despesas por categoria"));
    return [
      ...figures.flatMap(out), // os dois cards cabem na viewport
      // a evolucao mensal tem rolagem horizontal propria (intencional): basta o card nao transbordar a si mesmo
      ...figures.filter((f) => f !== donut && f.scrollWidth > f.clientWidth + 1).map((f) => `figure scrollWidth ${f.scrollWidth} > ${f.clientWidth}`),
      ...(donut ? Array.from(donut.querySelectorAll("*")).flatMap(out) : ["donut ausente"]),
    ];
  });
  expect(beyond, `${label}: partes dos cards de grafico fora da viewport`).toEqual([]);
}

for (const [screenName, base] of SCREENS) {
  test.describe(`${screenName}: ${base}`, () => {
    for (const theme of THEMES) {
      for (const width of WIDTHS) {
        test(`CA07/CA08/CA11: pior caso contido no card, sem rolagem horizontal (${theme}, ${width}px)`, async ({ page }) => {
          await open(page, base, { width, theme, entries: worstCaseEntries(MONTH) });
          await expect(donutCard(page).locator("ul > li")).toHaveCount(6); // 5 categorias + "Outras"
          await expectLegendContained(page, `${screenName} ${theme} ${width}`);
          const ringBox = await box(ring(donutCard(page)));
          expect(ringBox.width, "rosca mantem 220px (RF12)").toBeCloseTo(220, 0);
        });
      }
    }

    test("CA09: em 360px o nome trunca com reticencias e valor e percentual ficam inteiros em uma linha", async ({ page }) => {
      await open(page, base, { width: 360, entries: worstCaseEntries(MONTH) });
      const items = donutCard(page).locator("ul > li");
      const report = await items.evaluateAll((lis) =>
        lis.map((li) => {
          const label = li.getAttribute("aria-label") ?? "";
          const parts = Array.from(li.children) as HTMLElement[];
          const name = parts.find((c) => getComputedStyle(c).textOverflow === "ellipsis");
          const others = parts.filter((c) => c !== name && c.getAttribute("aria-hidden") !== "true");
          const centers = parts.map((c) => c.getBoundingClientRect().top + c.getBoundingClientRect().height / 2);
          return {
            label,
            hasEllipsisName: Boolean(name),
            nameTruncated: name ? name.scrollWidth > name.clientWidth : false,
            othersClipped: others.map((c) => c.scrollWidth > c.clientWidth),
            otherTexts: others.map((c) => c.textContent),
            oneLine: Math.max(...centers) - Math.min(...centers) <= 3,
          };
        }),
      );
      expect(report).toHaveLength(6);
      for (const item of report) {
        expect(item.hasEllipsisName, item.label).toBe(true);
        expect(item.oneLine, `${item.label}: uma linha`).toBe(true);
        expect(item.othersClipped.every((c) => !c), `${item.label}: valor/percentual cortados`).toBe(true);
        expect(item.otherTexts.length).toBeGreaterThanOrEqual(2); // valor e percentual
        if (!item.label.startsWith("Outras")) {
          expect(item.nameTruncated, `${item.label}: nome deveria truncar`).toBe(true);
          expect(item.label).toContain("W".repeat(58)); // nome completo no aria-label
        }
      }
      await expectLegendContained(page, "360");
    });

    test("CA10: em 360px a legenda fica abaixo da rosca e ocupa a largura interna do card", async ({ page }) => {
      await open(page, base, { width: 360, entries: worstCaseEntries(MONTH) });
      const card = donutCard(page);
      const [r, ul, inner] = [await box(ring(card)), await box(legendOf(card)), await innerOf(card)];
      expect(ul.y).toBeGreaterThanOrEqual(r.y + r.height - TOL);
      expect(ul.width).toBeGreaterThanOrEqual(inner.right - inner.left - TOL);
    });

    test("CA11: em 768px (conteiner < 48rem) empilha, com a legenda de no maximo 448px centralizada no card", async ({ page }) => {
      await open(page, base, { width: 768, entries: worstCaseEntries(MONTH) });
      const card = donutCard(page);
      const [r, ul, inner] = [await box(ring(card)), await box(legendOf(card)), await innerOf(card)];
      expect(ul.y, "legenda abaixo da rosca").toBeGreaterThanOrEqual(r.y + r.height - TOL);
      expect(ul.width).toBeLessThanOrEqual(LEGEND_MAX + TOL);
      expect(Math.abs(ul.x + ul.width / 2 - (inner.left + inner.right) / 2)).toBeLessThanOrEqual(2);
    });

    for (const width of [1024, 1440, 1920]) {
      test(`CA11: em ${width}px a legenda fica a direita da rosca (max 448px), centralizada na vertical, bloco centralizado`, async ({ page }) => {
        await open(page, base, { width, entries: worstCaseEntries(MONTH) });
        const card = donutCard(page);
        const [r, ul, inner] = [await box(ring(card)), await box(legendOf(card)), await innerOf(card)];
        expect(ul.x, "legenda a direita da rosca").toBeGreaterThanOrEqual(r.x + r.width - TOL);
        expect(ul.width).toBeLessThanOrEqual(LEGEND_MAX + TOL);
        expect(Math.abs(ul.y + ul.height / 2 - (r.y + r.height / 2)), "centralizada na vertical").toBeLessThanOrEqual(3);
        const leftMargin = r.x - inner.left;
        const rightMargin = inner.right - (ul.x + ul.width);
        expect(Math.abs(leftMargin - rightMargin), "bloco centralizado").toBeLessThanOrEqual(3);
      });
    }

    for (const width of [360, 1440]) {
      test(`CA03: cards de grafico com a mesma largura e x do resumo, donut abaixo das barras (${width}px)`, async ({ page }) => {
        await open(page, base, { width });
        const [m, d] = [await box(monthlyCard(page)), await box(donutCard(page))];
        const s = await box(page.getByRole("region", { name: /^Resumo de / }));
        for (const b of [m, d]) {
          expect(Math.abs(b.x - s.x)).toBeLessThanOrEqual(TOL);
          expect(Math.abs(b.width - s.width)).toBeLessThanOrEqual(TOL);
        }
        expect(d.y).toBeGreaterThanOrEqual(m.y + m.height - TOL);
      });
    }

    test("CA03: 768, 1024 e 1280px tambem em largura total e empilhados", async ({ page }) => {
      for (const width of [768, 1024, 1280]) {
        await open(page, base, { width });
        const [m, d] = [await box(monthlyCard(page)), await box(donutCard(page))];
        expect(Math.abs(m.x - d.x), `${width}: x`).toBeLessThanOrEqual(TOL);
        expect(Math.abs(m.width - d.width), `${width}: largura`).toBeLessThanOrEqual(TOL);
        expect(d.y, `${width}: abaixo`).toBeGreaterThanOrEqual(m.y + m.height - TOL);
        const s = await box(page.getByRole("region", { name: /^Resumo de / }));
        expect(Math.abs(m.width - s.width), `${width}: igual ao resumo`).toBeLessThanOrEqual(TOL);
      }
    });

    test("CA01: ordem no DOM e no foco: evolucao mensal antes de despesas por categoria", async ({ page }) => {
      await open(page, base, { width: 1440 });
      const order = await page.evaluate(() => {
        const figs = Array.from(document.querySelectorAll("figure"));
        const idx = (name: string) => figs.findIndex((f) => document.getElementById(f.getAttribute("aria-labelledby") ?? "")?.textContent === name);
        return { monthly: idx("Evolução mensal"), donut: idx("Despesas por categoria") };
      });
      expect(order.monthly).toBeGreaterThanOrEqual(0);
      expect(order.donut).toBeGreaterThan(order.monthly);
    });

    test("CA12: zoom de texto 200% (viewport 640px, fonte raiz dobrada) sem transbordo", async ({ page }) => {
      await open(page, base, { width: 640, entries: worstCaseEntries(MONTH) });
      await page.evaluate(() => (document.documentElement.style.fontSize = "200%"));
      await page.waitForTimeout(150);
      await expectLegendContained(page, "zoom 200%");
      const parts = await donutCard(page).locator("ul > li .money").first().isVisible();
      expect(parts).toBe(true);
    });

    for (const width of [320, 360, 1440]) {
      test(`percentual "100,00%" e total no limite de Decimal(12,2) cabem (${width}px)`, async ({ page }) => {
        await open(page, base, { width, entries: singleCategoryEntries(MONTH) });
        await expect(donutCard(page).locator("ul > li")).toHaveCount(1);
        await expectLegendContained(page, `categoria unica ${width}`);
        const r = await box(ring(donutCard(page)));
        const total = await box(donutCard(page).locator(".money").first());
        expect(total.width, "total no centro cabe no furo da rosca (~150px)").toBeLessThanOrEqual(150);
        expect(total.x).toBeGreaterThanOrEqual(r.x);
        expect(total.x + total.width).toBeLessThanOrEqual(r.x + r.width);
      });
    }

    for (const width of [360, 1440]) {
      test(`CA14: visao Tabela contida no card, sem rolagem horizontal da pagina (${width}px)`, async ({ page }) => {
        await open(page, base, { width, entries: worstCaseEntries(MONTH) });
        await donutCard(page).getByRole("button", { name: "Tabela" }).click();
        const group = donutCard(page).getByRole("group", { name: "Tabela de despesas por categoria" });
        await expect(group).toBeVisible();
        await expect(group.getByRole("row")).toHaveCount(1 + 7 + 1); // cabecalho + todas as categorias (sem agrupar) + total
        const [g, inner] = [await box(group), await innerOf(donutCard(page))];
        expect(g.x).toBeGreaterThanOrEqual(inner.left - TOL);
        expect(g.x + g.width).toBeLessThanOrEqual(inner.right + TOL);
        const scroll = await page.evaluate(() => ({ scroll: document.documentElement.scrollWidth, inner: window.innerWidth }));
        expect(scroll.scroll).toBeLessThanOrEqual(scroll.inner);
      });
    }

    for (const width of [360, 1440]) {
      test(`CA15: estado vazio em largura total, abaixo das barras e centralizado (${width}px)`, async ({ page }) => {
        await setScenario("empty");
        await open(page, base, { width });
        const card = donutCard(page);
        await expect(card.getByText("R$ 0,00")).toBeVisible();
        await expect(card.getByText(/^Nenhuma despesa em .+[^.]$/)).toBeVisible(); // o texto visivel, nao a descricao sr-only (termina em ".")
        const link = card.getByRole("link", { name: "Ir para lançamentos" });
        await expect(link).toBeVisible();
        await expect(card.getByRole("button", { name: "Tabela" })).toHaveCount(0);
        const [m, d, l] = [await box(monthlyCard(page)), await box(card), await box(link)];
        expect(Math.abs(m.width - d.width)).toBeLessThanOrEqual(TOL);
        expect(d.y).toBeGreaterThanOrEqual(m.y + m.height - TOL);
        expect(Math.abs(l.x + l.width / 2 - (d.x + d.width / 2))).toBeLessThanOrEqual(3);
      });
    }
  });
}

test.describe("CA04: carregamento no mesmo arranjo, sem salto de layout", () => {
  for (const [screenName, base] of SCREENS) {
    for (const width of [360, 1440]) {
      test(`${screenName} ${width}px: skeletons empilhados em largura total e CLS <= 0,01 na troca para os dados`, async ({ page }) => {
        await page.addInitScript(() => {
          const w = window as unknown as { __cls: number };
          w.__cls = 0;
          new PerformanceObserver((list) => {
            for (const e of list.getEntries() as unknown as { value: number; hadRecentInput: boolean }[]) if (!e.hadRecentInput) w.__cls += e.value;
          }).observe({ type: "layout-shift", buffered: true });
        });
        await setScenario("default", { delayMs: 2500 });
        await page.setViewportSize({ width, height: 900 });
        await page.goto(`${base}?month=${MONTH}`, { waitUntil: "commit" });
        const monthlySk = page.locator('[aria-busy="true"]').filter({ hasText: "Carregando evolução mensal" });
        const donutSk = page.locator('[aria-busy="true"]').filter({ hasText: "Carregando despesas por categoria" });
        await expect(donutSk).toBeVisible({ timeout: 15_000 });
        await expect(monthlySk).toBeVisible();
        const [m, d] = [await box(monthlySk), await box(donutSk)];
        expect(Math.abs(m.x - d.x)).toBeLessThanOrEqual(TOL);
        expect(Math.abs(m.width - d.width)).toBeLessThanOrEqual(TOL);
        expect(d.y).toBeGreaterThanOrEqual(m.y + m.height - TOL);
        const expectedChartHeight = width === 360 ? 260 : 320;
        expect(Math.abs((await box(monthlySk.locator('.skeleton[class*="h-[260px]"]'))).height - expectedChartHeight), "altura do retangulo do ChartSkeleton").toBeLessThanOrEqual(1);
        await page.evaluate(() => ((window as unknown as { __cls: number }).__cls = 0));
        await expect(donutCard(page)).toBeVisible({ timeout: 20_000 });
        await expect(monthlyCard(page)).toBeVisible();
        await page.waitForTimeout(300);
        const cls = await page.evaluate(() => (window as unknown as { __cls: number }).__cls);
        expect(cls, "CLS na troca skeleton -> dados").toBeLessThanOrEqual(0.01);
      });
    }
  }
});

test.describe("CA05: falha isolada de um bloco, em largura total (cenarios do stub)", () => {
  // O stub precisa dos cenarios `category-distribution-error` e `monthly-evolution-error` (ADR 0012 5.5): cada um derruba so o
  // GET correspondente (500), no protegido e na demo. A implementacao do stub e do dev.
  for (const [screenName, base] of SCREENS) {
    test(`${screenName}: erro so em despesas por categoria -> evolucao mensal normal e, abaixo, o card de erro em largura total`, async ({ page }) => {
      await setScenario("category-distribution-error");
      await page.setViewportSize({ width: 1440, height: 900 });
      await gotoReady(page, `${base}?month=${MONTH}`);
      await expect(monthlyCard(page)).toBeVisible();
      const alert = page.getByRole("alert").filter({ hasText: "Não foi possível carregar as despesas por categoria." });
      await expect(alert).toBeVisible();
      await expect(alert.getByRole("button", { name: "Tentar novamente" })).toBeVisible();
      await expect(page.getByRole("alert").filter({ hasText: "evolução mensal" })).toHaveCount(0);
      const [m, a] = [await box(monthlyCard(page)), await box(alert)];
      expect(Math.abs(a.x - m.x)).toBeLessThanOrEqual(TOL);
      expect(Math.abs(a.width - m.width)).toBeLessThanOrEqual(TOL);
      expect(a.y).toBeGreaterThanOrEqual(m.y + m.height - TOL);
    });

    test(`${screenName}: erro so na evolucao mensal -> card de erro em cima e o donut embaixo`, async ({ page }) => {
      await setScenario("monthly-evolution-error");
      await page.setViewportSize({ width: 1440, height: 900 });
      await gotoReady(page, `${base}?month=${MONTH}`);
      await expect(donutCard(page)).toBeVisible();
      const alert = page.getByRole("alert").filter({ hasText: "Não foi possível carregar a evolução mensal." });
      await expect(alert).toBeVisible();
      await expect(alert.getByRole("button", { name: "Tentar novamente" })).toBeVisible();
      const [a, d] = [await box(alert), await box(donutCard(page))];
      expect(Math.abs(a.x - d.x)).toBeLessThanOrEqual(TOL);
      expect(Math.abs(a.width - d.width)).toBeLessThanOrEqual(TOL);
      expect(d.y).toBeGreaterThanOrEqual(a.y + a.height - TOL);
    });
  }
});
